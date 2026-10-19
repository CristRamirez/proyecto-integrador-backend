const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requiereAutenticacion } = require('../middlewares/autenticacion');
const catalogos = require('../controllers/catalogos.controller');

const router = Router();

router.get('/', requiereAutenticacion, asyncHandler(catalogos.listarMediosPago));

module.exports = router;
