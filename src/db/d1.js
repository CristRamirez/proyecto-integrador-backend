const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const URL_BASE = `https://api.cloudflare.com/client/v4/accounts/${env.d1.accountId}/d1/database/${env.d1.databaseId}`;

async function consultar(sql, params = []) {
  let respuesta;

  try {
    respuesta = await fetch(`${URL_BASE}/query`, {
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

async function consultarUno(sql, params = []) {
  const filas = await consultar(sql, params);
  return filas[0] || null;
}

module.exports = { consultar, consultarUno };
