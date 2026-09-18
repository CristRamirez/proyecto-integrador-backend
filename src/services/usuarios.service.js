const { consultarUno } = require('../db/d1');

// Acá viven las consultas a la tabla usuarios. Los controladores no escriben SQL:
// piden los datos por acá, así una misma consulta se reutiliza desde varios lados.

// Busca el usuario por su nombre de usuario y trae también el nombre del rol
// (en la tabla usuarios solo está guardado el rol_id).
async function buscarPorNombreUsuario(nombreUsuario) {
  return consultarUno(
    `SELECT u.id,
            u.nombre_usuario,
            u.nombre_completo,
            u.email,
            u.password_hash,
            u.activo,
            r.nombre AS rol
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
      WHERE u.nombre_usuario = ?`,
    [nombreUsuario]
  );
}

module.exports = { buscarPorNombreUsuario };
