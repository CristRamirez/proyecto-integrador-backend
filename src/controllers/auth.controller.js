const bcrypt = require('bcryptjs');
const ApiError = require('../utils/ApiError');
const { firmarToken } = require('../utils/token');
const usuarios = require('../services/usuarios.service');
const roles = require('../services/roles.service');

// POST /api/auth/login
// Login de prueba: alcanza para probar el middleware de token y para que la app
// de escritorio tenga contra qué autenticarse. Las reglas completas del caso de
// uso (bloqueo a los 5 intentos fallidos, los cuatro roles del enunciado)
// corresponden a la tarjeta BS-1.
async function login(req, res) {
  const { nombre_usuario: nombreUsuario, password } = req.body || {};

  if (!nombreUsuario || !password) {
    throw ApiError.solicitudInvalida('Faltan el usuario y/o la contraseña', 'DATOS_INCOMPLETOS');
  }

  const usuario = await usuarios.buscarPorNombreUsuario(nombreUsuario);

  // La contraseña se guarda hasheada: no se compara con ===, se usa bcrypt.compare,
  // que vuelve a hashear lo que escribió el usuario y lo contrasta con el hash.
  const claveCorrecta = usuario ? await bcrypt.compare(password, usuario.password_hash) : false;

  // Mismo mensaje si el usuario no existe o si la contraseña está mal: así no se
  // informa cuál de los dos campos falló y no se puede averiguar qué usuarios existen.
  if (!usuario || !claveCorrecta) {
    throw ApiError.noAutenticado('Usuario o contraseña incorrectos', 'CREDENCIALES_INVALIDAS');
  }

  if (!usuario.activo) {
    throw ApiError.sinPermiso('El usuario está deshabilitado', 'USUARIO_INACTIVO');
  }

  res.json({
    ok: true,
    token: firmarToken(usuario),
    usuario: {
      id: usuario.id,
      nombreUsuario: usuario.nombre_usuario,
      nombreCompleto: usuario.nombre_completo,
      rol: usuario.rol,
      modulos: await roles.nombresDeModulosDelRol(usuario.rol),
    },
  });
}

// GET /api/auth/yo
// Devuelve de quién es el token que se mandó. Le sirve a la app de escritorio para
// saber si la sesión sigue viva y qué opciones del menú mostrar.
async function yo(req, res) {
  const modulos = await roles.nombresDeModulosDelRol(req.usuario.rol);

  res.json({ ok: true, usuario: { ...req.usuario, modulos } });
}

module.exports = { login, yo };
