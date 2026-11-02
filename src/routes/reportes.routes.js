const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requiereAutenticacion } = require('../middlewares/autenticacion');
const { requiereModulo } = require('../middlewares/autorizacion');
const reportes = require('../controllers/reportes.controller');

const router = Router();

router.use(requiereAutenticacion, requiereModulo('reportes'));

router.get('/', asyncHandler(reportes.listar));
router.get('/balance', asyncHandler(reportes.balance));

module.exports = router;
