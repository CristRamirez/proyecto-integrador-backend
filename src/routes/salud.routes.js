const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const salud = require('../controllers/salud.controller');

const router = Router();

router.get('/', asyncHandler(salud.estado));

module.exports = router;
