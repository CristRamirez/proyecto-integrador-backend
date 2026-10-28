const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requiereAutenticacion } = require('../middlewares/autenticacion');
const { requiereRol } = require('../middlewares/autorizacion');
const usuarios = require('../controllers/usuarios.controller');

const router = Router();

router.use(requiereAutenticacion, requiereRol('administrador'));

router.get('/', asyncHandler(usuarios.listar));
router.get('/:id', asyncHandler(usuarios.obtener));
router.post('/', asyncHandler(usuarios.crear));
router.put('/:id', asyncHandler(usuarios.actualizar));
router.put('/:id/password', asyncHandler(usuarios.cambiarPassword));
router.put('/:id/estado', asyncHandler(usuarios.cambiarEstado));
router.post('/:id/desbloquear', asyncHandler(usuarios.desbloquear));

module.exports = router;
