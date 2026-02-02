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
    USE_RESERVAS: process.env.USE_RESERVAS === 'true' || false,  // Toggle
    TIPOS: { PORCION, PRODUCTO, CARTA_LISTA },  // Tipos soportados
    COLUMNAS: { ... }  // Mapeo de tipos a columnas de BD
};
```

**Cómo activar reservas:**
- En `.env`: `USE_RESERVAS=true`
- O cambiar `USE_RESERVAS: true` directamente

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

**Tipos soportados:** `'porcion'`, `'producto'`, `'carta_lista'`

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

**Fuentes de subitems que maneja:**
1. `item.subitems_selected` (objeto o array)
2. `item.subitems_view` (estructura con grupos y opciones)
3. `item.subitems_selected_array`

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
    // Items de almacén siempre van directo
    if (item.isalmacen === 1) {
        return await processAlmacenItem(op, item);
    }

    // Sistema de reservas
    if (USE_RESERVAS) {
        const resultado = await StockReservaService.procesarItem(item, idsede);
        return [{ cantidad: item.cantidad, listItemsPorcion: resultado.listItemsPorcion }];
    }

    // Modo directo (original)
    // ... código existente
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

## Notas Importantes

1. **Items de almacén (`isalmacen === 1`)** siempre van directo, nunca usan reservas
2. **El toggle `USE_RESERVAS`** permite volver al comportamiento original fácilmente
3. **La respuesta siempre** mantiene el formato esperado por el código existente:
   ```javascript
   [{ cantidad, listItemsPorcion, listSubItems }]
   ```
