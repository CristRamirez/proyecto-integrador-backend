// En Workers las variables ya llegan del runtime; dotenv solo hace falta con node.
const enWorkers = globalThis.navigator && globalThis.navigator.userAgent === 'Cloudflare-Workers';
if (!enWorkers) {
  require('dotenv').config();
}

if (!process.env.JWT_SECRET) {
  throw new Error('Falta la variable de entorno JWT_SECRET');
}

module.exports = {
  puerto: Number(process.env.PORT) || 3000,
  entorno: process.env.NODE_ENV || 'development',

  // Credenciales de la API HTTP de D1: solo se usan corriendo con node,
  // porque en Workers la base entra por el binding (ver src/db/d1.js).
  d1: {
    accountId: process.env.CF_ACCOUNT_ID,
    databaseId: process.env.CF_D1_DATABASE_ID,
    apiToken: process.env.CF_D1_API_TOKEN,
  },

  jwt: {
    secreto: process.env.JWT_SECRET,
    expiracion: process.env.JWT_EXPIRES_IN || '2h',
  },
};
