const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requiereAutenticacion } = require('../middlewares/autenticacion');
const catalogos = require('../controllers/catalogos.controller');

const router = Router();

// GET /api/obras-sociales  (cualquier usuario logueado)
router.get('/', requiereAutenticacion, asyncHandler(catalogos.listarObrasSociales));

module.exports = router;
