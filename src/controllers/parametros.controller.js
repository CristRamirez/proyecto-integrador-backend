const ApiError = require('../utils/ApiError');
const parametros = require('../services/parametros.service');
const auditoria = require('../services/auditoria.service');

const MAXIMO_OBSERVACIONES = 500;

function texto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function vacio(valor) {
  return valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');
}

function leerMonto(valor, etiqueta, { obligatorio = true, porDefecto = 0 } = {}) {
  if (vacio(valor)) {
    if (obligatorio) {
      throw ApiError.solicitudInvalida(`${etiqueta} es obligatorio`, 'DATOS_INCOMPLETOS');
    }

    return porDefecto;
  }

  const numero = Number(valor);

  if (!Number.isFinite(numero) || numero < 0) {
    throw ApiError.solicitudInvalida(`${etiqueta} tiene que ser un número mayor o igual a cero`, 'MONTO_INVALIDO');
  }

  return numero;
}

function leerDiaVencimiento(valor) {
  if (vacio(valor)) {
    throw ApiError.solicitudInvalida('El día de vencimiento es obligatorio', 'DATOS_INCOMPLETOS');
  }

  const dia = Number(valor);

  if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
    throw ApiError.solicitudInvalida('El día de vencimiento tiene que ser un número entre 1 y 31', 'DIA_INVALIDO');
  }

  return dia;
}

function leerObservaciones(valor) {
  const observaciones = texto(valor);

  if (!observaciones) {
    return null;
  }

  if (observaciones.length > MAXIMO_OBSERVACIONES) {
    throw ApiError.solicitudInvalida(
      `Las observaciones no pueden superar los ${MAXIMO_OBSERVACIONES} caracteres`,
      'OBSERVACIONES_INVALIDAS'
    );
  }

  return observaciones;
}

async function vigente(req, res) {
  res.json({ ok: true, configuracion: await parametros.obtenerVigente() });
}

async function historico(req, res) {
  res.json({ ok: true, configuraciones: await parametros.listarHistorico() });
}

async function guardar(req, res) {
  const cuerpo = req.body || {};

  const datos = {
    valorCuota: leerMonto(cuerpo.valor_cuota, 'El valor de la cuota'),
    valorMora: leerMonto(cuerpo.valor_mora, 'El valor de la mora', { obligatorio: false }),
    diaVencimiento: leerDiaVencimiento(cuerpo.dia_vencimiento),
    observaciones: leerObservaciones(cuerpo.observaciones),
  };

  if (datos.valorCuota <= 0) {
    throw ApiError.solicitudInvalida('El valor de la cuota tiene que ser mayor a cero', 'MONTO_INVALIDO');
  }

  const anterior = await parametros.obtenerVigente();
  const configuracion = await parametros.guardar(datos, req.usuario.id);

  // Guardar parámetros nuevos archiva los anteriores: queda como alta de una
  // configuración, con los valores que reemplaza.
  await auditoria.registrar(req.usuario.id, auditoria.ACCIONES.ALTA, 'configuracion_cuotas', configuracion ? configuracion.id : null, {
    valor_cuota: datos.valorCuota,
    valor_mora: datos.valorMora,
    dia_vencimiento: datos.diaVencimiento,
    reemplaza_a: anterior ? anterior.id : null,
  });

  res.status(201).json({ ok: true, configuracion });
}

module.exports = { vigente, historico, guardar };
