const ApiError = require('../utils/ApiError');
const pagos = require('../services/pagos.service');
const cuotas = require('../services/cuotas.service');
const catalogos = require('../services/catalogos.service');

const ESTADO_PAGADA = 'pagada';
const ESTADO_PARCIAL = 'parcial';
const ESTADO_ANULADA = 'anulada';
const MEDIO_OBRA_SOCIAL = 'obra social';
const MAXIMO_OBSERVACIONES = 500;
const MAXIMO_COMPROBANTE = 50;

function texto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function vacio(valor) {
  return valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');
}

// Saldo y monto son REAL: se redondean a centavos antes de comparar para que
// 0.1 + 0.2 no deje un saldo de 0.0000001.
function centavos(valor) {
  return Math.round(valor * 100) / 100;
}

function esFecha(valor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return false;
  }

  const fecha = new Date(`${valor}T00:00:00Z`);

  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

function horaActual() {
  return new Date().toISOString().slice(11, 19);
}

function leerIdCuota(valor) {
  const id = Number(valor);

  if (!Number.isInteger(id) || id <= 0) {
    throw ApiError.solicitudInvalida('El id de la cuota no es válido', 'ID_INVALIDO');
  }

  return id;
}

function leerMonto(valor, saldo) {
  if (vacio(valor)) {
    throw ApiError.solicitudInvalida('El monto es obligatorio', 'DATOS_INCOMPLETOS');
  }

  const monto = centavos(Number(valor));

  if (!Number.isFinite(monto) || monto <= 0) {
    throw ApiError.solicitudInvalida('El monto tiene que ser un número mayor a cero', 'MONTO_INVALIDO');
  }

  if (monto > saldo) {
    throw ApiError.solicitudInvalida(
      `El monto no puede superar el saldo pendiente de la cuota, que es de ${saldo}`,
      'MONTO_MAYOR_AL_SALDO'
    );
  }

  return monto;
}

async function leerMedioPago(valor) {
  if (vacio(valor)) {
    throw ApiError.solicitudInvalida('El medio de pago es obligatorio', 'DATOS_INCOMPLETOS');
  }

  const id = Number(valor);
  const medio = Number.isInteger(id) && id > 0 ? await pagos.buscarMedioPago(id) : null;

  if (!medio) {
    throw ApiError.solicitudInvalida('El medio de pago no existe', 'MEDIO_PAGO_INEXISTENTE');
  }

  return medio;
}

// Misma regla que la fecha de ingreso del interno: si no viene es hoy, y no
// puede ser futura. Se guarda con la hora, como el resto de las fechas.
function leerFechaPago(valor) {
  if (vacio(valor)) {
    return null;
  }

  const fecha = texto(valor);

  if (!esFecha(fecha)) {
    throw ApiError.solicitudInvalida('La fecha de pago tiene que tener el formato AAAA-MM-DD', 'FECHA_INVALIDA');
  }

  if (fecha > hoy()) {
    throw ApiError.solicitudInvalida('La fecha de pago no puede ser futura', 'FECHA_INVALIDA');
  }

  return `${fecha} ${horaActual()}`;
}

function leerTextoOpcional(valor, etiqueta, maximo, codigo) {
  const contenido = texto(valor);

  if (!contenido) {
    return null;
  }

  if (contenido.length > maximo) {
    throw ApiError.solicitudInvalida(`${etiqueta} no puede superar los ${maximo} caracteres`, codigo);
  }

  return contenido;
}

// Cuando paga la obra social hay que decir cuál (BS-8). La tabla pagos todavía
// no tiene columna para guardarla, así que por ahora queda en las observaciones.
async function leerObraSocialPagadora(valor) {
  if (vacio(valor)) {
    throw ApiError.solicitudInvalida(
      'Si el medio de pago es obra social hay que indicar la obra social pagadora',
      'OBRA_SOCIAL_REQUERIDA'
    );
  }

  const id = Number(valor);
  const disponibles = await catalogos.listarObrasSociales();
  const obraSocial = disponibles.find((fila) => fila.id === id);

  if (!obraSocial) {
    throw ApiError.solicitudInvalida('La obra social no existe', 'OBRA_SOCIAL_INEXISTENTE');
  }

  return obraSocial;
}

// POST /api/cuotas/:id/pagos
async function registrar(req, res) {
  const id = leerIdCuota(req.params.id);
  const cuerpo = req.body || {};
  const cuota = await pagos.obtenerCuota(id);

  if (!cuota) {
    throw ApiError.noEncontrado('La cuota no existe', 'CUOTA_NO_ENCONTRADA');
  }

  if (cuota.estado === ESTADO_ANULADA) {
    throw new ApiError(409, 'La cuota está anulada: no admite pagos', 'CUOTA_ANULADA');
  }

  const saldo = centavos(cuota.saldo_pendiente);

  if (saldo <= 0) {
    throw new ApiError(409, 'La cuota ya está pagada: no tiene saldo pendiente', 'CUOTA_SIN_SALDO');
  }

  const monto = leerMonto(cuerpo.monto, saldo);
  const medio = await leerMedioPago(cuerpo.medio_pago_id);
  const fechaPago = leerFechaPago(cuerpo.fecha_pago);
  const numeroComprobante = leerTextoOpcional(
    cuerpo.numero_comprobante,
    'El número de comprobante',
    MAXIMO_COMPROBANTE,
    'COMPROBANTE_INVALIDO'
  );
  let observaciones = leerTextoOpcional(
    cuerpo.observaciones,
    'Las observaciones',
    MAXIMO_OBSERVACIONES,
    'OBSERVACIONES_INVALIDAS'
  );

  if (medio.nombre === MEDIO_OBRA_SOCIAL) {
    const obraSocial = await leerObraSocialPagadora(cuerpo.obra_social_id);
    observaciones = [`Obra social pagadora: ${obraSocial.nombre}`, observaciones].filter(Boolean).join(' - ');
  }

  const saldoNuevo = centavos(saldo - monto);
  const estado = await cuotas.buscarEstadoPorNombre(saldoNuevo <= 0 ? ESTADO_PAGADA : ESTADO_PARCIAL);

  if (!estado) {
    throw new ApiError(500, 'Faltan los estados de cuota en la base de datos', 'ESTADO_CUOTA_FALTANTE');
  }

  await pagos.crear({
    cuotaId: id,
    medioPagoId: medio.id,
    monto,
    fechaPago,
    numeroComprobante,
    observaciones,
    usuarioId: req.usuario.id,
  });
  await pagos.actualizarSaldo(id, Math.max(saldoNuevo, 0), estado.id);

  res.status(201).json({
    ok: true,
    cuota: await pagos.obtenerCuota(id),
    pagos: await pagos.listarPorCuota(id),
  });
}

module.exports = { registrar };
