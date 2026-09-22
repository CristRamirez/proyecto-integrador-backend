-- ============================================================
-- BS-1: bloqueo por intentos fallidos + roles del enunciado
-- Se corre UNA sola vez sobre la base que ya está creada en D1.
-- db/schema.sql quedó actualizado, pero sus CREATE TABLE no agregan
-- columnas a una tabla que ya existe.
-- ============================================================

ALTER TABLE usuarios ADD COLUMN intentos_fallidos INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN bloqueado_hasta TEXT;

INSERT OR IGNORE INTO roles (nombre) VALUES
  ('operador'),
  ('contador'),
  ('solo lectura');
