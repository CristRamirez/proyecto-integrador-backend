const crearApp = require('./app');
const env = require('./config/env');

const app = crearApp();

app.listen(env.puerto, () => {
  console.log(`API escuchando en http://localhost:${env.puerto} (entorno: ${env.entorno})`);
});
