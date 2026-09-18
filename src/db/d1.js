const env = require('../config/env');
const ApiError = require('../utils/ApiError');

// La base se consulta de dos maneras según dónde corra la API:
//   - En Cloudflare Workers llega como binding (lo enchufa src/worker.mjs).
//   - Corriendo con node no hay binding, así que se usa la API HTTP de D1.
// El resto del código no se entera: siempre llama a consultar/consultarUno.
let binding = null;

function configurarBinding(base) {
  binding = base;
}

async function consultarPorBinding(sql, params) {
  try {
    const { results } = await binding
      .prepare(sql)
      .bind(...params)
      .all();
    return results || [];
  } catch (error) {
    throw new ApiError(502, 'Error al consultar la base de datos', 'DB_ERROR', error.message);
  }
}

async function consultarPorHttp(sql, params) {
  if (!env.d1.accountId || !env.d1.databaseId || !env.d1.apiToken) {
    throw new ApiError(
      503,
      'No se pudo conectar con la base de datos',
      'DB_SIN_CONFIGURAR',
      'Faltan CF_ACCOUNT_ID, CF_D1_DATABASE_ID o CF_D1_API_TOKEN'
    );
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${env.d1.accountId}/d1/database/${env.d1.databaseId}/query`;
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

  return (cuerpo.result[0] && cuerpo.result[0].results) || [];
}

async function consultar(sql, params = []) {
  return binding ? consultarPorBinding(sql, params) : consultarPorHttp(sql, params);
}

async function consultarUno(sql, params = []) {
  const filas = await consultar(sql, params);
  return filas[0] || null;
}

module.exports = { configurarBinding, consultar, consultarUno };
