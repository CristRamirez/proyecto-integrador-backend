const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requiereAutenticacion } = require('../middlewares/autenticacion');
const { requiereRol } = require('../middlewares/autorizacion');
const claves = require('../controllers/claves.controller');

const router = Router();

router.use(requiereAutenticacion, requiereRol('administrador'));

router.get('/', asyncHandler(claves.listar));
router.get('/:id', asyncHandler(claves.obtener));
router.post('/', asyncHandler(claves.crear));
router.put('/:id', asyncHandler(claves.actualizar));
router.put('/:id/estado', asyncHandler(claves.cambiarEstado));
router.delete('/:id', asyncHandler(claves.eliminar));

module.exports = router;
