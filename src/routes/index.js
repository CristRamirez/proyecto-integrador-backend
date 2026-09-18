const { Router } = require('express');

const rutasSalud = require('./salud.routes');
const rutasAuth = require('./auth.routes');
const rutasEjemplo = require('./ejemplo.routes');

// Router raiz de la API: aca se monta cada grupo de rutas con su prefijo. Cuando se
// sumen los modulos del sistema (internos, cobranzas, reportes) se agregan en esta
// misma lista y no hay que tocar app.js.
const router = Router();

router.use('/salud', rutasSalud);
router.use('/auth', rutasAuth);
router.use('/ejemplo', rutasEjemplo);

module.exports = router;
