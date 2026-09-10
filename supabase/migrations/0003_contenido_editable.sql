-- =====================================================================
-- Contenido editable desde el panel: datos del congreso, ejes temáticos,
-- preguntas frecuentes y aviso de privacidad.
--
-- Los textos multilingües se guardan como jsonb con la forma
-- {"es": "...", "en": "...", "pt": "..."} para no multiplicar columnas.
--
-- Todos los valores sembrados aquí son PROPUESTAS: el comité organizador
-- los sustituye desde Panel → Configuración sin tocar el código.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Datos del congreso (se suman a la tabla `configuracion` ya existente)
-- ---------------------------------------------------------------------
insert into configuracion (clave, valor, descripcion) values
  ('congreso_nombre',
   '{"es": "1er Congreso Desafíos de la seguridad social en las Américas en el primer cuarto del siglo XXI", "en": "1st Congress: Challenges of social security in the Americas in the first quarter of the 21st century", "pt": "1º Congresso Desafios da seguridade social nas Américas no primeiro quarto do século XXI"}'::jsonb,
   'Nombre completo del congreso, en los tres idiomas'),

  ('congreso_nombre_corto',
   '{"es": "1er Congreso de Estudios Interamericanos de Seguridad Social", "en": "1st Congress of Inter-American Social Security Studies", "pt": "1º Congresso de Estudos Interamericanos de Seguridade Social"}'::jsonb,
   'Nombre corto para encabezados y correos'),

  ('congreso_sede',
   '{"es": "CIESS · Ciudad de México, México", "en": "CIESS · Mexico City, Mexico", "pt": "CIESS · Cidade do México, México"}'::jsonb,
   'PROPUESTA · Sede del congreso'),

  ('congreso_fechas',
   '{"es": "3, 4 y 5 de junio de 2026", "en": "3-5 June 2026", "pt": "3, 4 e 5 de junho de 2026"}'::jsonb,
   'PROPUESTA · Fechas del congreso tal como se muestran'),

  ('congreso_fecha_inicio', '"2026-06-03"'::jsonb, 'PROPUESTA · Primer día del congreso'),
  ('congreso_fecha_fin',    '"2026-06-05"'::jsonb, 'PROPUESTA · Último día del congreso'),

  ('limite_semblanza_palabras',   '60'::jsonb,   'Extensión máxima de la semblanza, en palabras'),
  ('limite_semblanza_caracteres', '420'::jsonb,  'Límite que verifica el formulario'),
  ('limite_resumen_caracteres',   '2000'::jsonb, 'Extensión máxima del resumen de ponencia'),
  ('foto_megabytes_maximo',       '10'::jsonb,   'Tamaño máximo de la fotografía de retrato')
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------
-- Ejes temáticos
-- ---------------------------------------------------------------------
create table if not exists ejes_tematicos (
  id             uuid primary key default gen_random_uuid(),
  clave          text unique not null,
  nombre         jsonb not null,
  descripcion    jsonb not null default '{}'::jsonb,
  orden          int not null default 0,
  activo         boolean not null default true,
  actualizado_en timestamptz not null default now()
);

drop trigger if exists trg_ejes_actualizado on ejes_tematicos;
create trigger trg_ejes_actualizado before update on ejes_tematicos
  for each row execute function tocar_actualizado_en();

drop trigger if exists trg_auditoria_ejes on ejes_tematicos;
create trigger trg_auditoria_ejes after insert or update or delete on ejes_tematicos
  for each row execute function registrar_auditoria();

-- PROPUESTA de ejes, a partir de los temas centrales de la seguridad social
-- en las Américas. Editables y ampliables desde el panel.
insert into ejes_tematicos (clave, nombre, descripcion, orden) values
  ('cobertura_informalidad',
   '{"es": "Cobertura, informalidad y nuevas formas de trabajo", "en": "Coverage, informality and new forms of work", "pt": "Cobertura, informalidade e novas formas de trabalho"}'::jsonb,
   '{"es": "Extensión de la cobertura a personas trabajadoras informales, independientes y de plataformas digitales.", "en": "Extending coverage to informal, self-employed and platform workers.", "pt": "Extensão da cobertura a trabalhadores informais, autônomos e de plataformas digitais."}'::jsonb, 1),

  ('sostenibilidad_pensiones',
   '{"es": "Sostenibilidad financiera y reformas de los sistemas de pensiones", "en": "Financial sustainability and pension system reform", "pt": "Sustentabilidade financeira e reformas dos sistemas de previdência"}'::jsonb,
   '{"es": "Suficiencia de las prestaciones, equilibrio actuarial y economía política de las reformas.", "en": "Benefit adequacy, actuarial balance and the political economy of reform.", "pt": "Suficiência dos benefícios, equilíbrio atuarial e economia política das reformas."}'::jsonb, 2),

  ('salud_cuidados_envejecimiento',
   '{"es": "Salud, cuidados de largo plazo y envejecimiento", "en": "Health, long-term care and ageing", "pt": "Saúde, cuidados de longa duração e envelhecimento"}'::jsonb,
   '{"es": "Transición demográfica, sistemas de cuidados y sostenibilidad de los servicios de salud.", "en": "Demographic transition, care systems and the sustainability of health services.", "pt": "Transição demográfica, sistemas de cuidados e sustentabilidade dos serviços de saúde."}'::jsonb, 3),

  ('desigualdad_genero',
   '{"es": "Protección social, desigualdad y género", "en": "Social protection, inequality and gender", "pt": "Proteção social, desigualdade e gênero"}'::jsonb,
   '{"es": "Brechas de acceso, trabajo de cuidados no remunerado y diseño de prestaciones con perspectiva de género.", "en": "Access gaps, unpaid care work and gender-responsive benefit design.", "pt": "Lacunas de acesso, trabalho de cuidado não remunerado e desenho de benefícios com perspectiva de gênero."}'::jsonb, 4),

  ('digitalizacion_gobernanza',
   '{"es": "Transformación digital y gobernanza de las instituciones", "en": "Digital transformation and institutional governance", "pt": "Transformação digital e governança das instituições"}'::jsonb,
   '{"es": "Datos, inteligencia artificial, transparencia y capacidad institucional de los organismos de seguridad social.", "en": "Data, artificial intelligence, transparency and institutional capacity of social security bodies.", "pt": "Dados, inteligência artificial, transparência e capacidade institucional dos organismos de seguridade social."}'::jsonb, 5),

  ('migracion_portabilidad',
   '{"es": "Migración, portabilidad de derechos y convenios internacionales", "en": "Migration, portability of rights and international agreements", "pt": "Migração, portabilidade de direitos e acordos internacionais"}'::jsonb,
   '{"es": "Convenios multilaterales, totalización de periodos y protección de personas trabajadoras migrantes.", "en": "Multilateral agreements, totalisation of periods and protection of migrant workers.", "pt": "Acordos multilaterais, totalização de períodos e proteção de trabalhadores migrantes."}'::jsonb, 6)
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------
-- Preguntas frecuentes
-- ---------------------------------------------------------------------
create table if not exists faqs (
  id             uuid primary key default gen_random_uuid(),
  clave          text unique not null,
  categoria      jsonb not null,
  pregunta       jsonb not null,
  respuesta      jsonb not null,
  orden          int not null default 0,
  activa         boolean not null default true,
  /** Marca la respuesta que aún depende de la convocatoria o la agenda. */
  provisional    boolean not null default false,
  actualizado_en timestamptz not null default now()
);

drop trigger if exists trg_faqs_actualizado on faqs;
create trigger trg_faqs_actualizado before update on faqs
  for each row execute function tocar_actualizado_en();

drop trigger if exists trg_auditoria_faqs on faqs;
create trigger trg_auditoria_faqs after insert or update or delete on faqs
  for each row execute function registrar_auditoria();

-- ---------------------------------------------------------------------
-- Aviso de privacidad, por bloques
-- ---------------------------------------------------------------------
create table if not exists aviso_privacidad (
  id             uuid primary key default gen_random_uuid(),
  clave          text unique not null,
  titulo         jsonb not null,
  /** Párrafos como arreglo de textos por idioma: {"es": ["…", "…"]} */
  parrafos       jsonb not null,
  orden          int not null default 0,
  activo         boolean not null default true,
  actualizado_en timestamptz not null default now()
);

drop trigger if exists trg_aviso_actualizado on aviso_privacidad;
create trigger trg_aviso_actualizado before update on aviso_privacidad
  for each row execute function tocar_actualizado_en();

drop trigger if exists trg_auditoria_aviso on aviso_privacidad;
create trigger trg_auditoria_aviso after insert or update or delete on aviso_privacidad
  for each row execute function registrar_auditoria();

-- ---------------------------------------------------------------------
-- RLS: lectura pública, escritura para organizadores
-- ---------------------------------------------------------------------
alter table ejes_tematicos   enable row level security;
alter table faqs             enable row level security;
alter table aviso_privacidad enable row level security;

drop policy if exists ejes_lectura on ejes_tematicos;
create policy ejes_lectura on ejes_tematicos for select using (true);
drop policy if exists ejes_escritura on ejes_tematicos;
create policy ejes_escritura on ejes_tematicos for all
  using (es_al_menos('organizador')) with check (es_al_menos('organizador'));

drop policy if exists faqs_lectura on faqs;
create policy faqs_lectura on faqs for select using (true);
drop policy if exists faqs_escritura on faqs;
create policy faqs_escritura on faqs for all
  using (es_al_menos('organizador')) with check (es_al_menos('organizador'));

drop policy if exists aviso_lectura on aviso_privacidad;
create policy aviso_lectura on aviso_privacidad for select using (true);
drop policy if exists aviso_escritura on aviso_privacidad;
create policy aviso_escritura on aviso_privacidad for all
  using (es_al_menos('superadmin')) with check (es_al_menos('superadmin'));

-- El aviso de privacidad sólo lo modifica un superadministrador: es el texto
-- que sostiene el consentimiento y su versión ante la LFPDPPP, la LGPD y el RGPD.
