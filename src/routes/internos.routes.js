const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requiereAutenticacion } = require('../middlewares/autenticacion');
const { requiereModulo } = require('../middlewares/autorizacion');
const internos = require('../controllers/internos.controller');

const router = Router();

router.use(requiereAutenticacion, requiereModulo('internos'));

router.get('/', asyncHandler(internos.listar));
router.get('/verificar-dni/:dni', asyncHandler(internos.verificarDni));
router.get('/:id', asyncHandler(internos.ficha));
router.post('/', asyncHandler(internos.alta));
router.put('/:id', asyncHandler(internos.modificar));

module.exports = router;
