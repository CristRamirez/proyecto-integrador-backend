require('dotenv').config();

const REQUERIDAS = ['CF_ACCOUNT_ID', 'CF_D1_DATABASE_ID', 'CF_D1_API_TOKEN', 'JWT_SECRET'];

const faltantes = REQUERIDAS.filter((nombre) => !process.env[nombre]);
if (faltantes.length > 0) {
  console.error(`Faltan variables de entorno: ${faltantes.join(', ')}`);
  console.error('Copiá .env.example a .env y completá los valores.');
  process.exit(1);
}

module.exports = {
  puerto: Number(process.env.PORT) || 3000,
  entorno: process.env.NODE_ENV || 'development',

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
