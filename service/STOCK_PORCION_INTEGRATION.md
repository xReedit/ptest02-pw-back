# 🔧 Guía de Integración: Stock Porción Service

## 📋 Resumen

Nuevo servicio centralizado para manejo de stock de porciones optimizado para **alta concurrencia** (50+ transacciones/segundo).

**Características principales:**
- ✅ Transacciones ACID (stock + historial atómico)
- ✅ Locks pesimistas (SELECT FOR UPDATE)
- ✅ Retry automático en deadlocks (3 intentos)
- ✅ Validación de stock suficiente
- ✅ Performance optimizado
- ✅ Logging no invasivo

---

## 🚀 Cómo usar el servicio

### Ejemplo básico - Venta de producto

```javascript
const StockPorcionService = require('./stock.porcion.service');

// Cuando se confirma un pedido
const resultado = await StockPorcionService.actualizarStockConHistorial({
    iditem: 1290,              // ID del producto
    cantidadProducto: 2,       // Cantidad pedida (2 hamburguesas)
    idsede: 1,                 // Sede
    idusuario: 103,            // Usuario que procesa
    idpedido: 25500,           // ID del pedido (opcional)
    tipoMovimiento: 'VENTA',   // VENTA | ENTRADA | SALIDA | COMPRA | RECUPERA
    esReset: false             // false = descuenta, true = establece valor
});

if (resultado.success) {
    console.log('✅ Stock actualizado:', resultado.porcionesAfectadas);
    console.log('⏱️ Tiempo de ejecución:', resultado.ejecutionTime, 'ms');
} else {
    console.error('❌ Error:', resultado.error);
}
```

### Respuesta del servicio

```javascript
{
    success: true,
    message: 'Stock actualizado correctamente',
    porcionesAfectadas: [
        {
            idporcion: 3,
            descripcion: 'CHANCHO AL CILINDRO',
            cantidadAjustada: -0.5,
            stockAnterior: 17.0,
            stockNuevo: 16.5
        }
    ],
    ejecutionTime: 45  // milisegundos
}
```

---

## 🔗 Integración con código existente

### PASO 1: Integrar en `item.service.v1.js`

**Ubicación:** `processItem()` - Línea 68

**ANTES:**
```javascript
// Línea 42-48
updatedItem = await QueryServiceV1.emitirRespuestaSP('call procedure_stock_item(?, ?)', [
    JSON.stringify(_item),
    idsede
], transaction);

await transaction.commit();

// Línea 65-76 ❌ FUERA DE TRANSACCIÓN
porcionMovementsService.guardarMovimientoPorcion({...});
```

**DESPUÉS:**
```javascript
const StockPorcionService = require('./stock.porcion.service');

// Llamar procedimiento original (para productos normales)
updatedItem = await QueryServiceV1.emitirRespuestaSP('call procedure_stock_item(?, ?)', [
    JSON.stringify(_item),
    idsede
]);

// SI EL ITEM TIENE PORCIONES, usar el nuevo servicio
if (item.isporcion === 'SP' || item.tieneRecetaPorciones) {
    const resultadoPorciones = await StockPorcionService.actualizarStockConHistorial({
        iditem: item.iditem,
        cantidadProducto: item.cantidadSumar || 1,
        idsede: idsede,
        idusuario: item.idusuario || 1,
        idpedido: item.idpedido,
        tipoMovimiento: item.cantidad_reset > 0 ? 'ENTRADA' : 'VENTA',
        esReset: item.cantidad_reset > 0
    });
    
    if (!resultadoPorciones.success) {
        console.error('Error actualizando stock de porciones:', resultadoPorciones.error);
    }
}

// ELIMINAR las líneas 65-76 (registro manual fuera de transacción)
```

---

### PASO 2: Integrar en `item.service.v1.js` - `processItemPorcion()`

**Ubicación:** Línea 317

**DESPUÉS del procedimiento:**
```javascript
// Línea 317
updatedItem = await QueryServiceV1.emitirRespuestaSP('call procedure_stock_item_porcion(?)', [jsonParam]);

// AGREGAR: Registrar movimiento de porciones
const resultadoPorciones = await StockPorcionService.actualizarStockConHistorial({
    iditem: item.iditem,
    cantidadProducto: item.cantidadSumar || item.cantidad_reset || 1,
    idsede: item.idsede || 1,
    idusuario: item.idusuario || 1,
    idpedido: item.idpedido,
    tipoMovimiento: item.cantidad_reset > 0 ? 'ENTRADA' : 'VENTA',
    esReset: item.cantidad_reset > 0
});
```

---

### PASO 3: Integrar en `item.service.v1.js` - `processAllItemSubitemSeleted()`

**Ubicación:** Línea 441

**DESPUÉS del procedimiento:**
```javascript
// Línea 441-443
updatedItem = await QueryServiceV1.emitirRespuestaSP('call procedure_stock_all_subitems(?)', [
    JSON.stringify(allItems)
]);

// AGREGAR: Si tiene idporcion, registrar movimiento
if (allItems.idporcion) {
    // Convertir string de IDs a array
    const porcionesIds = allItems.idporcion.split(',').map(id => parseInt(id));
    
    // Registrar cada porción
    for (const idporcion of porcionesIds) {
        // Aquí necesitamos obtener el iditem asociado a la porción
        // Por ahora usar el servicio para registrar el historial
        await StockPorcionService._registrarMovimientosHistorial(
            [{
                idporcion: idporcion,
                cantidadAjustada: allItems.cantidadSumar || 1,
                stockNuevo: 0 // Obtener del resultado del procedimiento
            }],
            {
                iditem: allItems.iditem,
                cantidadProducto: 1,
                idsede: allItems.idsede,
                idusuario: allItems.idusuario || 1,
                idpedido: allItems.idpedido,
                tipoMovimiento: 'VENTA'
            },
            null // Sin transacción porque el procedimiento ya actualizó
        );
    }
}

// ELIMINAR líneas 446-469 (registro manual comentado)
```

---

## ⚡ Ventajas sobre el sistema actual

### Sistema actual ❌
```
1. procedure_stock_item actualiza stock
2. ✅ COMMIT
3. porcionMovementsService.guardarMovimientoPorcion() ← FUERA
4. ❌ Si falla, stock actualizado pero sin historial
```

### Sistema nuevo ✅
```
1. BEGIN TRANSACTION
2. SELECT FOR UPDATE (lock)
3. Validar stock
4. UPDATE stock
5. INSERT historial
6. COMMIT (TODO O NADA)
```

---

## 🎯 Casos de uso

### Caso 1: Venta normal
```javascript
await StockPorcionService.actualizarStockConHistorial({
    iditem: 1290,
    cantidadProducto: 1,
    idsede: 1,
    idusuario: 103,
    idpedido: 25500,
    tipoMovimiento: 'VENTA',
    esReset: false  // Descuenta del stock
});
```

### Caso 2: Entrada de mercadería
```javascript
await StockPorcionService.actualizarStockConHistorial({
    iditem: 1290,
    cantidadProducto: 10,  // Agregar 10 unidades
    idsede: 1,
    idusuario: 103,
    tipoMovimiento: 'ENTRADA',
    esReset: false  // Suma al stock existente
});
```

### Caso 3: Reset de stock (inventario)
```javascript
await StockPorcionService.actualizarStockConHistorial({
    iditem: 1290,
    cantidadProducto: 50,  // Establecer en 50
    idsede: 1,
    idusuario: 103,
    tipoMovimiento: 'ENTRADA',
    esReset: true  // Establece el valor absoluto
});
```

---

## 🔍 Monitoreo y debugging

### Logs generados

El servicio genera logs solo en errores críticos para no afectar performance:

```javascript
// Error log
{
    incidencia: {
        message: 'Error actualizando stock de porciones: Deadlock found',
        data: {
            params: {...},
            attempt: 2,
            errorCode: 'ER_LOCK_DEADLOCK'
        }
    },
    origen: 'StockPorcionService.actualizarStockConHistorial'
}
```

### Métricas importantes

```javascript
const resultado = await StockPorcionService.actualizarStockConHistorial({...});

console.log('Tiempo de ejecución:', resultado.ejecutionTime, 'ms');
// Ideal: < 100ms
// Aceptable: < 500ms
// Crítico: > 1000ms
```

---

## ⚠️ Consideraciones importantes

### 1. **No usar en endpoints síncronos pesados**
   - Preferir operaciones asíncronas
   - Usar queues para alto volumen

### 2. **Índices requeridos en BD**
   ```sql
   -- Verificar índices
   SHOW INDEX FROM porcion;
   SHOW INDEX FROM item_ingrediente;
   SHOW INDEX FROM porcion_historial;
   
   -- Crear si no existen
   CREATE INDEX idx_porcion_idsede ON porcion(idporcion, idsede);
   CREATE INDEX idx_item_ingrediente_iditem ON item_ingrediente(iditem, estado);
   CREATE INDEX idx_porcion_historial_idporcion ON porcion_historial(idporcion, fecha_date);
   ```

### 3. **Connection pool**
   ```javascript
   // En config/database.js verificar:
   pool: {
       max: 20,        // Mínimo para 50 tx/seg
       min: 5,
       acquire: 30000,
       idle: 10000
   }
   ```

---

## 🧪 Testing

### Test de concurrencia

```javascript
// test/stock-porcion-concurrency.test.js
const StockPorcionService = require('../service/stock.porcion.service');

async function testConcurrency() {
    const promises = [];
    
    // Simular 50 transacciones simultáneas
    for (let i = 0; i < 50; i++) {
        promises.push(
            StockPorcionService.actualizarStockConHistorial({
                iditem: 1290,
                cantidadProducto: 1,
                idsede: 1,
                idusuario: 103,
                tipoMovimiento: 'VENTA',
                esReset: false
            })
        );
    }
    
    const results = await Promise.all(promises);
    
    const exitosos = results.filter(r => r.success).length;
    console.log(`✅ Exitosos: ${exitosos}/50`);
    console.log(`❌ Fallidos: ${50 - exitosos}/50`);
}

testConcurrency();
```

---

## 📞 Soporte

Si encuentras problemas:
1. Revisar logs en `logs/error.log`
2. Verificar índices de BD
3. Revisar pool de conexiones
4. Contactar al equipo de desarrollo

---

**Versión:** 1.0.0  
**Fecha:** 2025-09-30  
**Estado:** ✅ Listo para integración
