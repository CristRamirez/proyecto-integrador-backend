const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const rutas = require('./routes');
const { rutaNoEncontrada, manejadorDeErrores } = require('./middlewares/errorHandler');

function crearApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan('dev'));

  app.use('/api', rutas);

  app.use(rutaNoEncontrada);
  app.use(manejadorDeErrores);

  return app;
}

module.exports = crearApp;
