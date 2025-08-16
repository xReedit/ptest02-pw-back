/**
 * stock.service.js
 * Servicio dedicado para el manejo de stock con sistema de colas
 */

const handleStockV1 = require('../handle.stock.v1');
const ResponseService = require('../query.service');

// Importar el gestor de errores o crearlo si no existe
let errorManager;
try {
    errorManager = require('../error.manager');
} catch (e) {
    // Si no existe, creamos un objeto básico para loggear errores
    errorManager = {
        logError: (data) => {
            console.error('Error registrado:', JSON.stringify(data));
        }
    };
}

/**
 * Clase para el manejo de stock
 * Implementa un enfoque distribuido para procesar actualizaciones de stock
 * Diseñado para manejar alto volumen (30+ productos/segundo)
 */
class StockService {
    constructor() {
        // En producción, estas propiedades se reemplazarían por conexiones a servicios externos
        // como Redis para bloqueos distribuidos y RabbitMQ/Kafka para mensajería
        this.locks = new Map(); // Simulación de bloqueos distribuidos
        this.jobResults = new Map(); // Resultados de operaciones (en prod: Redis/Memcached)
        this.jobCounter = 0; // Contador para IDs (en prod: secuencia en base de datos)
        
        // Configuración para manejo de concurrencia
        this.lockTimeout = 5000; // ms antes de que un bloqueo expire
        this.retryDelay = 50; // ms entre reintentos de bloqueo
        this.maxRetries = 5; // máximo número de reintentos
    }

    /**
     * Genera un ID único para cada operación
     * @returns {String} - ID único
     */
    generateJobId() {
        this.jobCounter++;
        return `job_${Date.now()}_${this.jobCounter}`;
    }

    /**
     * Procesa la cola de trabajos
     */
    async processQueue() {
        if (this.processing || this.queue.length === 0 || this.activeJobs >= this.maxConcurrentJobs) {
            return;
        }

        this.processing = true;
        this.activeJobs++;

        try {
            const job = this.queue.shift();
            const { id, op, item, idsede, resolve, reject } = job;

            console.log(`Procesando trabajo ${id}, quedan ${this.queue.length} en cola`);

            try {
                // Usar la versión refactorizada de updateStock
                const result = await handleStockV1.updateStock(op, item, idsede);
                
                // Guardar el resultado
                this.jobResults.set(id, {
                    status: 'completed',
                    result,
                    timestamp: new Date().toISOString()
                });
                
                resolve(result);
            } catch (error) {
                // Guardar el error
                this.jobResults.set(id, {
                    status: 'failed',
                    error: error.toString(),
                    timestamp: new Date().toISOString()
                });
                
                reject(error);
            }
        } finally {
            this.activeJobs--;
            this.processing = false;
            
            // Limpiar resultados antiguos (más de 1 hora)
            this.cleanOldResults();
            
            // Continuar procesando la cola
            if (this.queue.length > 0) {
                setImmediate(() => this.processQueue());
            }
        }
    }

    /**
     * Limpia resultados antiguos para evitar fugas de memoria
     */
    cleanOldResults() {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        
        for (const [id, jobInfo] of this.jobResults.entries()) {
            const timestamp = new Date(jobInfo.timestamp).getTime();
            if (timestamp < oneHourAgo) {
                this.jobResults.delete(id);
            }
        }
    }

    /**
     * Consulta stock disponible
     * @param {String} itemId - ID del item
     * @param {String} sedeId - ID de la sede
     * @returns {Promise} - Stock disponible
     */
    async getStock(itemId, sedeId) {
        try {
            // Sanitizar parámetros
            const safeItemId = itemId ? itemId.toString() : '';
            const safeSedeId = sedeId ? sedeId.toString() : '';
            
            if (!safeItemId || !safeSedeId) {
                throw new Error('ID de item o sede inválido');
            }
            
            const query = `CALL procedure_get_stock('${safeItemId}', ${safeSedeId})`;
            return await handleStockV1.retryOperation(() => ResponseService.emitirRespuestaSP(query));
        } catch (error) {
            errorManager.logError({
                incidencia: { 
                    message: error.toString(), 
                    data: { itemId, sedeId } 
                },
                origen: 'getStock'
            });
            throw error;
        }
    }
    
    /**
     * Actualizar stock (añade a la cola)
     * @param {String} op - Operación a realizar
     * @param {Object} item - Item a actualizar
     * @param {String} idsede - ID de la sede
     * @returns {Promise} - Resultado de la actualización
     */
    async updateStock(op, item, idsede) {
        // Validación básica
        if (!item || !item.idcarta_lista) {
            throw new Error("Datos de item inválidos");
        }
        
        // Sanitizar el objeto
        const sanitizedItem = handleStockV1.sanitizeObject(item);
        
        // Generar ID único para el trabajo
        const jobId = this.generateJobId();
        
        // Crear una promesa que se resolverá cuando se complete el trabajo
        const jobPromise = new Promise((resolve, reject) => {
            // Añadir trabajo a la cola
            this.queue.push({
                id: jobId,
                op,
                item: sanitizedItem,
                idsede,
                timestamp: new Date().toISOString(),
                resolve,
                reject
            });
            
            // Iniciar procesamiento si no está en curso
            this.processQueue();
        });
        
        // Devolver información del trabajo
        return {
            status: 'queued',
            jobId,
            message: 'Solicitud aceptada para procesamiento'
        };
    }
    
    /**
     * Actualiza el stock de forma síncrona con manejo de concurrencia
     * @param {String} op - Operación a realizar
     * @param {Object} item - Item a actualizar
     * @param {String} idsede - ID de la sede
     * @returns {Promise<Object>} - Resultado de la operación
     */
    async updateStockSync(op, item, idsede) {
        try {
            // Identificar el recurso a bloquear
            const resourceId = `stock_${item.idcarta_lista || item.iditem}_${idsede}`;
            const requesterId = `sync_${Date.now()}`;
            
            // Intentar adquirir un bloqueo distribuido
            const lockAcquired = await this._acquireLock(resourceId, requesterId);
            
            if (!lockAcquired) {
                throw new Error(`No se pudo adquirir bloqueo para el recurso ${resourceId}`);
            }
            
            try {
                // Utilizar la implementación mejorada
                return await handleStockV1.updateStock(op, item, idsede);
            } finally {
                // Liberar el bloqueo
                this._releaseLock(resourceId, requesterId);
            }
        } catch (error) {
            console.error('Error al actualizar stock de forma síncrona:', error);
            
            // Registrar el error
            if (this.errorManager) {
                this.errorManager.logError({
                    incidencia: {
                        message: error.message || error.toString(),
                        data: { item_process: item }
                    },
                    origen: 'updateStockSync'
                });
            }
            
            throw error;
        }
    }
    
    /**
     * Reservar stock (para prevenir sobreventa)
     * @param {String} itemId - ID del item
     * @param {Number} quantity - Cantidad a reservar
     * @param {String} sedeId - ID de la sede
     * @param {String} sessionId - ID de la sesión
     * @returns {Promise} - Resultado de la reserva
     */
    async reserveStock(itemId, quantity, sedeId, sessionId) {
        try {
            // Sanitizar parámetros
            const safeItemId = itemId ? itemId.toString() : '';
            const safeQuantity = quantity ? parseInt(quantity, 10) : 0;
            const safeSedeId = sedeId ? sedeId.toString() : '';
            const safeSessionId = sessionId ? sessionId.toString() : '';
            
            if (!safeItemId || safeQuantity <= 0 || !safeSedeId || !safeSessionId) {
                throw new Error('Parámetros inválidos para reserva de stock');
            }
            
            // Aquí se implementaría la lógica de reserva
            // Por ahora, simularemos una respuesta exitosa
            return {
                success: true,
                message: 'Stock reservado correctamente',
                data: {
                    itemId: safeItemId,
                    quantity: safeQuantity,
                    sedeId: safeSedeId,
                    sessionId: safeSessionId,
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            errorManager.logError({
                incidencia: { 
                    message: error.toString(), 
                    data: { itemId, quantity, sedeId, sessionId } 
                },
                origen: 'reserveStock'
            });
            throw error;
        }
    }
    
    /**
     * Confirmar reserva (cuando se completa la compra)
     * @param {String} sessionId - ID de la sesión
     * @returns {Promise} - Resultado de la confirmación
     */
    async confirmReservation(sessionId) {
        try {
            // Sanitizar parámetros
            const safeSessionId = sessionId ? sessionId.toString() : '';
            
            if (!safeSessionId) {
                throw new Error('ID de sesión inválido');
            }
            
            // Aquí se implementaría la lógica de confirmación
            // Por ahora, simularemos una respuesta exitosa
            return {
                success: true,
                message: 'Reserva confirmada correctamente',
                data: {
                    sessionId: safeSessionId,
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            errorManager.logError({
                incidencia: { 
                    message: error.toString(), 
                    data: { sessionId } 
                },
                origen: 'confirmReservation'
            });
            throw error;
        }
    }
    
    /**
     * Liberar reserva (cuando se cancela la compra)
     * @param {String} sessionId - ID de la sesión
     * @returns {Promise} - Resultado de la liberación
     */
    async releaseReservation(sessionId) {
        try {
            // Sanitizar parámetros
            const safeSessionId = sessionId ? sessionId.toString() : '';
            
            if (!safeSessionId) {
                throw new Error('ID de sesión inválido');
            }
            
            // Aquí se implementaría la lógica de liberación
            // Por ahora, simularemos una respuesta exitosa
            return {
                success: true,
                message: 'Reserva liberada correctamente',
                data: {
                    sessionId: safeSessionId,
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            errorManager.logError({
                incidencia: { 
                    message: error.toString(), 
                    data: { sessionId } 
                },
                origen: 'releaseReservation'
            });
            throw error;
        }
    }
}

// Exportar una instancia única del servicio
module.exports = new StockService();
