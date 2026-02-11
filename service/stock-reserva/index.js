/**
 * index.js
 * 
 * Punto de entrada del módulo stock-reserva
 * Exporta todos los componentes SOLID
 */

const StockReservaService = require('./stock.reserva.service');
const ReservaRepository = require('./reserva.repository');
const ItemAnalyzer = require('./item.analyzer');
const RecetaService = require('./receta.service');
const CONFIG = require('./reserva.config');
const SedeCache = require('./sede.cache');

module.exports = {
    // Servicio principal (orquestador)
    StockReservaService,
    
    // Componentes individuales (para uso avanzado)
    ReservaRepository,
    ItemAnalyzer,
    RecetaService,
    
    // Caché de configuración por sede
    SedeCache,
    
    // Configuración
    CONFIG,
    
    // Shortcuts a métodos principales
    procesarItem: StockReservaService.procesarItem.bind(StockReservaService),
    confirmarPedido: StockReservaService.confirmarPedido.bind(StockReservaService),
    isEnabled: StockReservaService.isEnabled.bind(StockReservaService),
    
    // Verificar si una sede usa reservas
    sedeUsaReservas: SedeCache.sedeUsaReservas
};
