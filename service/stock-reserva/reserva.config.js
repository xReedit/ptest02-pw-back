/**
 * reserva.config.js
 * 
 * Configuración centralizada del sistema de reservas
 * Principio SOLID: Single Responsibility - Solo configuración
 */

const CONFIG = {
    // Minutos sin actividad para considerar reserva huérfana
    CLEANUP_MINUTOS_INACTIVIDAD: 30,
    
    // Si es true, TODAS las sedes usan reservas (ignora use_reservas_stock de la BD)
    // Si es false, se verifica por sede (campo use_reservas_stock en tabla sede)
    // Cambiar a true cuando el sistema esté probado y listo para producción general
    USE_RESERVAS_TODAS_SEDES: false,
    
    // Tiempo de caché para configuración de sedes (en segundos)
    // 3600 = 60 minutos (no se cambia frecuentemente)
    CACHE_TTL_SEGUNDOS: 3600,
    
    // Tipos de stock soportados
    TIPOS: {
        PORCION: 'porcion',
        PRODUCTO: 'producto',
        PRODUCTO_ALMACEN: 'producto_almacen',
        CARTA_LISTA: 'carta_lista'
    },

    // Mapeo de tipos a columnas de BD
    COLUMNAS: {
        porcion: {
            id: 'idporcion',
            tabla: 'porcion',
            stock: 'stock',
            pk: 'idporcion'
        },
        producto: {
            id: 'idproducto_stock',
            tabla: 'producto_stock',
            stock: 'stock',
            pk: 'idproducto_stock'
        },
        carta_lista: {
            id: 'idcarta_lista',
            tabla: 'carta_lista',
            stock: 'cantidad',
            pk: 'idcarta_lista'
        },
        producto_almacen: {
            id: 'idproducto_stock',
            tabla: 'producto_stock',
            stock: 'stock',
            pk: 'idproducto_stock'
        }
    }
};

module.exports = CONFIG;
