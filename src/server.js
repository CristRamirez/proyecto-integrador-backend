// Arranque con node. El equivalente para Cloudflare Workers es src/worker.mjs.
let crearApp;
let env;

try {
  crearApp = require('./app');
  env = require('./config/env');
} catch (error) {
  console.error(error.message);
  console.error('Copiá .env.example a .env y completá los valores.');
  process.exit(1);
}

const app = crearApp();

app.listen(env.puerto, () => {
  console.log(`API escuchando en http://localhost:${env.puerto} (entorno: ${env.entorno})`);
});
