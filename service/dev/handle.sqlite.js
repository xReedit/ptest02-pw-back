/**
 * handle.sqlite.js
 * Clase para manejar almacenamiento temporal de stock usando SQLite
 * @author Piero Sanchez
 * @modified Cascade AI
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const errorManager = require('../error.manager');
const EventEmitter = require('events');

// Asegurarse de que existe el directorio para la base de datos
const dbDir = path.join(__dirname, '../data');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

class StockHandler extends EventEmitter {
    constructor(config = {}) {
        super();
        // Configuración por defecto
        this.config = {
            expireTime: config.expireTime || 10 * 60, // 10 minutos por defecto
            dbPath: config.dbPath || path.join(dbDir, 'temp_stock.db'),
            checkExpirationInterval: config.checkExpirationInterval || 10000 // Verificar expiración cada 10 segundos
        };

        try {
            // Inicializar SQLite
            this.db = new Database(this.config.dbPath);
            
            // Crear tablas si no existen
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS socket_pedido (
                    socket_id TEXT PRIMARY KEY,
                    pedido_id TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    expire_at INTEGER NOT NULL
                );
                
                CREATE TABLE IF NOT EXISTS pedido_items (
                    pedido_id TEXT NOT NULL,
                    item_id TEXT NOT NULL,
                    item_data TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    expire_at INTEGER NOT NULL,
                    PRIMARY KEY (pedido_id, item_id)
                );
                
                CREATE TABLE IF NOT EXISTS pedido_info (
                    pedido_id TEXT PRIMARY KEY,
                    info TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    expire_at INTEGER NOT NULL
                );
            `);
            
            // Preparar statements
            this.stmtGetPedidoBySocket = this.db.prepare('SELECT pedido_id FROM socket_pedido WHERE socket_id = ? AND expire_at > ?');
            this.stmtGetSocketByPedido = this.db.prepare('SELECT socket_id FROM socket_pedido WHERE pedido_id = ? AND expire_at > ?');
            this.stmtSetSocketPedido = this.db.prepare('INSERT OR REPLACE INTO socket_pedido (socket_id, pedido_id, created_at, expire_at) VALUES (?, ?, ?, ?)');
            this.stmtSetPedidoSocket = this.db.prepare('INSERT OR REPLACE INTO socket_pedido (socket_id, pedido_id, created_at, expire_at) VALUES (?, ?, ?, ?)');
            this.stmtGetItem = this.db.prepare('SELECT pedido_id, item_id, item_data, created_at, expire_at FROM pedido_items WHERE pedido_id = ? AND item_id = ? AND expire_at > ?');
            this.stmtSetItem = this.db.prepare('INSERT OR REPLACE INTO pedido_items (pedido_id, item_id, item_data, created_at, expire_at) VALUES (?, ?, ?, ?, ?)');
            this.stmtDeleteItem = this.db.prepare('DELETE FROM pedido_items WHERE pedido_id = ? AND item_id = ?');
            this.stmtGetPedidoItems = this.db.prepare('SELECT item_id, item_data FROM pedido_items WHERE pedido_id = ? AND expire_at > ?');
            this.stmtGetPedidoInfo = this.db.prepare('SELECT info FROM pedido_info WHERE pedido_id = ? AND expire_at > ?');
            this.stmtSetPedidoInfo = this.db.prepare('INSERT OR REPLACE INTO pedido_info (pedido_id, info, created_at, expire_at) VALUES (?, ?, ?, ?)');
            this.stmtUpdateExpire = this.db.prepare('UPDATE socket_pedido SET expire_at = ? WHERE socket_id = ?');
            this.stmtUpdateItemsExpire = this.db.prepare('UPDATE pedido_items SET expire_at = ? WHERE pedido_id = ?');
            this.stmtUpdatePedidoInfoExpire = this.db.prepare('UPDATE pedido_info SET expire_at = ? WHERE pedido_id = ?');
            this.stmtDeleteExpiredItems = this.db.prepare('DELETE FROM pedido_items WHERE expire_at <= ?');
            this.stmtDeleteExpiredSockets = this.db.prepare('DELETE FROM socket_pedido WHERE expire_at <= ?');
            this.stmtDeleteExpiredPedidoInfo = this.db.prepare('DELETE FROM pedido_info WHERE expire_at <= ?');
            
            // Iniciar limpieza periódica
            this.cleanupInterval = setInterval(() => this.cleanupExpired(), 60000); // Cada minuto
            
            // Iniciar verificación de expiración
            this.expirationInterval = setInterval(() => this.checkExpiration(), this.config.checkExpirationInterval);
            
            console.log('StockHandler inicializado con SQLite');
        } catch (error) {
            console.error('Error al inicializar SQLite:', error);
            throw new Error('No se pudo establecer conexión con SQLite: ' + error.message);
        }
    }

    /**
     * Verifica items próximos a expirar y emite eventos
     */
    checkExpiration() {
        const now = Date.now();
        const expirationWindow = now + 30000; // Verificar items que expirarán en los próximos 30 segundos
        
        try {
            // Buscar pedidos próximos a expirar
            const expiringItems = this.db.prepare(`
                SELECT pi.pedido_id, pi.item_id, pi.item_data, pi.expire_at, sp.socket_id
                FROM pedido_items pi
                JOIN socket_pedido sp ON pi.pedido_id = sp.pedido_id
                WHERE pi.expire_at > ? AND pi.expire_at <= ?
            `).all(now, expirationWindow);
            
            // Agrupar items por pedido
            const itemsByPedido = {};
            for (const item of expiringItems) {
                if (!itemsByPedido[item.pedido_id]) {
                    itemsByPedido[item.pedido_id] = [];
                }
                
                let itemData = JSON.parse(item.item_data);
                // Preparar el item para restauración
                
                // Obtener la cantidad seleccionada del item
                const cantidadSeleccionada = itemData.cantidad_seleccionada || 1;
                itemData.cantidad_reset = cantidadSeleccionada;
                itemData.cantidadSumar = null;
                
                // Manejar subitems si existen
                if (itemData.subitems_selected && Array.isArray(itemData.subitems_selected)) {
                    itemData.subitems_selected.forEach(subitem => {
                        // Asegurarse de que cada subitem tenga la cantidad correcta para restaurar
                        const cantSubitem = subitem.cantidad_selected || 1;
                        subitem.cantidad_reset = cantSubitem;
                        subitem.cantidadSumar = null;
                    });
                }
                
                itemsByPedido[item.pedido_id].push({
                    item: itemData,
                    socketId: item.socket_id,
                    expireAt: item.expire_at
                });
            }
            
            // Emitir eventos para cada pedido
            for (const [pedidoId, items] of Object.entries(itemsByPedido)) {
                if (items.length > 0) {
                    this.emit('items-expiring', {
                        pedidoId,
                        items: items.map(i => i.item),
                        socketId: items[0].socketId,
                        expireAt: items[0].expireAt
                    });
                }
            }
        } catch (error) {
            console.error('Error al verificar items próximos a expirar:', error);
        }
    }
    
    /**
     * Limpia registros expirados
     */
    cleanupExpired() {
        const now = Date.now();
        try {
            // Primero obtener los items que van a expirar para emitir evento
            const expiredItems = this.db.prepare(`
                SELECT pi.pedido_id, pi.item_id, pi.item_data, sp.socket_id
                FROM pedido_items pi
                JOIN socket_pedido sp ON pi.pedido_id = sp.pedido_id
                WHERE pi.expire_at <= ?
            `).all(now);
            
            // Agrupar items por pedido
            const itemsByPedido = {};
            for (const item of expiredItems) {
                if (!itemsByPedido[item.pedido_id]) {
                    itemsByPedido[item.pedido_id] = [];
                }
                
                let itemData = JSON.parse(item.item_data);
                // Preparar el item para restauración
                
                // Obtener la cantidad seleccionada del item
                const cantidadSeleccionada = itemData.cantidad_seleccionada || 1;
                itemData.cantidad_reset = cantidadSeleccionada;
                itemData.cantidadSumar = null;
                
                // Manejar subitems si existen
                if (itemData.subitems_selected && Array.isArray(itemData.subitems_selected)) {
                    itemData.subitems_selected.forEach(subitem => {
                        // Asegurarse de que cada subitem tenga la cantidad correcta para restaurar
                        const cantSubitem = subitem.cantidad_selected || 1;
                        subitem.cantidad_reset = cantSubitem;
                        subitem.cantidadSumar = null;
                    });
                }
                
                itemsByPedido[item.pedido_id].push({
                    item: itemData,
                    socketId: item.socket_id
                });
            }
            
            // Emitir eventos para cada pedido
            for (const [pedidoId, items] of Object.entries(itemsByPedido)) {
                if (items.length > 0) {
                    this.emit('items-expired', {
                        pedidoId,
                        items: items.map(i => i.item),
                        socketId: items[0].socketId
                    });
                }
            }
            
            // Eliminar registros expirados
            this.stmtDeleteExpiredItems.run(now);
            this.stmtDeleteExpiredSockets.run(now);
            this.stmtDeleteExpiredPedidoInfo.run(now);
        } catch (error) {
            console.error('Error al verificar expiración:', error);
        }
    }

    /**
     * Reserva o restaura stock para un item usando el socketId como identificador principal
     * @param {Object} item - Item a reservar o restaurar
     * @param {String} socketId - ID del socket que está reservando
     * @returns {Promise<Object>} - Resultado de la operación con los datos del item
     */
    async reservarStock(item, socketId) {
        try {
            const now = Date.now();
            const expireAt = now + this.config.expireTime;
            
            // Obtener el pedido asociado al socket
            let pedidoId = this.stmtGetPedidoBySocket.get(socketId, now)?.pedido_id;
            
            // Si no hay pedido, crear uno nuevo
            if (!pedidoId) {
                pedidoId = `pedido_${now}_${Math.floor(Math.random() * 1000)}`;
                this.stmtSetSocketPedido.run(socketId, pedidoId, now, expireAt);
            }
            
            // Identificador único para el item
            const itemId = `${item.iditem || ''}:${item.idcarta_lista || ''}:${item.isporcion || ''}`;
            const existingItem = this.stmtGetItem.get(pedidoId, itemId, now);
            
            
            // Verificar si estamos sumando o restando
            if (item.sumar === false) {
                // Estamos restando el item (recuperando stock)
                
                if (existingItem) {
                    const cantidadStockSeleccionado = existingItem.item_data.cantidadSumar;
                    existingItem.item_data.cantidadSumar = cantidadStockSeleccionado + item.cantidadSumar;
                    const updatedItemData = JSON.stringify(existingItem.item_data);
                    this.stmtSetItem.run(pedidoId, itemId, updatedItemData, now, expireAt);                    
                } else {                    
                    this.stmtSetItem.run(pedidoId, itemId, updatedItemData, now, expireAt);
                }
                                
            } else {
                // Estamos sumando el item (reservando stock)
                // Verificar si el item ya existe en la base de datos
                
                
                if (existingItem) {
                    // El item existe, actualizar la cantidad
                    const itemData = JSON.parse(existingItem.item_data);
                    const cantidadActual = itemData.cantidadSumar || 1;
                    const cantidadSumar = item.cantidadSumar || 1;
                    
                    // Actualizar la cantidad en el item
                    item.cantidadSumar = cantidadActual + cantidadSumar;
                    
                    // Guardar el item actualizado
                    const updatedItemData = JSON.stringify(item);
                    this.stmtSetItem.run(pedidoId, itemId, updatedItemData, now, expireAt);
                    
                    console.log(`Stock actualizado para ${itemId}: ${cantidadActual} -> ${item.cantidadSumar} (sumar=true)`);
                } else {
                    // El item no existe, crear uno nuevo
                    const itemData = JSON.stringify(item);
                    this.stmtSetItem.run(pedidoId, itemId, itemData, now, expireAt);
                    
                    console.log(`Nuevo stock reservado para ${itemId}: ${item.cantidadSumar || 1} (sumar=true)`);
                }
                
                return {
                    success: true,
                    message: 'Stock reservado correctamente',
                    item: item,
                    pedidoId: pedidoId,
                    expireAt: expireAt,
                    accion: 'reservado'
                };
            }
        } catch (error) {
            console.error('Error al reservar stock:', error);
            errorManager.logError({
                incidencia: {
                    message: error.toString(),
                    data: { item, socketId }
                },
                origen: 'StockHandler.reservarStock'
            });
            return { success: false, message: `Error: ${error.message}` };
        }
    }

    /**
     * Extiende el tiempo de expiración de un pedido
     * @param {String} socketId - ID del socket asociado al pedido
     * @returns {Promise<Object>} - Resultado de la operación
     */
    async extenderTiempo(socketId) {
        try {
            if (!socketId) {
                return { success: false, message: 'Se requiere socketId' };
            }

            const now = Date.now();
            const newExpireAt = now + (this.config.expireTime * 1000);
            
            // Obtener ID del pedido asociado al socket
            const pedidoId = this.stmtGetPedidoBySocket.get(socketId, now)?.pedido_id;
            
            if (!pedidoId) {
                return { success: false, message: 'No se encontró pedido asociado al socket' };
            }
            
            // Actualizar tiempo de expiración
            this.stmtUpdateExpire.run(newExpireAt, socketId);
            this.stmtUpdateItemsExpire.run(newExpireAt, pedidoId);
            this.stmtUpdatePedidoInfoExpire.run(newExpireAt, pedidoId);
            
            return {
                success: true,
                message: 'Tiempo extendido correctamente',
                nuevoTiempo: this.config.expireTime
            };
        } catch (error) {
            console.error('Error al extender tiempo:', error);
            errorManager.logError({
                incidencia: {
                    message: error.toString(),
                    data: { socketId }
                },
                origen: 'StockHandler.extenderTiempo'
            });
            return { success: false, message: `Error: ${error.message}` };
        }
    }

    /**
     * Obtener pedido activo para un socket
     * @param {String} socketId - ID del socket
     * @returns {Promise<String|null>} - ID del pedido o null si no existe
     */
    async getPedidoBySocketId(socketId) {
        try {
            const now = Date.now();
            return this.stmtGetPedidoBySocket.get(socketId, now)?.pedido_id || null;
        } catch (error) {
            console.error('Error al obtener pedido por socketId:', error);
            return null;
        }
    }

    /**
     * Cerrar la conexión a SQLite
     */
    async close() {
        try {
            // Detener intervalos
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
            }
            if (this.expirationInterval) {
                clearInterval(this.expirationInterval);
            }
            
            // Cerrar base de datos
            if (this.db) {
                this.db.close();
                console.log('Conexión a SQLite cerrada');
            }
            return true;
        } catch (error) {
            console.error('Error al cerrar conexión SQLite:', error);
            return false;
        }
    }
}

module.exports = StockHandler;
