const { eq } = require('drizzle-orm');
const { db } = require('../db/d1');
const { usuarios, roles } = require('../db/schema');

// Acá viven las consultas a la tabla usuarios. Los controladores no arman
// consultas: piden los datos por acá, así una misma consulta se reutiliza
// desde varios lados.

// Busca el usuario por su nombre de usuario y trae también el nombre del rol
// (en la tabla usuarios solo está guardado el rol_id).
async function buscarPorNombreUsuario(nombreUsuario) {
  const [fila] = await db()
    .select({
      id: usuarios.id,
      nombre_usuario: usuarios.nombre_usuario,
      nombre_completo: usuarios.nombre_completo,
      email: usuarios.email,
      password_hash: usuarios.password_hash,
      activo: usuarios.activo,
      rol: roles.nombre,
    })
    .from(usuarios)
    .innerJoin(roles, eq(roles.id, usuarios.rol_id))
    .where(eq(usuarios.nombre_usuario, nombreUsuario))
    .limit(1);

  return fila || null;
}

module.exports = { buscarPorNombreUsuario };
