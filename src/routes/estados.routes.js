const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requiereAutenticacion } = require('../middlewares/autenticacion');
const catalogos = require('../controllers/catalogos.controller');

const router = Router();

// GET /api/estados  (cualquier usuario logueado: llena el desplegable del alta)
router.get('/', requiereAutenticacion, asyncHandler(catalogos.listarEstados));

module.exports = router;
