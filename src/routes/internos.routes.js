const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requiereAutenticacion } = require('../middlewares/autenticacion');
const { requiereModulo } = require('../middlewares/autorizacion');
const internos = require('../controllers/internos.controller');

const router = Router();

router.use(requiereAutenticacion, requiereModulo('internos'));

router.post('/', asyncHandler(internos.alta));

module.exports = router;
