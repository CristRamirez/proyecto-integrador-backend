const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requiereAutenticacion } = require('../middlewares/autenticacion');
const { requiereModulo } = require('../middlewares/autorizacion');
const egresos = require('../controllers/egresos.controller');

const router = Router();

router.use(requiereAutenticacion, requiereModulo('cobranzas'));

router.get('/', asyncHandler(egresos.listar));
router.get('/categorias', asyncHandler(egresos.categorias));
router.post('/', asyncHandler(egresos.registrar));
router.put('/:id', asyncHandler(egresos.modificar));
router.post('/:id/anular', asyncHandler(egresos.anular));

module.exports = router;
