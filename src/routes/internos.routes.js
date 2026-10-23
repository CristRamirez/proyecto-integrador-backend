const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requiereAutenticacion } = require('../middlewares/autenticacion');
const { requiereModulo } = require('../middlewares/autorizacion');
const internos = require('../controllers/internos.controller');
const pagos = require('../controllers/pagos.controller');

const router = Router();

router.use(requiereAutenticacion);

const padron = requiereModulo('internos');

router.get('/', padron, asyncHandler(internos.listar));
router.get('/verificar-dni/:dni', padron, asyncHandler(internos.verificarDni));
router.get('/:id', padron, asyncHandler(internos.ficha));
router.get('/:id/cuenta-corriente', requiereModulo('cobranzas'), asyncHandler(pagos.cuentaCorriente));
router.post('/', padron, asyncHandler(internos.alta));
router.post('/:id/baja', padron, asyncHandler(internos.baja));
router.post('/:id/reingreso', padron, asyncHandler(internos.reingreso));
router.put('/:id', padron, asyncHandler(internos.modificar));

module.exports = router;
