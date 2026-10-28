-- ============================================================
-- BS-12: edición y anulación de egresos
-- Se corre UNA sola vez sobre la base que ya está creada en D1.
-- db/schema.sql quedó actualizado, pero sus CREATE TABLE no agregan
-- columnas a una tabla que ya existe.
-- ============================================================

-- Un egreso no se borra: se anula y queda con el motivo, quién y cuándo.
-- Los existentes quedan como 'activo' por el valor por defecto.
ALTER TABLE egresos ADD COLUMN estado TEXT NOT NULL DEFAULT 'activo'
  CHECK (estado IN ('activo', 'anulado'));
ALTER TABLE egresos ADD COLUMN motivo_anulacion TEXT;
ALTER TABLE egresos ADD COLUMN anulado_por      INTEGER REFERENCES usuarios(id);
ALTER TABLE egresos ADD COLUMN anulado_en       TEXT;
ALTER TABLE egresos ADD COLUMN modificado_por   INTEGER REFERENCES usuarios(id);
ALTER TABLE egresos ADD COLUMN modificado_en    TEXT;
