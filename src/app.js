const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const rutas = require('./routes');
const { rutaNoEncontrada, manejadorDeErrores } = require('./middlewares/errorHandler');

const enWorkers = globalThis.navigator && globalThis.navigator.userAgent === 'Cloudflare-Workers';

function crearApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  // morgan solo corriendo con node. Dentro de Cloudflare Workers deja las
  // respuestas sin cuerpo, y ahi los pedidos ya quedan registrados por la
  // observabilidad del Worker, asi que no hace falta.
  if (!enWorkers) {
    app.use(morgan('dev'));
  }

  app.use('/api', rutas);

  app.use(rutaNoEncontrada);
  app.use(manejadorDeErrores);

  return app;
}

module.exports = crearApp;
