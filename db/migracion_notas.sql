-- Notas libres por interno: observaciones que no entran en los campos de la ficha.
--
-- db/schema.sql ya quedó actualizado, pero sus CREATE TABLE no corren sobre una
-- base que ya existe. Correr una sola vez:
--   npx wrangler d1 execute proyecto-integrador-aca --remote --file=db/migracion_notas.sql

CREATE TABLE IF NOT EXISTS notas (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  interno_id     INTEGER NOT NULL,
  texto          TEXT    NOT NULL,
  usuario_id     INTEGER,                               -- quién la escribió
  creado_en      TEXT    NOT NULL DEFAULT (datetime('now')),
  modificado_por INTEGER,
  modificado_en  TEXT,
  FOREIGN KEY (interno_id)     REFERENCES internos(id),
  FOREIGN KEY (usuario_id)     REFERENCES usuarios(id),
  FOREIGN KEY (modificado_por) REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_notas_interno ON notas(interno_id);
