const { consultar, consultarUno } = require('../db/d1');

async function listar() {
  return consultar(
    `SELECT r.id,
            r.nombre,
            COUNT(rm.modulo_id) AS cantidad_modulos
       FROM roles r
       LEFT JOIN rol_modulo rm ON rm.rol_id = r.id
      GROUP BY r.id, r.nombre
      ORDER BY r.nombre`
  );
}

async function obtenerPorId(id) {
  return consultarUno('SELECT id, nombre FROM roles WHERE id = ?', [id]);
}

async function modulosDeRol(rolId) {
  return consultar(
    `SELECT m.id, m.nombre
       FROM rol_modulo rm
       JOIN modulos m ON m.id = rm.modulo_id
      WHERE rm.rol_id = ?
      ORDER BY m.nombre`,
    [rolId]
  );
}

async function nombresDeModulosDelRol(nombreRol) {
  const filas = await consultar(
    `SELECT m.nombre
       FROM roles r
       JOIN rol_modulo rm ON rm.rol_id = r.id
       JOIN modulos m ON m.id = rm.modulo_id
      WHERE r.nombre = ?
      ORDER BY m.nombre`,
    [nombreRol]
  );

  return filas.map((fila) => fila.nombre);
}

async function tieneModulo(nombreRol, nombreModulo) {
  const fila = await consultarUno(
    `SELECT 1 AS permitido
       FROM roles r
       JOIN rol_modulo rm ON rm.rol_id = r.id
       JOIN modulos m ON m.id = rm.modulo_id
      WHERE r.nombre = ? AND m.nombre = ?
      LIMIT 1`,
    [nombreRol, nombreModulo]
  );

  return Boolean(fila);
}

async function reemplazarModulos(rolId, modulosIds) {
  await consultar('DELETE FROM rol_modulo WHERE rol_id = ?', [rolId]);

  for (const moduloId of modulosIds) {
    await consultar('INSERT INTO rol_modulo (rol_id, modulo_id) VALUES (?, ?)', [rolId, moduloId]);
  }

  return modulosDeRol(rolId);
}

module.exports = {
  listar,
  obtenerPorId,
  modulosDeRol,
  nombresDeModulosDelRol,
  tieneModulo,
  reemplazarModulos,
};
