const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requiereAutenticacion } = require('../middlewares/autenticacion');
const { requiereRol } = require('../middlewares/autorizacion');
const roles = require('../controllers/roles.controller');

const router = Router();

router.use(requiereAutenticacion, requiereRol('administrador'));

router.get('/', asyncHandler(roles.listar));
router.get('/:id/modulos', asyncHandler(roles.listarModulos));
router.put('/:id/modulos', asyncHandler(roles.reemplazarModulos));

module.exports = router;
