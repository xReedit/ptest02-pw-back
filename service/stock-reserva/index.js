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

module.exports = {
    // Servicio principal (orquestador)
    StockReservaService,
    
    // Componentes individuales (para uso avanzado)
    ReservaRepository,
    ItemAnalyzer,
    RecetaService,
    
    // Configuración
    CONFIG,
    
    // Shortcut al método principal
    procesarItem: StockReservaService.procesarItem.bind(StockReservaService),
    isEnabled: StockReservaService.isEnabled.bind(StockReservaService)
};
