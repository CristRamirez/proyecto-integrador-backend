const ApiError = require('../utils/ApiError');

function rutaNoEncontrada(req, res, next) {
  next(ApiError.noEncontrado(`La ruta ${req.method} ${req.originalUrl} no existe`, 'RUTA_NO_ENCONTRADA'));
}

function manejadorDeErrores(error, req, res, next) {
  if (error.type === 'entity.parse.failed') {
    error = ApiError.solicitudInvalida('El cuerpo del pedido no es un JSON válido', 'JSON_INVALIDO');
  }

  const esperado = error instanceof ApiError;
  const estado = esperado ? error.estado : 500;
  const mensaje = esperado ? error.message : 'Error interno del servidor';
  const codigo = esperado ? error.codigo : 'ERROR_INTERNO';

  if (esperado) {
    console.warn(`[${estado}] ${req.method} ${req.originalUrl} - ${mensaje}${error.detalle ? ` - ${error.detalle}` : ''}`);
  } else {
    console.error(`[500] ${req.method} ${req.originalUrl}`, error);
  }

  res.status(estado).json({ ok: false, error: { codigo, mensaje } });
}

module.exports = { rutaNoEncontrada, manejadorDeErrores };
