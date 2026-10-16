const { and, asc, count, eq, notExists } = require('drizzle-orm');
const { db } = require('../db/d1');
const { cuotas, internos, estados, estadosCuota } = require('../db/schema');

async function buscarEstadoPorNombre(nombre) {
  const [fila] = await db()
    .select({ id: estadosCuota.id, nombre: estadosCuota.nombre })
    .from(estadosCuota)
    .where(eq(estadosCuota.nombre, nombre))
    .limit(1);

  return fila || null;
}

async function contarInternosActivos() {
  const [fila] = await db()
    .select({ total: count() })
    .from(internos)
    .innerJoin(estados, eq(estados.id, internos.estado_id))
    .where(eq(estados.nombre, 'activo'));

  return fila ? fila.total : 0;
}

async function internosActivosSinCuota(anio, mes) {
  const filas = await db()
    .select({ id: internos.id })
    .from(internos)
    .innerJoin(estados, eq(estados.id, internos.estado_id))
    .where(
      and(
        eq(estados.nombre, 'activo'),
        notExists(
          db()
            .select({ id: cuotas.id })
            .from(cuotas)
            .where(
              and(
                eq(cuotas.interno_id, internos.id),
                eq(cuotas.periodo_anio, anio),
                eq(cuotas.periodo_mes, mes)
              )
            )
        )
      )
    )
    .orderBy(asc(internos.id));

  return filas.map((fila) => fila.id);
}

async function crear(datos) {
  const [fila] = await db()
    .insert(cuotas)
    .values({
      interno_id: datos.internoId,
      config_cuota_id: datos.configId,
      estado_cuota_id: datos.estadoCuotaId,
      periodo_anio: datos.anio,
      periodo_mes: datos.mes,
      valor_base: datos.valorBase,
      interes_aplicado: 0,
      total: datos.valorBase,
      saldo_pendiente: datos.valorBase,
      fecha_vencimiento: datos.fechaVencimiento,
    })
    .returning({ id: cuotas.id });

  return fila.id;
}

module.exports = { buscarEstadoPorNombre, contarInternosActivos, internosActivosSinCuota, crear };
