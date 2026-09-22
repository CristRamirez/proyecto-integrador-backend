const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requiereAutenticacion } = require('../middlewares/autenticacion');
const { requiereRol } = require('../middlewares/autorizacion');
const modulos = require('../controllers/modulos.controller');

const router = Router();

router.use(requiereAutenticacion, requiereRol('administrador'));

router.get('/', asyncHandler(modulos.listar));
router.post('/', asyncHandler(modulos.crear));
router.put('/:id', asyncHandler(modulos.actualizar));
router.delete('/:id', asyncHandler(modulos.eliminar));

module.exports = router;
