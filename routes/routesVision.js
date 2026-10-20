// routesVision.js — puente /vision/v1 para Cámaras IA (repo papaya-vision).
// Todas las rutas detrás de verificarVision: clave x-api-key + IPs del servidor Go.

const express = require('express');
const { verificarVision } = require('../middleware/vision.auth');
const vision = require('../controllers/vision');
const { ReE } = require('../service/uitl.service');

const router = express.Router();

router.use(verificarVision);
router.get('/cuentas', vision.cuentas);
router.get('/pedidos', vision.pedidos);

// Al final: ruta o método que no existe, ya con clave válida → sobre del contrato
// (sin esto respondería el 404 genérico de app.js). Las rutas nuevas van ARRIBA.
router.use((req, res) => ReE(res, 'no_encontrado', 404));

module.exports = router;
