-- Registro de entregas del cuestionario final.
CREATE TABLE IF NOT EXISTS entregas (
  id                 TEXT PRIMARY KEY,
  nombre             TEXT    NOT NULL,
  nombre_normalizado TEXT    NOT NULL,
  pais               TEXT    NOT NULL,
  aciertos           INTEGER NOT NULL,
  total              INTEGER NOT NULL,
  calificacion       REAL    NOT NULL,
  aprobado           INTEGER NOT NULL DEFAULT 0,
  duracion_seg       INTEGER NOT NULL DEFAULT 0,
  por_tiempo         INTEGER NOT NULL DEFAULT 0,
  respuestas         TEXT    NOT NULL,
  enviado_en         TEXT    NOT NULL
);

-- Un solo intento por participante.
CREATE UNIQUE INDEX IF NOT EXISTS idx_entregas_participante
  ON entregas (nombre_normalizado);

CREATE INDEX IF NOT EXISTS idx_entregas_fecha
  ON entregas (enviado_en DESC);
