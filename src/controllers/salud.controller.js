const { consultarUno } = require('../db/d1');
const { version } = require('../../package.json');

async function estado(req, res) {
  const respuesta = {
    ok: true,
    servicio: 'proyecto-integrador-api',
    version,
    hora: new Date().toISOString(),
  };

  if (req.query.db === '1') {
    const fila = await consultarUno('SELECT COUNT(*) AS cantidad FROM roles');
    respuesta.baseDeDatos = { conectada: true, roles: fila ? fila.cantidad : 0 };
  }

  res.json(respuesta);
}

module.exports = { estado };
