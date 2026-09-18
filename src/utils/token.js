const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('./ApiError');

// Genera el token que el usuario va a mandar en cada pedido posterior al login.
// Adentro va solo lo mínimo para identificarlo: el contenido de un token se puede
// leer sin la clave (va firmado, no encriptado), así que nunca se guarda la
// contraseña ni datos sensibles.
function firmarToken(usuario) {
  const contenido = {
    sub: usuario.id,                 // "sub" (subject) es el campo estándar para el id del dueño
    usuario: usuario.nombre_usuario,
    rol: usuario.rol,                // el rol viaja en el token para no ir a la base en cada pedido
  };

  return jwt.sign(contenido, env.jwt.secreto, { expiresIn: env.jwt.expiracion });
}

// Verifica la firma y el vencimiento del token. Si algo no cierra, corta con un 401.
// Se distinguen los dos casos porque el front reacciona distinto: si venció, hay que
// volver a loguearse; si es inválido, el token está mal armado o adulterado.
function verificarToken(token) {
  try {
    return jwt.verify(token, env.jwt.secreto);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw ApiError.noAutenticado('La sesión expiró, volvé a iniciar sesión', 'TOKEN_VENCIDO');
    }
    throw ApiError.noAutenticado('Token inválido', 'TOKEN_INVALIDO');
  }
}

module.exports = { firmarToken, verificarToken };
