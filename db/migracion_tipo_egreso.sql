-- ============================================================
-- Tipo de egreso en el legajo. Lo necesita RP-07 (recuperados y abandonos).
-- Se corre UNA sola vez sobre la base que ya está creada en D1:
--   npx wrangler d1 execute <base> --remote --file=db/migracion_tipo_egreso.sql
-- db/schema.sql quedó actualizado, pero sus CREATE TABLE no agregan
-- columnas a una tabla que ya existe.
-- ============================================================

ALTER TABLE legajos ADD COLUMN tipo_egreso TEXT;

-- Los egresos anteriores no tienen con qué clasificarse: quedan en 'otro'.
UPDATE legajos
SET tipo_egreso = 'otro'
WHERE fecha_egreso IS NOT NULL AND tipo_egreso IS NULL;
