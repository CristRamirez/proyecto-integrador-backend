-- ============================================================
-- Reingreso de internos: fechas de cada estadía en el legajo
-- Se corre UNA sola vez sobre la base que ya está creada en D1.
-- db/schema.sql quedó actualizado, pero sus CREATE TABLE no agregan
-- columnas a una tabla que ya existe.
-- ============================================================

ALTER TABLE legajos ADD COLUMN fecha_ingreso TEXT;
ALTER TABLE legajos ADD COLUMN fecha_egreso  TEXT;
ALTER TABLE legajos ADD COLUMN motivo_egreso TEXT;

-- Hasta ahora cada interno tiene un solo legajo: toma la fecha de ingreso del interno.
UPDATE legajos
SET fecha_ingreso = (SELECT i.fecha_ingreso FROM internos i WHERE i.id = legajos.interno_id);

-- A los egresados se les cierra el legajo con la última baja del historial.
UPDATE legajos
SET fecha_egreso = (
      SELECT substr(h.fecha, 1, 10) FROM historial_estados h
      JOIN estados e ON e.id = h.estado_id
      WHERE h.interno_id = legajos.interno_id AND e.nombre = 'egresado'
      ORDER BY h.fecha DESC, h.id DESC LIMIT 1),
    motivo_egreso = (
      SELECT h.motivo FROM historial_estados h
      JOIN estados e ON e.id = h.estado_id
      WHERE h.interno_id = legajos.interno_id AND e.nombre = 'egresado'
      ORDER BY h.fecha DESC, h.id DESC LIMIT 1)
WHERE interno_id IN (
  SELECT i.id FROM internos i JOIN estados e ON e.id = i.estado_id WHERE e.nombre = 'egresado'
);
