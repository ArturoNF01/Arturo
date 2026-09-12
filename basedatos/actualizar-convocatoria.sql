-- ---------------------------------------------------------------------
-- Datos y contenido acordados, sobre una base ya instalada.
--
--   psql "$DATABASE_URL" -f basedatos/actualizar-convocatoria.sql
--
-- Va aparte del esquema a propósito. El esquema no toca estos valores
-- —son editables desde el panel y pisarlos en cada despliegue borraría
-- el trabajo de quien los ajustó—, así que la primera carga de los datos
-- reales se hace una vez, a mano y a conciencia.
--
-- Fuente: convocatoria oficial del 1er Congreso de Estudios
-- Interamericanos de Seguridad Social.
-- ---------------------------------------------------------------------
begin;

update configuracion set valor = '"2026-11-11"'::jsonb where clave = 'congreso_fecha_inicio';
update configuracion set valor = '"2026-11-13"'::jsonb where clave = 'congreso_fecha_fin';
update configuracion set valor = '"2026-10-30"'::jsonb where clave = 'fecha_limite_registro';

update configuracion set valor =
  '{"es": "11, 12 y 13 de noviembre de 2026", "en": "11-13 November 2026", "pt": "11, 12 e 13 de novembro de 2026"}'::jsonb
 where clave = 'congreso_fechas';

update configuracion set valor =
  '{"es": "1er Congreso de Estudios Interamericanos de Seguridad Social", "en": "1st Congress of Inter-American Social Security Studies", "pt": "1º Congresso de Estudos Interamericanos de Seguridade Social"}'::jsonb
 where clave = 'congreso_nombre';

update configuracion set valor = '"teresa.davila@ciss-bienestar.org"'::jsonb where clave = 'correo_contacto';

-- ---------------------------------------------------------------------
-- Aviso de privacidad: fuera los apartados de derechos y de seguridad.
--
-- Se apagan, no se borran: el texto sigue ahí por si el área jurídica los
-- quiere de vuelta, y basta con volver a encenderlos desde el panel.
update aviso_privacidad set activo = false
 where clave in ('bloque_07', 'bloque_08') and activo;

-- Los que seguían quedan renumerados: un aviso legal que salta del 6 al 9
-- se lee como un documento mal hecho.
update aviso_privacidad
   set titulo = jsonb_build_object(
         'es', regexp_replace(titulo->>'es', '^9\.', '7.'),
         'en', regexp_replace(titulo->>'en', '^9\.', '7.'),
         'pt', regexp_replace(titulo->>'pt', '^9\.', '7.')),
       orden = 7
 where clave = 'bloque_09';

update aviso_privacidad
   set titulo = jsonb_build_object(
         'es', regexp_replace(titulo->>'es', '^10\.', '8.'),
         'en', regexp_replace(titulo->>'en', '^10\.', '8.'),
         'pt', regexp_replace(titulo->>'pt', '^10\.', '8.')),
       orden = 8
 where clave = 'bloque_10';

commit;

select clave, valor from configuracion
 where clave in ('congreso_nombre', 'congreso_fechas', 'congreso_sede',
                 'congreso_fecha_inicio', 'congreso_fecha_fin',
                 'fecha_limite_registro', 'correo_contacto')
 order by clave;

select clave, orden, titulo->>'es' as apartado
  from aviso_privacidad where activo order by orden;
