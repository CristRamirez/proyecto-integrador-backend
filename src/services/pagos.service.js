const { asc, eq } = require('drizzle-orm');
const { db } = require('../db/d1');
const { cuotas, estadosCuota, internos, mediosPago, pagos, usuarios } = require('../db/schema');

const COLUMNAS_CUOTA = {
  id: cuotas.id,
  interno_id: cuotas.interno_id,
  periodo_anio: cuotas.periodo_anio,
  periodo_mes: cuotas.periodo_mes,
  valor_base: cuotas.valor_base,
  interes_aplicado: cuotas.interes_aplicado,
  total: cuotas.total,
  saldo_pendiente: cuotas.saldo_pendiente,
  estado: estadosCuota.nombre,
  fecha_vencimiento: cuotas.fecha_vencimiento,
};

// El período se devuelve como "2026-10", que es como lo muestra el front.
function conPeriodo({ periodo_anio, periodo_mes, ...cuota }) {
  return { ...cuota, periodo: `${periodo_anio}-${String(periodo_mes).padStart(2, '0')}` };
}

async function obtenerCuota(cuotaId) {
  const [fila] = await db()
    .select(COLUMNAS_CUOTA)
    .from(cuotas)
    .innerJoin(estadosCuota, eq(estadosCuota.id, cuotas.estado_cuota_id))
    .where(eq(cuotas.id, cuotaId))
    .limit(1);

  return fila ? conPeriodo(fila) : null;
}

async function buscarMedioPago(medioPagoId) {
  const [fila] = await db()
    .select({ id: mediosPago.id, nombre: mediosPago.nombre })
    .from(mediosPago)
    .where(eq(mediosPago.id, medioPagoId))
    .limit(1);

  return fila || null;
}

// Si no viene la fecha del pago la pone la base con la fecha y hora actual.
async function crear(datos) {
  const [fila] = await db()
    .insert(pagos)
    .values({
      cuota_id: datos.cuotaId,
      medio_pago_id: datos.medioPagoId,
      monto: datos.monto,
      numero_comprobante: datos.numeroComprobante ?? null,
      observaciones: datos.observaciones ?? null,
      usuario_id: datos.usuarioId ?? null,
      ...(datos.fechaPago ? { fecha_pago: datos.fechaPago } : {}),
    })
    .returning({ id: pagos.id });

  return fila.id;
}

async function actualizarSaldo(cuotaId, saldo, estadoCuotaId) {
  await db()
    .update(cuotas)
    .set({ saldo_pendiente: saldo, estado_cuota_id: estadoCuotaId })
    .where(eq(cuotas.id, cuotaId));
}

const COLUMNAS_PAGO = {
  id: pagos.id,
  monto: pagos.monto,
  fecha_pago: pagos.fecha_pago,
  medio_pago: mediosPago.nombre,
  numero_comprobante: pagos.numero_comprobante,
  observaciones: pagos.observaciones,
  registrado_por: usuarios.nombre_completo,
};

// El usuario va con leftJoin porque puede ser NULL, igual que en el historial
// de estados del interno.
async function listarPorCuota(cuotaId) {
  return db()
    .select(COLUMNAS_PAGO)
    .from(pagos)
    .innerJoin(mediosPago, eq(mediosPago.id, pagos.medio_pago_id))
    .leftJoin(usuarios, eq(usuarios.id, pagos.usuario_id))
    .where(eq(pagos.cuota_id, cuotaId))
    .orderBy(asc(pagos.fecha_pago), asc(pagos.id));
}

async function buscarInterno(internoId) {
  const [fila] = await db()
    .select({ id: internos.id, dni: internos.dni, apellido: internos.apellido, nombre: internos.nombre })
    .from(internos)
    .where(eq(internos.id, internoId))
    .limit(1);

  return fila || null;
}

// Cuenta corriente (BS-9): las cuotas del interno, de la más vieja a la más
// nueva, cada una con sus pagos. Los pagos se traen todos juntos en una sola
// consulta y se reparten por cuota, en vez de hacer una consulta por cuota.
async function listarCuentaCorriente(internoId) {
  const filas = await db()
    .select(COLUMNAS_CUOTA)
    .from(cuotas)
    .innerJoin(estadosCuota, eq(estadosCuota.id, cuotas.estado_cuota_id))
    .where(eq(cuotas.interno_id, internoId))
    .orderBy(asc(cuotas.periodo_anio), asc(cuotas.periodo_mes));

  const pagosDelInterno = await db()
    .select({ ...COLUMNAS_PAGO, cuota_id: pagos.cuota_id })
    .from(pagos)
    .innerJoin(cuotas, eq(cuotas.id, pagos.cuota_id))
    .innerJoin(mediosPago, eq(mediosPago.id, pagos.medio_pago_id))
    .leftJoin(usuarios, eq(usuarios.id, pagos.usuario_id))
    .where(eq(cuotas.interno_id, internoId))
    .orderBy(asc(pagos.fecha_pago), asc(pagos.id));

  return filas.map((fila) => ({
    ...conPeriodo(fila),
    pagos: pagosDelInterno
      .filter((pago) => pago.cuota_id === fila.id)
      .map(({ cuota_id, ...pago }) => pago),
  }));
}

module.exports = {
  obtenerCuota,
  buscarMedioPago,
  crear,
  actualizarSaldo,
  listarPorCuota,
  buscarInterno,
  listarCuentaCorriente,
};
