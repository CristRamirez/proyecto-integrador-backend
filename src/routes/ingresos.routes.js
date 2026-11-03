const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requiereAutenticacion } = require('../middlewares/autenticacion');
const { requiereModulo } = require('../middlewares/autorizacion');
const ingresos = require('../controllers/ingresos.controller');

const router = Router();

router.use(requiereAutenticacion, requiereModulo('cobranzas'));

router.get('/', asyncHandler(ingresos.listar));
router.get('/categorias', asyncHandler(ingresos.categorias));
router.post('/', asyncHandler(ingresos.registrar));
router.post('/:id/anular', asyncHandler(ingresos.anular));

module.exports = router;
