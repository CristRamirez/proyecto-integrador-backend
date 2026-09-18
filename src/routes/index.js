const { Router } = require('express');

const rutasSalud = require('./salud.routes');

const router = Router();

router.use('/salud', rutasSalud);

module.exports = router;
