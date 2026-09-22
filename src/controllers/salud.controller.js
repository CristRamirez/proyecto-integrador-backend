const { count } = require('drizzle-orm');
const { db } = require('../db/d1');
const { roles } = require('../db/schema');
const { version } = require('../../package.json');

async function estado(req, res) {
  const respuesta = {
    ok: true,
    servicio: 'proyecto-integrador-api',
    version,
    hora: new Date().toISOString(),
  };

  if (req.query.db === '1') {
    const [fila] = await db().select({ cantidad: count() }).from(roles);
    respuesta.baseDeDatos = { conectada: true, roles: fila ? fila.cantidad : 0 };
  }

  res.json(respuesta);
}

module.exports = { estado };
