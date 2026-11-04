-- ============================================================
-- legajos vuelve a ser 1:N con internos: un legajo por estadía.
--
-- La base se creó con legajos.interno_id UNIQUE (commit 1c39c8d). schema.sql
-- lo sacó después, pero CREATE TABLE IF NOT EXISTS no toca una tabla que ya
-- existe, así que en D1 la restricción sigue y el reingreso (segundo legajo
-- del mismo interno) falla con:
--   UNIQUE constraint failed: legajos.interno_id
--
-- SQLite no permite sacar un UNIQUE con ALTER TABLE: se rehace la tabla y se
-- copian los datos (mismos ids). Ninguna tabla referencia a legajos.
--
-- Correr DESPUÉS de db/migracion_reingreso.sql y db/migracion_tipo_egreso.sql,
-- una sola vez:
--   npx wrangler d1 execute proyecto-integrador-aca --remote --file=db/migracion_legajos_1n.sql
-- Antes, respaldo:
--   npx wrangler d1 export proyecto-integrador-aca --remote --output=respaldo.sql
--
-- Si falla porque legajos_nueva ya existe, quedó una corrida a medias: NO
-- borrarla sin antes mirar si legajos todavía existe (puede tener los datos).
-- ============================================================

CREATE TABLE legajos_nueva (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  interno_id     INTEGER NOT NULL,                  -- 1:N con internos (sin UNIQUE)
  numero         TEXT    NOT NULL UNIQUE,           -- formato LEG-AAAAMMDD-NNNN, inmutable
  fecha_apertura TEXT    NOT NULL DEFAULT (datetime('now')),
  fecha_ingreso  TEXT,                              -- inicio de la estadía
  fecha_egreso   TEXT,                              -- NULL mientras el legajo está abierto
  motivo_egreso  TEXT,
  tipo_egreso    TEXT,                              -- alta_terapeutica, abandono, derivacion, otro
  FOREIGN KEY (interno_id) REFERENCES internos(id)
);

INSERT INTO legajos_nueva (id, interno_id, numero, fecha_apertura, fecha_ingreso, fecha_egreso, motivo_egreso, tipo_egreso)
SELECT id, interno_id, numero, fecha_apertura, fecha_ingreso, fecha_egreso, motivo_egreso, tipo_egreso
FROM legajos;

DROP TABLE legajos;

ALTER TABLE legajos_nueva RENAME TO legajos;

CREATE INDEX IF NOT EXISTS idx_legajos_interno ON legajos(interno_id);
