// routesVision.js — puente /vision/v1 para Cámaras IA (repo papaya-vision).
// Todas las rutas detrás de verificarVision: clave x-api-key + IPs del servidor Go.

const express = require('express');
const { verificarVision } = require('../middleware/vision.auth');
const vision = require('../controllers/vision');

const router = express.Router();

router.use(verificarVision);
router.get('/cuentas', vision.cuentas);
router.get('/pedidos', vision.pedidos);

module.exports = router;
