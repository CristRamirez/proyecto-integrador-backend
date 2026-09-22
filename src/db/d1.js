const { drizzle: drizzlePorBinding } = require('drizzle-orm/d1');
const { drizzle: drizzlePorHttp } = require('drizzle-orm/sqlite-proxy');

const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const schema = require('./schema');

// La base se consulta con el ORM (Drizzle), que arma el SQL por nosotros.
// Según dónde corra la API cambia por dónde entra:
//   - En Cloudflare Workers llega como binding (lo enchufa src/worker.mjs).
//   - Corriendo con node no hay binding, así que se usa la API HTTP de D1.
// Los servicios no se enteran: siempre piden db() y escriben la consulta igual.
let binding = null;
let instancia = null;

function configurarBinding(base) {
  binding = base;
  instancia = null; // la próxima llamada a db() la arma con el binding puesto
}

// Se usa el endpoint /raw y no /query porque devuelve cada fila como un arreglo
// de valores, que es el formato con el que trabaja el ORM. El /query las
// devuelve como objetos y el ORM no las sabría acomodar a las columnas pedidas.
async function consultarPorHttp(sql, params, method) {
  if (!env.d1.accountId || !env.d1.databaseId || !env.d1.apiToken) {
    throw new ApiError(
      503,
      'No se pudo conectar con la base de datos',
      'DB_SIN_CONFIGURAR',
      'Faltan CF_ACCOUNT_ID, CF_D1_DATABASE_ID o CF_D1_API_TOKEN'
    );
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${env.d1.accountId}/d1/database/${env.d1.databaseId}/raw`;
  let respuesta;

  try {
    respuesta = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.d1.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    });
  } catch (error) {
    throw new ApiError(503, 'No se pudo conectar con la base de datos', 'DB_SIN_CONEXION', error.message);
  }

  const cuerpo = await respuesta.json().catch(() => null);

  if (!respuesta.ok || !cuerpo || !cuerpo.success) {
    const errores = (cuerpo && cuerpo.errors) || [];
    const detalle = errores.map((e) => e.message).join(' | ') || `HTTP ${respuesta.status}`;
    throw new ApiError(502, 'Error al consultar la base de datos', 'DB_ERROR', detalle);
  }

  const resultado = cuerpo.result[0] && cuerpo.result[0].results;
  const filas = (resultado && resultado.rows) || [];

  // Con method 'get' el ORM espera la fila sola, no una lista con una fila.
  return { rows: method === 'get' ? filas[0] || [] : filas };
}

// Punto de entrada de todas las consultas:  db().select()... / db().insert()...
function db() {
  if (!instancia) {
    instancia = binding
      ? drizzlePorBinding(binding, { schema })
      : drizzlePorHttp(consultarPorHttp, { schema });
  }

  return instancia;
}

module.exports = { configurarBinding, db };
