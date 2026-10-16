const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requiereAutenticacion } = require('../middlewares/autenticacion');
const { requiereModulo } = require('../middlewares/autorizacion');
const cuotas = require('../controllers/cuotas.controller');

const router = Router();

router.use(requiereAutenticacion, requiereModulo('cobranzas'));

router.post('/generar', asyncHandler(cuotas.generar));

module.exports = router;
