const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requiereAutenticacion } = require('../middlewares/autenticacion');
const { requiereModulo } = require('../middlewares/autorizacion');
const reportes = require('../controllers/reportes.controller');

const router = Router();

router.use(requiereAutenticacion, requiereModulo('reportes'));

router.get('/', asyncHandler(reportes.listar));
router.get('/balance', asyncHandler(reportes.balance));
router.get('/cuenta-corriente', asyncHandler(reportes.cuentaCorriente));
router.get('/clasificacion', asyncHandler(reportes.clasificacion));
router.get('/medios-pago', asyncHandler(reportes.mediosPago));
router.get('/egresos', asyncHandler(reportes.egresos));
router.get('/egresos-internos', asyncHandler(reportes.egresosInternos));
router.get('/deuda', asyncHandler(reportes.deuda));
router.get('/obras-sociales', asyncHandler(reportes.obrasSociales));

module.exports = router;
