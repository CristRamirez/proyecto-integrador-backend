const { consultar, consultarUno } = require('../db/d1');

async function listar() {
  return consultar('SELECT id, nombre FROM modulos ORDER BY nombre');
}

async function obtenerPorId(id) {
  return consultarUno('SELECT id, nombre FROM modulos WHERE id = ?', [id]);
}

async function buscarPorNombre(nombre) {
  return consultarUno('SELECT id, nombre FROM modulos WHERE nombre = ?', [nombre]);
}

async function crear(nombre) {
  return consultarUno('INSERT INTO modulos (nombre) VALUES (?) RETURNING id, nombre', [nombre]);
}

async function actualizar(id, nombre) {
  return consultarUno('UPDATE modulos SET nombre = ? WHERE id = ? RETURNING id, nombre', [nombre, id]);
}

async function eliminar(id) {
  await consultar('DELETE FROM modulos WHERE id = ?', [id]);
}

async function estaAsignado(id) {
  const fila = await consultarUno('SELECT 1 AS usado FROM rol_modulo WHERE modulo_id = ? LIMIT 1', [id]);
  return Boolean(fila);
}

module.exports = {
  listar,
  obtenerPorId,
  buscarPorNombre,
  crear,
  actualizar,
  eliminar,
  estaAsignado,
};
