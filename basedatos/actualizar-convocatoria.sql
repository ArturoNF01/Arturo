-- ---------------------------------------------------------------------
-- Datos oficiales de la convocatoria, sobre una base ya instalada.
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

commit;

select clave, valor from configuracion
 where clave in ('congreso_nombre', 'congreso_fechas', 'congreso_sede',
                 'congreso_fecha_inicio', 'congreso_fecha_fin',
                 'fecha_limite_registro', 'correo_contacto')
 order by clave;
