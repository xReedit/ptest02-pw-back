# 🚀 Plan de Implementación: Sistema Centralizado de Stock de Porciones

## ✅ Estado Actual

**Archivos creados (NO MODIFICAN CÓDIGO EXISTENTE):**

```
service/
  ├── stock.porcion.service.js          ✅ Servicio principal con transacciones ACID
  ├── STOCK_PORCION_INTEGRATION.md      ✅ Guía de integración detallada
  └── porcion.movements.service.js      ⚠️  (Mantener pero no usar más)

test/
  └── stock-porcion.test.js             ✅ Suite de tests con pruebas de concurrencia

sql/
  └── indices_stock_porcion.sql         ✅ Índices optimizados para BD
```

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

### FASE 1: PREPARACIÓN (Sin downtime) ⏱️ 30 minutos

- [ ] **1.1. Backup de base de datos**
  ```bash
  mysqldump -u user -p restobar > backup_antes_indices_$(date +%Y%m%d).sql
  ```

- [ ] **1.2. Ejecutar índices en BD**
  ```bash
  mysql -u user -p restobar < sql/indices_stock_porcion.sql
  ```
  **⚠️ IMPORTANTE:** Ejecutar en horario de baja demanda

- [ ] **1.3. Validar índices creados**
  ```sql
  USE restobar;
  SHOW INDEX FROM porcion;
  SHOW INDEX FROM item_ingrediente;
  SHOW INDEX FROM porcion_historial;
  ```

- [ ] **1.4. Verificar configuración de pool de conexiones**
  ```javascript
  // En config/database.js
  pool: {
      max: 20,        // Mínimo 20 para 50 tx/seg
      min: 5,
      acquire: 30000,
      idle: 10000
  }
  ```

---

### FASE 2: TESTING (En desarrollo) ⏱️ 1 hora

- [ ] **2.1. Ejecutar tests unitarios**
  ```bash
  node test/stock-porcion.test.js
  ```
  **Esperado:**
  - ✅ Todos los tests de validación pasan
  - ✅ Test de actualización simple exitoso
  - ✅ Test de concurrencia > 80% éxito
  - ⚠️ Si fallan, revisar conexión a BD

- [ ] **2.2. Ejecutar stress test (opcional)**
  ```javascript
  // En stock-porcion.test.js descomentar:
  // resultados.push(await test4_StressTest());
  ```

- [ ] **2.3. Probar con datos reales en DEV**
  ```javascript
  const StockPorcionService = require('./service/stock.porcion.service');
  
  // Probar con un item real que tenga porciones
  const resultado = await StockPorcionService.actualizarStockConHistorial({
      iditem: 1290,  // Cambiar por ID real
      cantidadProducto: 1,
      idsede: 1,
      idusuario: 103,
      tipoMovimiento: 'VENTA',
      esReset: false
  });
  
  console.log(resultado);
  ```

---

### FASE 3: INTEGRACIÓN GRADUAL (Con rollback) ⏱️ 2-4 horas

#### **Opción A: Feature Flag (Recomendado para SaaS)**

- [ ] **3.1. Crear feature flag en config**
  ```javascript
  // En _config.js o archivo de configuración
  module.exports = {
      // ... configuración existente
      features: {
          useNewStockPorcionService: false  // Iniciar desactivado
      }
  };
  ```

- [ ] **3.2. Integrar con flag en item.service.v1.js**
  ```javascript
  const config = require('../_config');
  const StockPorcionService = require('./stock.porcion.service');
  
  // En processItem() después de la línea 68
  if (config.features.useNewStockPorcionService) {
      // Usar nuevo servicio
      if (item.isporcion === 'SP' || item.tieneRecetaPorciones) {
          const resultado = await StockPorcionService.actualizarStockConHistorial({
              iditem: item.iditem,
              cantidadProducto: item.cantidadSumar || 1,
              idsede: idsede,
              idusuario: item.idusuario || 1,
              idpedido: item.idpedido,
              tipoMovimiento: item.cantidad_reset > 0 ? 'ENTRADA' : 'VENTA',
              esReset: item.cantidad_reset > 0
          });
          
          if (!resultado.success) {
              console.error('Error en nuevo servicio:', resultado.error);
              // Fallback al método anterior
          }
      }
  } else {
      // Mantener código anterior (líneas 65-76)
      porcionMovementsService.guardarMovimientoPorcion({...});
  }
  ```

- [ ] **3.3. Activar para sede piloto**
  ```javascript
  // Activar solo para una sede específica
  useNewStockPorcionService: process.env.SEDE_ID === '1'
  ```

- [ ] **3.4. Monitorear logs por 24-48 horas**
  ```bash
  tail -f logs/error.log | grep "StockPorcionService"
  ```

- [ ] **3.5. Si todo OK, activar para todas las sedes**
  ```javascript
  useNewStockPorcionService: true
  ```

#### **Opción B: Integración Directa (Mayor riesgo)**

- [ ] **3.1. Hacer cambios en item.service.v1.js**
  - Ver detalles en `STOCK_PORCION_INTEGRATION.md` sección "PASO 1"

- [ ] **3.2. Hacer cambios en processItemPorcion()**
  - Ver detalles en `STOCK_PORCION_INTEGRATION.md` sección "PASO 2"

- [ ] **3.3. Hacer cambios en processAllItemSubitemSeleted()**
  - Ver detalles en `STOCK_PORCION_INTEGRATION.md` sección "PASO 3"

---

### FASE 4: VALIDACIÓN EN PRODUCCIÓN ⏱️ 24-48 horas

- [ ] **4.1. Monitorear métricas de performance**
  ```javascript
  // Agregar logging temporal
  console.log('[STOCK] Tiempo ejecución:', resultado.ejecutionTime, 'ms');
  
  // Alertar si > 1000ms
  if (resultado.ejecutionTime > 1000) {
      console.warn('[STOCK] ⚠️ Operación lenta:', resultado);
  }
  ```

- [ ] **4.2. Verificar integridad de datos**
  ```sql
  -- Comparar registros antes y después
  SELECT COUNT(*) FROM porcion_historial 
  WHERE fecha_date = CURDATE();
  
  -- Verificar que no haya idporcion = 0
  SELECT COUNT(*) FROM porcion_historial 
  WHERE idporcion = 0 AND fecha_date = CURDATE();
  ```

- [ ] **4.3. Monitorear deadlocks**
  ```sql
  -- Ejecutar cada hora
  SHOW ENGINE INNODB STATUS;
  ```

- [ ] **4.4. Revisar tasa de reintentos**
  ```javascript
  // Agregar contador de reintentos
  let totalReintentos = 0;
  
  if (resultado.attempt > 1) {
      totalReintentos++;
      console.log('[STOCK] Reintento detectado:', resultado.attempt);
  }
  
  // Alertar si > 10% requieren reintentos
  ```

---

### FASE 5: LIMPIEZA (Después de 1 semana estable) ⏱️ 1 hora

- [ ] **5.1. Eliminar código antiguo**
  ```javascript
  // Eliminar líneas 65-76 en item.service.v1.js
  // Eliminar líneas 446-469 en processAllItemSubitemSeleted()
  ```

- [ ] **5.2. Deprecar porcion.movements.service.js**
  ```javascript
  // Agregar al inicio del archivo:
  /**
   * @deprecated Usar stock.porcion.service.js en su lugar
   * Este archivo se mantiene solo para compatibilidad temporal
   */
  ```

- [ ] **5.3. Actualizar documentación del equipo**

- [ ] **5.4. Remover feature flags**
  ```javascript
  // Ya no es necesario el flag
  delete config.features.useNewStockPorcionService;
  ```

---

## 🎯 MÉTRICAS DE ÉXITO

### KPIs a monitorear:

1. **Performance**
   - ✅ 95% de transacciones < 500ms
   - ✅ 99% de transacciones < 1000ms
   - ✅ Throughput > 50 tx/seg en hora punta

2. **Confiabilidad**
   - ✅ 0 inconsistencias (stock != historial)
   - ✅ Tasa de deadlocks < 1%
   - ✅ Tasa de reintentos < 5%

3. **Integridad de datos**
   - ✅ 0 registros con idporcion = 0
   - ✅ 100% de movimientos registrados en historial
   - ✅ Stock nunca negativo (salvo configuración)

---

## ⚠️ PLAN DE ROLLBACK

### Si algo sale mal:

1. **Rollback inmediato (< 5 minutos)**
   ```javascript
   // Desactivar feature flag
   config.features.useNewStockPorcionService = false;
   
   // O comentar las llamadas al nuevo servicio
   // await StockPorcionService.actualizarStockConHistorial({...});
   ```

2. **Restaurar base de datos (último recurso)**
   ```bash
   mysql -u user -p restobar < backup_antes_indices_YYYYMMDD.sql
   ```

3. **Eliminar índices si causan problemas**
   ```sql
   DROP INDEX idx_porcion_lock ON porcion;
   DROP INDEX idx_item_ingrediente_receta ON item_ingrediente;
   -- etc.
   ```

---

## 📞 CONTACTOS Y SOPORTE

### En caso de problemas:

1. **Revisar logs:**
   ```bash
   tail -f logs/error.log
   tail -f logs/notifications.log
   ```

2. **Ejecutar diagnóstico rápido:**
   ```bash
   node test/stock-porcion.test.js
   ```

3. **Verificar BD:**
   ```sql
   SHOW PROCESSLIST;
   SHOW ENGINE INNODB STATUS;
   ```

---

## 📚 RECURSOS ADICIONALES

- **Documentación completa:** `service/STOCK_PORCION_INTEGRATION.md`
- **Tests:** `test/stock-porcion.test.js`
- **Índices SQL:** `sql/indices_stock_porcion.sql`
- **Código del servicio:** `service/stock.porcion.service.js`

---

## 🎓 CAPACITACIÓN DEL EQUIPO

### Conceptos clave a entender:

1. **Transacciones ACID**
   - Atomicidad: Todo o nada
   - Consistencia: Datos válidos siempre
   - Isolation: No interferencia entre transacciones
   - Durability: Persistencia garantizada

2. **Locks pesimistas (SELECT FOR UPDATE)**
   - Previenen race conditions
   - Bloquean fila hasta commit
   - Pueden causar deadlocks

3. **Retry logic**
   - Automático en caso de deadlock
   - Máximo 3 intentos
   - Delay incremental

4. **Monitoreo de performance**
   - Tiempo de ejecución
   - Throughput
   - Tasa de reintentos

---

**Versión:** 1.0.0  
**Fecha:** 2025-09-30  
**Autor:** Sistema de desarrollo  
**Estado:** ✅ Listo para implementación gradual
