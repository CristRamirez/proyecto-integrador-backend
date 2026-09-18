class ApiError extends Error {
  constructor(estado, mensaje, codigo = 'ERROR', detalle = null) {
    super(mensaje);
    this.name = 'ApiError';
    this.estado = estado;
    this.codigo = codigo;
    this.detalle = detalle;
  }

  static solicitudInvalida(mensaje, codigo = 'SOLICITUD_INVALIDA') {
    return new ApiError(400, mensaje, codigo);
  }

  static noAutenticado(mensaje, codigo = 'NO_AUTENTICADO') {
    return new ApiError(401, mensaje, codigo);
  }

  static sinPermiso(mensaje, codigo = 'SIN_PERMISO') {
    return new ApiError(403, mensaje, codigo);
  }

  static noEncontrado(mensaje, codigo = 'NO_ENCONTRADO') {
    return new ApiError(404, mensaje, codigo);
  }
}

module.exports = ApiError;
