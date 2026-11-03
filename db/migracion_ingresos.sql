-- Ingresos de la institución que no son cuotas: donaciones, subsidios, eventos.
--
-- db/schema.sql ya quedó actualizado, pero sus CREATE TABLE no corren sobre una
-- base que ya existe. Correr una sola vez:
--   npx wrangler d1 execute proyecto-integrador-aca --remote --file=db/migracion_ingresos.sql

CREATE TABLE IF NOT EXISTS ingresos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  medio_pago_id INTEGER NOT NULL,
  concepto      TEXT    NOT NULL,
  categoria     TEXT,                          -- origen del ingreso (donación, subsidio, etc.)
  monto         REAL    NOT NULL,
  fecha         TEXT    NOT NULL DEFAULT (datetime('now')),
  comprobante   TEXT,                          -- nro de recibo
  observaciones TEXT,
  usuario_id    INTEGER,                       -- quién lo registró
  creado_en     TEXT    NOT NULL DEFAULT (datetime('now')),
  -- Un ingreso no se borra: se anula. Sigue en el listado pero no suma.
  estado           TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'anulado')),
  motivo_anulacion TEXT,
  anulado_por      INTEGER,
  anulado_en       TEXT,
  FOREIGN KEY (medio_pago_id) REFERENCES medios_pago(id),
  FOREIGN KEY (usuario_id)    REFERENCES usuarios(id),
  FOREIGN KEY (anulado_por)   REFERENCES usuarios(id)
);
