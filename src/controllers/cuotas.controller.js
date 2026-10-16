const ApiError = require('../utils/ApiError');
const cuotas = require('../services/cuotas.service');
const parametros = require('../services/parametros.service');

const ESTADO_INICIAL = 'pendiente';
const ANIO_MINIMO = 2020;
const ANIO_MAXIMO = 2100;

function vacio(valor) {
  return valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');
}

function leerEntero(valor, etiqueta, minimo, maximo, codigo) {
  if (vacio(valor)) {
    throw ApiError.solicitudInvalida(`${etiqueta} es obligatorio`, 'DATOS_INCOMPLETOS');
  }

  const numero = Number(valor);

  if (!Number.isInteger(numero) || numero < minimo || numero > maximo) {
    throw ApiError.solicitudInvalida(`${etiqueta} tiene que ser un número entero entre ${minimo} y ${maximo}`, codigo);
  }

  return numero;
}

function fechaDeVencimiento(anio, mes, dia) {
  const ultimoDelMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const diaReal = Math.min(dia, ultimoDelMes);

  return `${anio}-${String(mes).padStart(2, '0')}-${String(diaReal).padStart(2, '0')}`;
}

async function generar(req, res) {
  const cuerpo = req.body || {};
  const anio = leerEntero(cuerpo.anio, 'El año', ANIO_MINIMO, ANIO_MAXIMO, 'PERIODO_INVALIDO');
  const mes = leerEntero(cuerpo.mes, 'El mes', 1, 12, 'PERIODO_INVALIDO');

  const configuracion = await parametros.obtenerVigente();

  if (!configuracion) {
    throw new ApiError(
      409,
      'Todavía no se cargaron los parámetros de cobranza: no hay valor de cuota con el que generar',
      'SIN_PARAMETROS'
    );
  }

  const estado = await cuotas.buscarEstadoPorNombre(ESTADO_INICIAL);

  if (!estado) {
    throw new ApiError(500, 'Falta el estado pendiente en la base de datos', 'ESTADO_CUOTA_FALTANTE');
  }

  const activos = await cuotas.contarInternosActivos();
  const pendientes = await cuotas.internosActivosSinCuota(anio, mes);
  const fechaVencimiento = fechaDeVencimiento(anio, mes, configuracion.dia_vencimiento);

  for (const internoId of pendientes) {
    await cuotas.crear({
      internoId,
      configId: configuracion.id,
      estadoCuotaId: estado.id,
      anio,
      mes,
      valorBase: configuracion.valor_cuota,
      fechaVencimiento,
    });
  }

  res.json({
    ok: true,
    periodo: { anio, mes },
    valor_cuota: configuracion.valor_cuota,
    fecha_vencimiento: fechaVencimiento,
    internos_activos: activos,
    creadas: pendientes.length,
    omitidas: activos - pendientes.length,
  });
}

module.exports = { generar };
