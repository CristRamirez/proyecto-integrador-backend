-- La obra social pagadora pasa de estar escrita dentro de las observaciones a
-- tener su propia columna (FRD, sección 4.5). La necesita el reporte RP-06.
--
-- Correr una sola vez:
--   npx wrangler d1 execute proyecto-integrador-aca --remote --file=db/migracion_pagos_obra_social.sql
--
-- Antes conviene mirar qué quedó cargado:
--   SELECT id, observaciones FROM pagos WHERE observaciones LIKE 'Obra social pagadora:%';

ALTER TABLE pagos ADD COLUMN obra_social_id INTEGER REFERENCES obras_sociales(id);

-- Completa los pagos ya registrados leyendo el nombre del texto. El ORDER BY
-- por longitud resuelve el caso de una obra social cuyo nombre empieza igual
-- que el de otra.
UPDATE pagos
SET obra_social_id = (
  SELECT os.id
  FROM obras_sociales os
  WHERE pagos.observaciones LIKE 'Obra social pagadora: ' || os.nombre || '%'
  ORDER BY length(os.nombre) DESC
  LIMIT 1
)
WHERE observaciones LIKE 'Obra social pagadora: %';

-- Y saca ese texto de las observaciones, que ahora quedaría duplicado. Si venía
-- con una observación propia detrás del ' - ', esa se conserva.
UPDATE pagos
SET observaciones = CASE
  WHEN instr(observaciones, ' - ') > 0
    THEN nullif(trim(substr(observaciones, instr(observaciones, ' - ') + 3)), '')
  ELSE NULL
END
WHERE obra_social_id IS NOT NULL AND observaciones LIKE 'Obra social pagadora: %';
