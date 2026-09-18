const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requiereAutenticacion } = require('../middlewares/autenticacion');
const auth = require('../controllers/auth.controller');

const router = Router();

// POST /api/auth/login  (pública: es la única forma de conseguir el token)
router.post('/login', asyncHandler(auth.login));

// GET /api/auth/yo  (protegida: devuelve los datos del token)
router.get('/yo', requiereAutenticacion, auth.yo);

module.exports = router;
