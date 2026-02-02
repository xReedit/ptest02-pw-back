/**
 * reserva.config.js
 * 
 * Configuración centralizada del sistema de reservas
 * Principio SOLID: Single Responsibility - Solo configuración
 */

const CONFIG = {
    // Minutos sin actividad para considerar reserva huérfana
    CLEANUP_MINUTOS_INACTIVIDAD: 30,
    
    // Toggle para activar/desactivar sistema de reservas
    USE_RESERVAS: process.env.USE_RESERVAS === 'true' || false,
    
    // Tipos de stock soportados
    TIPOS: {
        PORCION: 'porcion',
        PRODUCTO: 'producto',
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
        }
    }
};

module.exports = CONFIG;
