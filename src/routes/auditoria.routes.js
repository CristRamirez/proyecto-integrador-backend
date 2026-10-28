const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requiereAutenticacion } = require('../middlewares/autenticacion');
const { requiereRol } = require('../middlewares/autorizacion');
const auditoria = require('../controllers/auditoria.controller');

const router = Router();

// El log de auditoría lo consulta solo el administrador.
router.use(requiereAutenticacion, requiereRol('administrador'));

router.get('/', asyncHandler(auditoria.listar));
router.get('/filtros', asyncHandler(auditoria.filtros));

module.exports = router;
