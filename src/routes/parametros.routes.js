const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requiereAutenticacion } = require('../middlewares/autenticacion');
const { requiereRol } = require('../middlewares/autorizacion');
const parametros = require('../controllers/parametros.controller');

const router = Router();

router.use(requiereAutenticacion, requiereRol('administrador'));

router.get('/', asyncHandler(parametros.vigente));
router.get('/historico', asyncHandler(parametros.historico));
router.post('/', asyncHandler(parametros.guardar));

module.exports = router;
