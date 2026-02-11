# Sistema de Reservas de Stock - SOLID

## Descripción General

Sistema de reservas que actúa como "contador de productos en carritos activos". 
El **stock real solo se descuenta al confirmar el pedido**, no cuando el mozo agrega items al carrito.

## Flujo de Operación

```
┌─────────────────────────────────────────────────────────────────┐
│  Mozo agrega item    → reservarItem()    → Stock real INTACTO  │
│  Mozo quita item     → liberarItem()     → Stock real INTACTO  │
│  Mozo confirma       → confirmarItem()   → Stock real DESCONTADO│
│  Cleanup nocturno    → resetInactivas()  → Reservas huérfanas=0│
└─────────────────────────────────────────────────────────────────┘
```

## Estructura de Archivos (SOLID)

```
service/stock-reserva/
├── index.js              → Punto de entrada (exports)
├── reserva.config.js     → Configuración centralizada (S)
├── reserva.repository.js → Acceso a datos SQL (S, D)
├── item.analyzer.js      → Análisis de items/subitems (S)
├── receta.service.js     → Obtención de recetas (S, D)
├── stock.reserva.service.js → Orquestador principal (S)
├── sede.cache.js         → Caché de configuración por sede (S)
└── README.md             → Esta documentación
```

### Principios SOLID Aplicados

| Principio | Archivo | Implementación |
|-----------|---------|----------------|
| **S** - Single Responsibility | Todos | Cada archivo tiene UNA sola responsabilidad |
| **O** - Open/Closed | `reserva.config.js` | Extensible sin modificar código |
| **D** - Dependency Inversion | `stock.reserva.service.js` | Depende de abstracciones (Repository) |

---

## Archivos Detallados

### 1. `reserva.config.js`
Configuración centralizada del sistema.

```javascript
const CONFIG = {
    CLEANUP_MINUTOS_INACTIVIDAD: 30,  // Para cleanup nocturno
    USE_RESERVAS: true,  // Toggle del sistema
    TIPOS: { 
        PORCION: 'porcion',
        PRODUCTO: 'producto',
        PRODUCTO_ALMACEN: 'producto_almacen',
        CARTA_LISTA: 'carta_lista'
    },
    COLUMNAS: {
        porcion: { id: 'idporcion', tabla: 'porcion', stock: 'stock', pk: 'idporcion' },
        producto: { id: 'idproducto_stock', tabla: 'producto_stock', stock: 'stock', pk: 'idproducto_stock' },
        producto_almacen: { id: 'idproducto_stock', tabla: 'producto_stock', stock: 'stock', pk: 'idproducto_stock' },
        carta_lista: { id: 'idcarta_lista', tabla: 'carta_lista', stock: 'cantidad', pk: 'idcarta_lista' }
    }
};
```

**Cómo activar reservas:**

1. **Toggle global** en `reserva.config.js`: `USE_RESERVAS: true`
2. **Por sede** en tabla `sede`: campo `use_reservas_stock = 1`
3. **Para TODAS las sedes** (producción general): `USE_RESERVAS_TODAS_SEDES: true`

**Lógica:**
- `USE_RESERVAS = false` → Sistema deshabilitado para TODAS las sedes
- `USE_RESERVAS = true` + `USE_RESERVAS_TODAS_SEDES = false` → Verifica `sede.use_reservas_stock`
- `USE_RESERVAS = true` + `USE_RESERVAS_TODAS_SEDES = true` → **Activado para TODAS** (ignora BD)

**Fases de despliegue:**
```
PRUEBAS:    USE_RESERVAS=true, USE_RESERVAS_TODAS_SEDES=false  (solo sedes con flag)
PRODUCCIÓN: USE_RESERVAS=true, USE_RESERVAS_TODAS_SEDES=true   (todas las sedes)
```

**Ejemplo SQL para activar una sede (fase pruebas):**
```sql
UPDATE sede SET use_reservas_stock = 1 WHERE idsede = 13;
```

---

### 2. `reserva.repository.js`
Capa de acceso a datos (queries SQL).

**Métodos principales:**
```javascript
ReservaRepository.agregar(tipo, id, cantidad, idsede)    // INSERT ON DUPLICATE KEY UPDATE
ReservaRepository.quitar(tipo, id, cantidad, idsede)     // UPDATE cantidad -= X
ReservaRepository.confirmar(tipo, id, cantidad, idsede)  // Descuenta stock real + resta reserva
ReservaRepository.getStockDisponible(tipo, id, idsede)   // stock_real - reservado
ReservaRepository.resetInactivas(minutos)                // Cleanup
ReservaRepository.getListItemsPorcionDisponible(iditem, idsede)  // Para items SP
```

**Tipos soportados:** `'porcion'`, `'producto'`, `'producto_almacen'`, `'carta_lista'`

**Diferencias por tipo:**
| Tipo | Tabla | Tiene idsede | Columna ID |
|------|-------|--------------|------------|
| `porcion` | `porcion` | ✅ Sí | `idporcion` |
| `producto` | `producto_stock` | ❌ No | `idproducto_stock` |
| `producto_almacen` | `producto_stock` | ❌ No | `idproducto_stock` |
| `carta_lista` | `carta_lista` | ❌ No | `idcarta_lista` |

---

### 3. `item.analyzer.js`
Analiza items y extrae subitems de diferentes estructuras.

**Métodos principales:**
```javascript
ItemAnalyzer.analizar(item)  // Retorna {iditem, isSP, isND, tieneSubitems, cantidad}
ItemAnalyzer.tieneSubitemsConStock(item)  // Boolean
ItemAnalyzer.extraerSubitems(item)  // Array de subitems normalizados
ItemAnalyzer.determinarAccion(item)  // 'reservar' | 'liberar' | 'skip'
```

**Fuentes de subitems (en orden de prioridad):**

| Prioridad | Fuente | Cuándo se usa |
|-----------|--------|---------------|
| 1 | `subitems_selected` | **Principal** - objeto o array |
| 2 | `subitems_selected_array` | **Fallback** - solo si `subitems_selected` está vacío |
| 3 | `subitems_view` | **Último recurso** - solo si las anteriores están vacías |

> ⚠️ **Importante:** Algunos programas envían los subitems en `subitems_selected_array` en lugar de `subitems_selected`. Para evitar duplicados, se prioriza `subitems_selected` y solo se usa `subitems_selected_array` como fallback.

---

### 4. `receta.service.js`
Obtiene recetas de items y expande a componentes de stock.

**Métodos principales:**
```javascript
RecetaService.obtenerRecetaItem(iditem)  // Usa StockPorcionService
RecetaService.obtenerIngredientesSubreceta(idsubreceta)
RecetaService.expandirAComponentes(itemInfo, subitems)  // Clave!
```

**`expandirAComponentes`** retorna array de:
```javascript
[
  { tipo: 'porcion', id: 123, cantidad: 2, descripcion: 'Hamburguesa' },
  { tipo: 'producto', id: 456, cantidad: 1, descripcion: '' },
  { tipo: 'carta_lista', id: 789, cantidad: 1, descripcion: '' }
]
```

---

### 5. `stock.reserva.service.js`
**Orquestador principal** - Coordina los demás módulos.

**Método de entrada (desde handle.stock.v1.js):**
```javascript
StockReservaService.procesarItem(item, idsede)
```

**Flujo interno:**
1. `ItemAnalyzer.determinarAccion(item)` → 'reservar' o 'liberar'
2. `ItemAnalyzer.analizar(item)` → info del item
3. `ItemAnalyzer.extraerSubitems(item)` → subitems
4. `RecetaService.expandirAComponentes(itemInfo, subitems)` → componentes
5. Para cada componente: `ReservaRepository.agregar/quitar()`
6. Si es SP: `ReservaRepository.getListItemsPorcionDisponible()`

**Otros métodos:**
```javascript
StockReservaService.reservarItem(item, idsede)
StockReservaService.liberarItem(item, idsede)
StockReservaService.confirmarItem(item, idsede, metadata)  // Para cuando se confirma pedido
StockReservaService.getStockDisponible(tipo, id, idsede)
StockReservaService.resetReservasInactivas(minutos)
StockReservaService.isEnabled()  // Retorna USE_RESERVAS
```

---

### 6. `index.js`
Punto de entrada que exporta todos los módulos.

```javascript
const { StockReservaService, CONFIG } = require('./stock-reserva');

// Uso directo
await StockReservaService.procesarItem(item, idsede);

// Verificar si está habilitado
if (StockReservaService.isEnabled()) { ... }
```

---

## Integración en `handle.stock.v1.js`

```javascript
// Importación
const { StockReservaService, CONFIG: ReservaConfig } = require('./stock-reserva');
const USE_RESERVAS = ReservaConfig.USE_RESERVAS || false;

// En updateStock():
const updateStock = async (op, item, idsede) => {
    // ========== SISTEMA DE RESERVAS ==========
    // El sistema de reservas maneja TODO: almacén, porciones, recetas, subitems
    if (USE_RESERVAS) {
        const resultado = await StockReservaService.procesarItem(item, idsede);
        return [{
            cantidad: resultado.cantidad,  // Stock vendible calculado
            listItemsPorcion: resultado.listItemsPorcion || '[]',
            listSubItems: resultado.listSubItems || []
        }];
    }
    // ========== FIN SISTEMA DE RESERVAS ==========

    // FLUJO LEGACY (sin reservas): Procesar items de almacén
    if (item.isalmacen === 1) {
        return await processAlmacenItem(op, item);
    }
    // ... código existente
};
```

**Exportaciones:**
```javascript
module.exports = {
    updateStock,
    StockReservaService,
    USE_RESERVAS  // Para uso en otros módulos (apiPwa_v1.js, sockets.js)
};
```

---

## Tabla de Base de Datos

**Tabla requerida:** `stock_reserva`

```sql
CREATE TABLE stock_reserva (
    idstock_reserva INT AUTO_INCREMENT PRIMARY KEY,
    idsede INT NOT NULL,
    idporcion INT DEFAULT NULL,
    idproducto_stock INT DEFAULT NULL,
    idcarta_lista VARCHAR(50) DEFAULT NULL,
    cantidad DECIMAL(10,2) DEFAULT 0,
    fecha_ultima_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_sede_porcion (idsede, idporcion),
    UNIQUE KEY uk_sede_producto (idsede, idproducto_stock),
    UNIQUE KEY uk_sede_carta (idsede, idcarta_lista)
);
```

---

## Tipos de Items y Cómo se Procesan

| Tipo | Condición | Qué se reserva |
|------|-----------|----------------|
| **Porción (SP)** | `isporcion === 'SP'` | Porciones/productos de la receta |
| **ND con subitems** | `cantidad === 'ND'` + subitems | Solo los subitems |
| **Cantidad fija** | `cantidad !== 'ND' && !SP` | `carta_lista` directamente |
| **SP + subitems** | `SP` + subitems | AMBOS (receta + subitems) |

---

## Regla Crítica

> **Si un plato tiene receta "SP" Y también tiene subitems enlazados, DEBE RESERVAR DE AMBOS.**

Ejemplo: Si la receta tiene "hamburguesa 200gr" Y un subitem también tiene "hamburguesa 200gr", debe reservar de AMBOS.

---

## Campo `descuenta` en Subitems

Los subitems pueden tener un campo `descuenta` que indica cuántas unidades se descuentan del stock por cada unidad vendida.

**Ejemplo:**
```json
{
  "des": "CECINA 100GR",
  "idporcion": 23,
  "descuenta": 5,
  "selected": true
}
```

**Cálculo:**
```
cantidad_final = cantidad_selected × descuenta
```

Si `descuenta = 5` y vendes 1 unidad → se reservan 5 unidades de stock.

**Implementado en:** `item.analyzer.js` → `_normalizarSubitem()`

---

## Campo `cantidad_receta` en Recetas

El campo `cantidad_receta` en los ingredientes de receta indica cuántas unidades del ingrediente se consumen por cada venta del producto.

**Ejemplo de receta:**
```json
{
  "idporcion": 53,
  "descripcion": "PORCION CARNE HAMBURGUESA",
  "cantidad_receta": "2.00000",
  "stock_actual": "16.00"
}
```

**Cálculo del stock vendible:**
```
stock_vendible = stock_disponible / cantidad_receta
```

**Ejemplo:**
- Stock porción: 16 unidades
- cantidad_receta: 2 (se consumen 2 por cada hamburguesa)
- Stock vendible: 16 / 2 = **8 hamburguesas**

**Aplicación:**
1. Para **reservar**: cantidad × cantidad_receta = unidades a reservar
2. Para **mostrar stock**: stock_disponible / cantidad_receta = unidades vendibles

**Aplica a:**
- **Recetas**: campo `cantidad_receta` de `item_ingrediente`
- **Subrecetas**: campo `cantidad` de `subreceta_ingrediente`
- **Subitems**: campo `descuenta` (o `cantidad_selected`)

**Implementado en:**
- `receta.service.js` → `expandirAComponentes()` - guarda `cantidadReceta` en componentes
- `reserva.repository.js` → `getStockDisponible()` - calcula `stockVendible`
- `stock.reserva.service.js` → `_getStockDisponiblePrincipal()` - devuelve stock vendible

**Ejemplo con subreceta:**
```
Subreceta "COMBO HAMBURGUESA" con ingrediente:
  - PORCION PAN: cantidad = 3
  
Stock PAN: 15
Stock vendible: 15 / 3 = 5 combos
```

---

## Cancelación de Pedido (`cantidad_reset`)

Cuando se cancela un pedido, los items vienen con `cantidad_reset > 0`. Esto dispara la acción **resetear** que libera las reservas correspondientes.

**Flujo:**
```
Usuario cancela pedido
    ↓
Items llegan con cantidad_reset = X
    ↓
determinarAccion() → 'resetear'
    ↓
resetearItem() libera X unidades de cada componente
```

**Qué se resetea:**
- **Recetas (SP)**: Libera porciones y productos de la receta × cantidad_reset
- **Subitems**: Libera porciones/productos/subrecetas × cantidad_reset × descuenta
- **Cantidad fija**: Libera carta_lista × cantidad_reset

**Ejemplo:**
```json
{
  "iditem": 1513,
  "isporcion": "SP",
  "cantidad_reset": 2,
  "subitems_selected": [...]
}
```

Si la receta tiene `cantidad_receta: 2` y hay un subitem con `descuenta: 5`:
- Receta: libera 2 × 2 = 4 porciones
- Subitem: libera 2 × 5 = 10 porciones

**Implementado en:**
- `item.analyzer.js` → `determinarAccion()` detecta `cantidad_reset > 0`
- `stock.reserva.service.js` → `resetearItem()` ejecuta la liberación

---

## Cleanup Nocturno

El job en `service/stock.cleanup.job.js` ejecuta:

```javascript
// A las 3 AM
StockReservaService.resetReservasInactivas(30);  // Reservas sin actividad > 30 min
```

Esto limpia reservas huérfanas (carritos abandonados).

---

## Cómo Testear

1. **Activar reservas:**
   ```bash
   # En .env
   USE_RESERVAS=true
   ```

2. **Verificar que está activo:**
   ```javascript
   const { StockReservaService } = require('./stock-reserva');
   console.log('Reservas activas:', StockReservaService.isEnabled());
   ```

3. **Probar flujo:**
   - Agregar item desde PWA → Ver logs `📦 [StockReserva]`
   - Verificar tabla `stock_reserva` → Debe tener registros
   - Quitar item → Cantidad en tabla debe disminuir
   - Confirmar pedido → Stock real debe descontarse

---

## Activación por Sede (Producción Gradual)

El sistema permite activar las reservas solo para sedes específicas, ideal para pruebas en producción.

### Archivo: `sede.cache.js`

**Funciones disponibles:**
```javascript
const { sedeUsaReservas, SedeCache } = require('./stock-reserva');

// Verificar si una sede usa reservas (con caché)
const usaReservas = await sedeUsaReservas(idsede);

// Invalidar caché de una sede (cuando se cambia configuración)
SedeCache.invalidarCacheSede(idsede);

// Invalidar todo el caché
SedeCache.invalidarTodoElCache();

// Ver estadísticas del caché
const stats = SedeCache.getEstadisticasCache();
```

**Configuración de caché:**
- TTL: 60 minutos (configurable en `CACHE_TTL_SEGUNDOS`)
- Evita consultas repetidas a la BD
- Si necesitas aplicar cambio inmediato: reiniciar servidor o llamar `SedeCache.invalidarCacheSede(idsede)`

### Flujo de Verificación

```
updateStock(op, item, idsede)
    ↓
¿USE_RESERVAS_GLOBAL = true?
    ↓ Sí
¿sede.use_reservas_stock = 1? (con caché)
    ↓ Sí
Usar sistema de reservas
    ↓ No
Usar flujo legacy (directo)
```

### SQL para Gestionar Sedes

```sql
-- Ver sedes con reservas activadas
SELECT idsede, nombre, use_reservas_stock FROM sede WHERE use_reservas_stock = 1;

-- Activar para una sede
UPDATE sede SET use_reservas_stock = 1 WHERE idsede = 13;

-- Desactivar para una sede
UPDATE sede SET use_reservas_stock = 0 WHERE idsede = 13;

-- Activar para varias sedes
UPDATE sede SET use_reservas_stock = 1 WHERE idsede IN (13, 16, 22);
```

---

## Notas Importantes

1. **Items de almacén (`isalmacen === 1`)** ahora SÍ usan el sistema de reservas
2. **Para almacén**: `idcarta_lista` ES el `idproducto_stock` directamente
3. **El toggle `USE_RESERVAS`** permite volver al comportamiento original fácilmente
4. **La respuesta siempre** mantiene el formato esperado por el código existente:
   ```javascript
   [{ cantidad, listItemsPorcion, listSubItems }]
   ```

---

## Productos de Almacén (`isalmacen === 1`)

Cuando un item tiene `isalmacen: 1`, se procesa como **producto_almacen**:

**Características:**
- El `idcarta_lista` del item ES el `idproducto_stock`
- El stock se obtiene de la tabla `producto_stock`
- La tabla `producto_stock` NO tiene `idsede`
- Se guarda en `stock_reserva.idproducto_stock`

**Ejemplo de item almacén:**
```json
{
  "cantidad": 15,
  "idcarta_lista": "3159",  // ← Este ES el idproducto_stock
  "iditem": "3250",
  "isalmacen": 1,
  "sumar": true
}
```

**Flujo:**
```
isalmacen: 1
    ↓
RecetaService.expandirAComponentes()
    ↓
tipo: 'producto_almacen', id: idcarta_lista (= idproducto_stock)
    ↓
ReservaRepository.agregar('producto_almacen', id, cantidad, idsede)
    ↓
INSERT INTO stock_reserva (idsede, idproducto_stock, cantidad) VALUES (?, ?, ?)
```

---

## Integración con Flujo Monitor

El flujo Monitor (desde `sockets.js` → `apiPwa_v1.js`) también usa el sistema de reservas:

**En `apiPwa_v1.js`:**
```javascript
const setItemCartaAfter = async function (op, item, idsede) {
    // Si el sistema de reservas está activo, usar handleStock.updateStock
    if (handleStock.USE_RESERVAS) {
        return handleStock.updateStock(op, item, idsede);
    }
    // FLUJO LEGACY: sin sistema de reservas
    // ... stored procedures originales
};
```

**En `sockets.js`:**
```javascript
// Pasar idsede al flujo Monitor
const rptCantidad = await apiPwa.setItemCartaAfter(0, item, dataCliente.idsede);
```
