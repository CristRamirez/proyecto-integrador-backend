const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requiereAutenticacion } = require('../middlewares/autenticacion');
const { requiereModulo } = require('../middlewares/autorizacion');
const cuotas = require('../controllers/cuotas.controller');
const pagos = require('../controllers/pagos.controller');

const router = Router();

router.use(requiereAutenticacion, requiereModulo('cobranzas'));

router.get('/', asyncHandler(cuotas.listar));
router.post('/generar', asyncHandler(cuotas.generar));
router.post('/:id/pagos', asyncHandler(pagos.registrar));

module.exports = router;
