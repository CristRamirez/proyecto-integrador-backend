const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requiereAutenticacion } = require('../middlewares/autenticacion');
const { requiereRol } = require('../middlewares/autorizacion');
const ejemplo = require('../controllers/ejemplo.controller');

const router = Router();

// Los middlewares se encadenan en orden: primero se valida el token y recién
// después el rol, porque el rol sale de req.usuario.
router.get('/publico', ejemplo.publico);
router.get('/protegido', requiereAutenticacion, ejemplo.protegido);
router.get('/solo-admin', requiereAutenticacion, requiereRol('administrador'), ejemplo.soloAdmin);
router.get('/error', asyncHandler(ejemplo.romper));

module.exports = router;
