-- =====================================================================
-- 1er Congreso · Esquema completo para PostgreSQL
--
-- Se ejecuta entero de una vez y se puede repetir sin romper nada:
--
--   psql "$DATABASE_URL" -f basedatos/esquema.sql
--   npm run esquema
--
-- Es la única definición del esquema. Los cambios se hacen aquí, cuidando
-- que sigan siendo repetibles (create ... if not exists, on conflict do
-- nothing, drop view antes de recrear).
-- =====================================================================

-- =====================================================================
-- Preámbulo: lo que en Supabase venía dado y aquí hay que declarar.
-- =====================================================================

create extension if not exists pgcrypto;

/**
 * Identificador del usuario del panel que está ejecutando la transacción.
 *
 * En Supabase esto lo resolvía auth.uid(). Aquí lo fija la aplicación con
 * `select set_config('app.usuario_id', $1, true)` al abrir la transacción,
 * y vale null cuando la operación no viene del panel: el alta pública de un
 * registro, un envío del cron, una migración.
 */
create or replace function usuario_actual_id() returns uuid
language plpgsql stable as $$
declare
  v_valor text;
begin
  v_valor := nullif(current_setting('app.usuario_id', true), '');
  return v_valor::uuid;
exception when others then
  -- Un valor mal formado no debe tumbar la operación: se trata como anónimo.
  return null;
end $$;

-- ### Esquema inicial ########################################

-- =====================================================================
-- 1er Congreso · Desafíos de la seguridad social en las Américas
-- Esquema inicial: registros, perfiles, roles de panel, auditoría,
-- plantillas de correo y configuración de cupos.
-- =====================================================================

create extension if not exists "pgcrypto";
-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
do $$ begin
  create type grupo_participante as enum ('interno', 'externo');
exception when duplicate_object then null; end $$;
do $$ begin
  create type modalidad_asistencia as enum ('presencial', 'en_linea');
exception when duplicate_object then null; end $$;
do $$ begin
  create type rol_panel as enum ('superadmin', 'organizador', 'cientifico_datos', 'lector');
exception when duplicate_object then null; end $$;
do $$ begin
  create type estado_registro as enum ('en_proceso', 'confirmado', 'lista_espera', 'cancelado');
exception when duplicate_object then null; end $$;
do $$ begin
  create type idioma as enum ('es', 'en', 'pt');
exception when duplicate_object then null; end $$;
-- ---------------------------------------------------------------------
-- Catálogo de perfiles de participante
-- ---------------------------------------------------------------------
create table if not exists perfiles (
  clave              text primary key,
  grupo              grupo_participante not null,
  nombre_es          text not null,
  nombre_en          text not null,
  nombre_pt          text not null,
  modalidad_default  modalidad_asistencia not null default 'presencial',
  permite_presencial boolean not null default true,
  permite_en_linea   boolean not null default true,
  requiere_academico boolean not null default false,  -- ponencia, resumen, eje temático
  requiere_semblanza boolean not null default false,  -- semblanza + personificador + foto
  requiere_logistica boolean not null default false,  -- alojamiento y traslados
  orden              int not null default 0,
  activo             boolean not null default true
);
insert into perfiles (clave, grupo, nombre_es, nombre_en, nombre_pt, modalidad_default,
                      permite_presencial, permite_en_linea, requiere_academico,
                      requiere_semblanza, requiere_logistica, orden) values
  ('funcionario_ciess',     'interno', 'Funcionario del CIESS',            'CIESS staff',                      'Funcionário do CIESS',                'presencial', true,  true,  false, false, false, 1),
  ('funcionario_ciss',      'interno', 'Funcionario de la CISS',           'CISS staff',                       'Funcionário da CISS',                 'presencial', true,  true,  false, false, false, 2),
  ('espectador_presencial', 'interno', 'Espectador en vivo',               'On-site attendee',                 'Espectador presencial',               'presencial', true,  false, false, false, false, 3),
  ('espectador_linea',      'externo', 'Espectador en línea',              'Online attendee',                  'Espectador online',                   'en_linea',   false, true,  false, false, false, 4),
  ('participante_externo',  'externo', 'Participante de otra institución', 'Participant from another entity',  'Participante de outra instituição',   'presencial', true,  true,  true,  false, true,  5),
  ('panelista',             'externo', 'Panelista',                        'Panelist',                         'Painelista',                          'presencial', true,  true,  true,  true,  true,  6),
  ('conferencista',         'externo', 'Conferencista',                    'Keynote speaker',                  'Conferencista',                       'presencial', true,  true,  true,  true,  true,  7)
on conflict (clave) do nothing;
-- ---------------------------------------------------------------------
-- Registros de participantes (todos los campos del formulario .gs)
-- ---------------------------------------------------------------------
create table if not exists registros (
  id                          uuid primary key default gen_random_uuid(),
  folio                       text unique not null,
  perfil                      text not null references perfiles(clave),
  grupo                       grupo_participante not null,
  modalidad                   modalidad_asistencia not null,
  idioma                      idioma not null default 'es',

  -- 1. Identificación
  apellidos                   text not null,
  nombres                     text not null,
  nombre_personificador       text,
  nombre_constancia           text,
  genero                      text,
  correo                      text not null,
  telefono_whatsapp           text,
  institucion                 text,
  cargo                       text,
  procedencia                 text,
  pais_residencia             text,
  entidad_federativa          text,
  ciudad_residencia           text,
  nacionalidad                text,
  orcid                       text,

  -- 2. Participación académica
  modalidad_participacion     text,
  eje_tematico                text,
  titulo_ponencia             text,
  resumen_ponencia            text,
  palabras_clave              text,
  coautoria                   text,

  -- 3. Semblanza
  semblanza                   text,
  semblanza_palabras          int generated always as (
                                case when semblanza is null or btrim(semblanza) = '' then 0
                                     else array_length(regexp_split_to_array(btrim(regexp_replace(semblanza, '\s+', ' ', 'g')), ' '), 1)
                                end) stored,
  linea_investigacion         text,
  foto_url                    text,
  foto_drive_id               text,

  -- 3.1 Documentación de invitación
  documentacion_solicitada    text[] default '{}',
  nombre_pasaporte            text,
  destinatario_oficio         text,
  autorizaciones              text[] default '{}',

  -- 4. Requerimientos en sala
  requerimientos_tecnicos     text[] default '{}',
  requerimientos_accesibilidad text,

  -- 5. Alojamiento
  requiere_alojamiento        boolean not null default false,
  fecha_entrada_hotel         date,
  fecha_salida_hotel          date,
  tipo_habitacion             text,
  comparte_habitacion_con     text,

  -- 6. Traslados
  requiere_traslado           text default 'No',
  medio_arribo                text,
  ciudad_origen               text,
  terminal_origen             text,
  fecha_llegada               date,
  hora_llegada                text,
  aerolinea_llegada           text,
  vuelo_llegada               text,
  fecha_salida                date,
  hora_salida                 text,
  aerolinea_salida            text,
  vuelo_salida                text,
  observaciones_traslado      text,
  hora_presentacion_llegada   text,
  hora_presentacion_salida    text,

  -- 7. Alimentación, facturación y cierre
  regimen_alimentario         text,
  alergias                    text,
  contacto_emergencia         text,
  apoyo_traslado              boolean default false,
  datos_viatico               text,
  requiere_factura            boolean default false,
  datos_facturacion           text,
  comentarios                 text,

  -- Protección de datos (LFPDPPP · LGPD · GDPR)
  consentimiento_datos        boolean not null default false,
  consentimiento_version      text not null default '1.0',
  consentimiento_fecha        timestamptz,
  consentimiento_comunicaciones boolean not null default false,

  -- Control
  estado                      estado_registro not null default 'en_proceso',
  token_edicion               uuid not null default gen_random_uuid(),
  sheets_sincronizado_en      timestamptz,
  sheets_error                text,
  correo_enviado_en           timestamptz,
  creado_en                   timestamptz not null default now(),
  actualizado_en              timestamptz not null default now()
);
create index if not exists registros_creado_en_idx on registros (creado_en desc);
create index if not exists registros_perfil_idx    on registros (perfil);
create index if not exists registros_pais_idx      on registros (pais_residencia);
create index if not exists registros_modalidad_idx on registros (modalidad);
create index if not exists registros_correo_idx    on registros (lower(correo));
-- Folio legible: REG-AAAAMMDD-XXXX
create or replace function generar_folio() returns trigger
language plpgsql as $$
begin
  if new.folio is null or new.folio = '' then
    new.folio := 'REG-' || to_char(now() at time zone 'America/Mexico_City', 'YYYYMMDD')
                 || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
  end if;
  return new;
end $$;
drop trigger if exists trg_registros_folio on registros;
create trigger trg_registros_folio before insert on registros
  for each row execute function generar_folio();
create or replace function tocar_actualizado_en() returns trigger
language plpgsql as $$
begin
  new.actualizado_en := now();
  return new;
end $$;
drop trigger if exists trg_registros_actualizado on registros;
create trigger trg_registros_actualizado before update on registros
  for each row execute function tocar_actualizado_en();
-- ---------------------------------------------------------------------
-- Usuarios del panel y roles
-- ---------------------------------------------------------------------
create table if not exists usuarios_panel (
  id            uuid primary key default gen_random_uuid(),
  correo        text not null,
  nombre        text,
  rol           rol_panel not null default 'lector',
  idioma        idioma not null default 'es',
  activo        boolean not null default true,
  creado_en     timestamptz not null default now(),
  ultimo_acceso timestamptz
);
create or replace function rol_actual() returns rol_panel
language sql stable security definer set search_path = public as $$
  select rol from usuarios_panel where id = usuario_actual_id() and activo;
$$;
create or replace function es_al_menos(minimo rol_panel) returns boolean
language sql stable as $$
  select case rol_actual()
    when 'superadmin'       then 4
    when 'organizador'      then 3
    when 'cientifico_datos' then 2
    when 'lector'           then 1
    else 0 end
  >= case minimo
    when 'superadmin'       then 4
    when 'organizador'      then 3
    when 'cientifico_datos' then 2
    when 'lector'           then 1
    end;
$$;
-- ---------------------------------------------------------------------
-- Auditoría: quién y cuándo modifica o elimina registros
-- ---------------------------------------------------------------------
create table if not exists auditoria (
  id             bigserial primary key,
  tabla          text not null,
  registro_id    text not null,
  accion         text not null,           -- INSERT | UPDATE | DELETE
  actor_id       uuid,
  actor_correo   text,
  actor_rol      text,
  origen         text not null default 'panel',  -- panel | formulario | sistema
  datos_previos  jsonb,
  datos_nuevos   jsonb,
  campos         text[],
  ocurrido_en    timestamptz not null default now()
);
create index if not exists auditoria_registro_idx on auditoria (tabla, registro_id, ocurrido_en desc);
create index if not exists auditoria_fecha_idx    on auditoria (ocurrido_en desc);
create or replace function registrar_auditoria() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_previos jsonb;
  v_nuevos  jsonb;
  v_campos  text[];
  v_correo  text;
  v_fila    jsonb;
begin
  select correo into v_correo from usuarios_panel where id = usuario_actual_id();

  if tg_op = 'DELETE' then
    v_previos := to_jsonb(old);
  elsif tg_op = 'INSERT' then
    v_nuevos := to_jsonb(new);
  else
    v_previos := to_jsonb(old);
    v_nuevos  := to_jsonb(new);
    select array_agg(clave) into v_campos
      from jsonb_each(v_nuevos) as n(clave, valor)
      where n.valor is distinct from v_previos -> n.clave;
  end if;

  -- No toda tabla auditada se identifica por «id»: la configuración usa
  -- «clave». Se toma la que exista, del jsonb que ya se calculó arriba.
  v_fila := case when tg_op = 'DELETE' then v_previos else v_nuevos end;

  insert into auditoria (tabla, registro_id, accion, actor_id, actor_correo, actor_rol,
                         origen, datos_previos, datos_nuevos, campos)
  values (tg_table_name,
          coalesce(v_fila ->> 'id', v_fila ->> 'clave', ''),
          tg_op, usuario_actual_id(), v_correo, rol_actual()::text,
          case when usuario_actual_id() is null then 'sistema' else 'panel' end,
          v_previos, v_nuevos, v_campos);

  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists trg_auditoria_registros on registros;
create trigger trg_auditoria_registros
  after insert or update or delete on registros
  for each row execute function registrar_auditoria();
-- ---------------------------------------------------------------------
-- Plantillas de correo editables desde el panel
-- ---------------------------------------------------------------------
create table if not exists plantillas_correo (
  id            uuid primary key default gen_random_uuid(),
  clave         text not null,             -- confirmacion_registro | edicion_registro | lista_espera
  idioma        idioma not null,
  asunto        text not null,
  cuerpo_html   text not null,
  activa        boolean not null default true,
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid references usuarios_panel(id),
  unique (clave, idioma)
);
drop trigger if exists trg_plantillas_actualizado on plantillas_correo;
create trigger trg_plantillas_actualizado before update on plantillas_correo
  for each row execute function tocar_actualizado_en();
drop trigger if exists trg_auditoria_plantillas on plantillas_correo;
create trigger trg_auditoria_plantillas
  after insert or update or delete on plantillas_correo
  for each row execute function registrar_auditoria();
-- ---------------------------------------------------------------------
-- Configuración general (cupos, fechas, enlaces)
-- ---------------------------------------------------------------------
create table if not exists configuracion (
  clave          text primary key,
  valor          jsonb not null,
  descripcion    text,
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid references usuarios_panel(id)
);
insert into configuracion (clave, valor, descripcion) values
  ('cupos_presenciales', '300'::jsonb, 'Lugares disponibles en modalidad presencial'),
  ('cupos_en_linea',     'null'::jsonb, 'Lugares en línea;
null = sin límite'),
  ('registro_abierto',   'true'::jsonb, 'Permite recibir nuevos registros'),
  ('fecha_limite_registro', '"2026-05-15"'::jsonb, 'Fecha límite de registro y de edición'),
  ('url_agenda',  '"https://home.ciess.org/wp-content/uploads/2026/03/Convocatoria-congreso.pdf"'::jsonb, 'PDF de agenda/convocatoria'),
  ('url_video_login', '"https://home.ciess.org/wp-content/uploads/2026/03/1er-Congreso-de-Estudios-Interamericanos-de-Seguridad-Social-B.mp4"'::jsonb, 'Video de fondo del login'),
  ('correo_contacto', '"congreso@ciess.org"'::jsonb, 'Correo de contacto del comité organizador')
on conflict (clave) do nothing;
drop trigger if exists trg_config_actualizado on configuracion;
create trigger trg_config_actualizado before update on configuracion
  for each row execute function tocar_actualizado_en();
drop trigger if exists trg_auditoria_config on configuracion;
create trigger trg_auditoria_config
  after insert or update or delete on configuracion
  for each row execute function registrar_auditoria();
-- ---------------------------------------------------------------------
-- Cupos: vista y verificación
-- ---------------------------------------------------------------------
drop view if exists cupos_estado;
create view cupos_estado as
select
  (select (valor #>> '{}')::int from configuracion where clave = 'cupos_presenciales') as cupo_presencial,
  (select count(*) from registros where modalidad = 'presencial' and estado <> 'cancelado') as ocupado_presencial,
  (select (valor #>> '{}')::int from configuracion where clave = 'cupos_en_linea') as cupo_en_linea,
  (select count(*) from registros where modalidad = 'en_linea' and estado <> 'cancelado') as ocupado_en_linea,
  (select (valor #>> '{}')::boolean from configuracion where clave = 'registro_abierto') as registro_abierto;
-- ---------------------------------------------------------------------
-- Vistas analíticas para el dashboard
-- ---------------------------------------------------------------------
drop view if exists v_registros_por_dia;
create view v_registros_por_dia as
select date_trunc('day', creado_en at time zone 'America/Mexico_City')::date as dia,
       count(*) as total
from registros where estado <> 'cancelado'
group by 1 order by 1;
drop view if exists v_actividad_hora_dia;
create view v_actividad_hora_dia as
select extract(dow  from creado_en at time zone 'America/Mexico_City')::int as dia_semana,
       extract(hour from creado_en at time zone 'America/Mexico_City')::int as hora,
       count(*) as total
from registros where estado <> 'cancelado'
group by 1, 2;
drop view if exists v_registros_por_pais;
create view v_registros_por_pais as
select coalesce(nullif(btrim(pais_residencia), ''), 'Sin especificar') as pais, count(*) as total
from registros where estado <> 'cancelado'
group by 1 order by 2 desc;


-- ### Plantillas y sql lectura ########################################

-- =====================================================================
-- Plantillas de correo trilingües + consulta SQL de sólo lectura
-- para el perfil de científico de datos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Plantillas iniciales (editables desde el panel)
-- Variables disponibles: {{folio}} {{nombre}} {{perfil}} {{modalidad}}
--                        {{correo}} {{fecha_limite}} {{url_edicion}}
--                        {{url_agenda}} {{correo_contacto}}
-- ---------------------------------------------------------------------
insert into plantillas_correo (clave, idioma, asunto, cuerpo_html) values
('confirmacion_registro', 'es',
 'Registro recibido · 1er Congreso de Estudios Interamericanos de Seguridad Social',
 $html$<p>Estimada persona participante:</p>
<p>Confirmamos la recepción de su registro para el <strong>1er Congreso Desafíos de la seguridad social en las Américas en el primer cuarto del siglo XXI</strong>.</p>
<ul>
  <li><strong>Folio:</strong> {{folio}}</li>
  <li><strong>Nombre registrado:</strong> {{nombre}}</li>
  <li><strong>Perfil de participación:</strong> {{perfil}}</li>
  <li><strong>Modalidad:</strong> {{modalidad}}</li>
</ul>
<p>Puede consultar o modificar sus datos hasta el {{fecha_limite}} en el siguiente enlace: <a href="{{url_edicion}}">{{url_edicion}}</a></p>
<p>La convocatoria y la agenda están disponibles en <a href="{{url_agenda}}">este documento</a>.</p>
<p>Cualquier corrección posterior debe solicitarse a {{correo_contacto}}.</p>
<p>Comité organizador<br/>CIESS · CISS</p>$html$),

('confirmacion_registro', 'en',
 'Registration received · 1st Congress of Inter-American Social Security Studies',
 $html$<p>Dear participant,</p>
<p>We confirm receipt of your registration for the <strong>1st Congress: Challenges of social security in the Americas in the first quarter of the 21st century</strong>.</p>
<ul>
  <li><strong>Reference:</strong> {{folio}}</li>
  <li><strong>Registered name:</strong> {{nombre}}</li>
  <li><strong>Participation profile:</strong> {{perfil}}</li>
  <li><strong>Format:</strong> {{modalidad}}</li>
</ul>
<p>You may review or edit your details until {{fecha_limite}} at the following link: <a href="{{url_edicion}}">{{url_edicion}}</a></p>
<p>The call for papers and the agenda are available in <a href="{{url_agenda}}">this document</a>.</p>
<p>Any later correction must be requested at {{correo_contacto}}.</p>
<p>Organizing committee<br/>CIESS · CISS</p>$html$),

('confirmacion_registro', 'pt',
 'Inscrição recebida · 1º Congresso de Estudos Interamericanos de Seguridade Social',
 $html$<p>Prezada pessoa participante,</p>
<p>Confirmamos o recebimento da sua inscrição para o <strong>1º Congresso Desafios da seguridade social nas Américas no primeiro quarto do século XXI</strong>.</p>
<ul>
  <li><strong>Protocolo:</strong> {{folio}}</li>
  <li><strong>Nome inscrito:</strong> {{nombre}}</li>
  <li><strong>Perfil de participação:</strong> {{perfil}}</li>
  <li><strong>Modalidade:</strong> {{modalidad}}</li>
</ul>
<p>Você pode consultar ou alterar seus dados até {{fecha_limite}} no seguinte link: <a href="{{url_edicion}}">{{url_edicion}}</a></p>
<p>A convocatória e a agenda estão disponíveis <a href="{{url_agenda}}">neste documento</a>.</p>
<p>Qualquer correção posterior deve ser solicitada a {{correo_contacto}}.</p>
<p>Comitê organizador<br/>CIESS · CISS</p>$html$),

('edicion_registro', 'es', 'Registro actualizado · 1er Congreso',
 $html$<p>Estimada persona participante:</p><p>Sus datos de registro (folio {{folio}}) fueron actualizados correctamente el {{fecha}}.</p><p>Si usted no realizó este cambio, escriba a {{correo_contacto}}.</p><p>Comité organizador</p>$html$),
('edicion_registro', 'en', 'Registration updated · 1st Congress',
 $html$<p>Dear participant,</p><p>Your registration details (reference {{folio}}) were successfully updated on {{fecha}}.</p><p>If you did not make this change, please write to {{correo_contacto}}.</p><p>Organizing committee</p>$html$),
('edicion_registro', 'pt', 'Inscrição atualizada · 1º Congresso',
 $html$<p>Prezada pessoa participante,</p><p>Seus dados de inscrição (protocolo {{folio}}) foram atualizados em {{fecha}}.</p><p>Se você não fez esta alteração, escreva para {{correo_contacto}}.</p><p>Comitê organizador</p>$html$),

('lista_espera', 'es', 'Lista de espera · 1er Congreso',
 $html$<p>Estimada persona participante:</p><p>Los lugares presenciales se encuentran agotados. Su registro (folio {{folio}}) quedó en <strong>lista de espera</strong>; le avisaremos si se libera un lugar. También puede participar en modalidad en línea.</p><p>Comité organizador</p>$html$),
('lista_espera', 'en', 'Waiting list · 1st Congress',
 $html$<p>Dear participant,</p><p>On-site seats are sold out. Your registration (reference {{folio}}) is on the <strong>waiting list</strong>; we will notify you if a seat becomes available. You may also join online.</p><p>Organizing committee</p>$html$),
('lista_espera', 'pt', 'Lista de espera · 1º Congresso',
 $html$<p>Prezada pessoa participante,</p><p>As vagas presenciais estão esgotadas. Sua inscrição (protocolo {{folio}}) ficou na <strong>lista de espera</strong>; avisaremos se uma vaga for liberada. Você também pode participar online.</p><p>Comitê organizador</p>$html$)
on conflict (clave, idioma) do nothing;
-- ---------------------------------------------------------------------
-- Consultas SQL directas para científicos de datos.
-- Sólo SELECT/WITH, una sentencia, límite de filas y de tiempo.
-- ---------------------------------------------------------------------
create or replace function ejecutar_sql_lectura(consulta text, limite int default 1000)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  q         text := btrim(regexp_replace(consulta, ';\s*$', ''));
  resultado jsonb;
begin
  if not es_al_menos('cientifico_datos') then
    raise exception 'Acceso denegado: se requiere perfil de científico de datos.';
  end if;

  if q !~* '^\s*(select|with)\s' then
    raise exception 'Sólo se permiten consultas SELECT o WITH.';
  end if;

  if q like '%;%' then
    raise exception 'Sólo se permite una sentencia por consulta.';
  end if;

  if q ~* '\m(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|vacuum|call|do)\M' then
    raise exception 'La consulta contiene una instrucción no permitida.';
  end if;

  set local statement_timeout = '15s';

  execute format(
    'select coalesce(jsonb_agg(t), ''[]''::jsonb) from (select * from (%s) s limit %s) t',
    q, least(greatest(limite, 1), 10000)
  ) into resultado;

  return resultado;
end $$;

-- ### Contenido editable ########################################

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
-- El aviso de privacidad sólo lo modifica un superadministrador: es el texto
-- que sostiene el consentimiento y su versión ante la LFPDPPP, la LGPD y el RGPD.

-- ### Estados y lista espera ########################################

-- =====================================================================
-- Gestión del estado de los registros: plantillas de aviso y vista de la
-- lista de espera con su orden de llegada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Plantillas de los cambios de estado que el participante debe conocer
-- ---------------------------------------------------------------------
insert into plantillas_correo (clave, idioma, asunto, cuerpo_html) values
('registro_confirmado', 'es',
 'Registro confirmado · 1er Congreso de Estudios Interamericanos de Seguridad Social',
 $html$<p>Estimada persona participante:</p>
<p>Su registro para el <strong>1er Congreso Desafíos de la seguridad social en las Américas en el primer cuarto del siglo XXI</strong> quedó <strong>confirmado</strong>.</p>
<ul>
  <li><strong>Folio:</strong> {{folio}}</li>
  <li><strong>Nombre:</strong> {{nombre}}</li>
  <li><strong>Modalidad:</strong> {{modalidad}}</li>
</ul>
<p>Puede consultar o corregir sus datos hasta el {{fecha_limite}} en <a href="{{url_edicion}}">este enlace</a>. La información logística y el programa se enviarán por esta misma vía.</p>
<p>Cualquier duda, escriba a {{correo_contacto}}.</p>
<p>Comité organizador<br/>CIESS · CISS</p>$html$),

('registro_confirmado', 'en',
 'Registration confirmed · 1st Congress of Inter-American Social Security Studies',
 $html$<p>Dear participant,</p>
<p>Your registration for the <strong>1st Congress: Challenges of social security in the Americas in the first quarter of the 21st century</strong> is now <strong>confirmed</strong>.</p>
<ul>
  <li><strong>Reference:</strong> {{folio}}</li>
  <li><strong>Name:</strong> {{nombre}}</li>
  <li><strong>Format:</strong> {{modalidad}}</li>
</ul>
<p>You may review or correct your details until {{fecha_limite}} at <a href="{{url_edicion}}">this link</a>. Logistical information and the programme will be sent through this same channel.</p>
<p>For any questions, write to {{correo_contacto}}.</p>
<p>Organizing committee<br/>CIESS · CISS</p>$html$),

('registro_confirmado', 'pt',
 'Inscrição confirmada · 1º Congresso de Estudos Interamericanos de Seguridade Social',
 $html$<p>Prezada pessoa participante,</p>
<p>Sua inscrição no <strong>1º Congresso Desafios da seguridade social nas Américas no primeiro quarto do século XXI</strong> foi <strong>confirmada</strong>.</p>
<ul>
  <li><strong>Protocolo:</strong> {{folio}}</li>
  <li><strong>Nome:</strong> {{nombre}}</li>
  <li><strong>Modalidade:</strong> {{modalidad}}</li>
</ul>
<p>Você pode consultar ou corrigir seus dados até {{fecha_limite}} <a href="{{url_edicion}}">neste link</a>. As informações logísticas e a programação serão enviadas por esta mesma via.</p>
<p>Em caso de dúvida, escreva para {{correo_contacto}}.</p>
<p>Comitê organizador<br/>CIESS · CISS</p>$html$),

('registro_cancelado', 'es', 'Registro cancelado · 1er Congreso',
 $html$<p>Estimada persona participante:</p><p>Su registro con folio {{folio}} fue <strong>cancelado</strong>. Si se trata de un error, escriba a {{correo_contacto}} lo antes posible.</p><p>Comité organizador</p>$html$),
('registro_cancelado', 'en', 'Registration cancelled · 1st Congress',
 $html$<p>Dear participant,</p><p>Your registration with reference {{folio}} has been <strong>cancelled</strong>. If this is a mistake, please write to {{correo_contacto}} as soon as possible.</p><p>Organizing committee</p>$html$),
('registro_cancelado', 'pt', 'Inscrição cancelada · 1º Congresso',
 $html$<p>Prezada pessoa participante,</p><p>Sua inscrição com o protocolo {{folio}} foi <strong>cancelada</strong>. Se isso for um engano, escreva para {{correo_contacto}} o quanto antes.</p><p>Comitê organizador</p>$html$)
on conflict (clave, idioma) do nothing;
-- ---------------------------------------------------------------------
-- Lista de espera, en orden de llegada
-- ---------------------------------------------------------------------
drop view if exists v_lista_espera;
create view v_lista_espera as
select
  id, folio, creado_en, nombres, apellidos, correo, institucion, pais_residencia,
  perfil, modalidad, idioma,
  row_number() over (order by creado_en) as turno
from registros
where estado = 'lista_espera'
order by creado_en;
-- La ocupación presencial cuenta lo que no está cancelado ni en espera: un
-- registro en lista de espera todavía no tiene lugar asignado.
drop view if exists cupos_estado;
create view cupos_estado as
select
  (select (valor #>> '{}')::int from configuracion where clave = 'cupos_presenciales') as cupo_presencial,
  (select count(*) from registros
     where modalidad = 'presencial' and estado not in ('cancelado', 'lista_espera')) as ocupado_presencial,
  (select (valor #>> '{}')::int from configuracion where clave = 'cupos_en_linea') as cupo_en_linea,
  (select count(*) from registros
     where modalidad = 'en_linea' and estado not in ('cancelado', 'lista_espera')) as ocupado_en_linea,
  (select count(*) from registros where estado = 'lista_espera') as en_lista_espera,
  (select (valor #>> '{}')::boolean from configuracion where clave = 'registro_abierto') as registro_abierto;

-- ### Dictamen ponencias ########################################

-- =====================================================================
-- Dictaminación de ponencias por el comité científico.
--
-- El dictamen vive en el propio registro: una ponencia pertenece a quien
-- se inscribió, y separarla en otra tabla obligaría a mantener dos
-- identidades de la misma persona.
-- =====================================================================

do $$ begin
  create type estado_ponencia as enum (
    'sin_dictamen', 'en_revision', 'aceptada', 'aceptada_con_cambios', 'rechazada'
  );
exception when duplicate_object then null; end $$;
alter table registros
  add column if not exists estado_ponencia estado_ponencia not null default 'sin_dictamen',
  add column if not exists dictamen_comentarios text,
  add column if not exists dictamen_por uuid references usuarios_panel(id),
  add column if not exists dictamen_en timestamptz;
create index if not exists registros_estado_ponencia_idx
  on registros (estado_ponencia)
  where estado_ponencia <> 'sin_dictamen';
-- ---------------------------------------------------------------------
-- Ponencias a dictaminar: sólo quien presenta trabajo académico
-- ---------------------------------------------------------------------
drop view if exists v_ponencias;
create view v_ponencias as
select
  r.id, r.folio, r.creado_en, r.nombres, r.apellidos, r.correo, r.institucion,
  r.pais_residencia, r.perfil, r.idioma, r.estado, r.modalidad_participacion,
  r.eje_tematico, r.titulo_ponencia, r.resumen_ponencia, r.palabras_clave,
  r.coautoria, r.semblanza, r.semblanza_palabras,
  r.estado_ponencia, r.dictamen_comentarios, r.dictamen_en,
  u.correo as dictamen_por_correo
from registros r
left join usuarios_panel u on u.id = r.dictamen_por
where r.estado <> 'cancelado'
  and (coalesce(btrim(r.titulo_ponencia), '') <> ''
       or coalesce(btrim(r.resumen_ponencia), '') <> '')
order by r.creado_en;
-- ---------------------------------------------------------------------
-- Plantillas del dictamen
-- ---------------------------------------------------------------------
insert into plantillas_correo (clave, idioma, asunto, cuerpo_html) values
('ponencia_aceptada', 'es', 'Ponencia aceptada · 1er Congreso',
 $html$<p>Estimada persona participante:</p>
<p>Nos complace informarle que el comité científico <strong>aceptó</strong> su propuesta para el 1er Congreso.</p>
<ul><li><strong>Folio:</strong> {{folio}}</li><li><strong>Título:</strong> {{titulo_ponencia}}</li><li><strong>Eje temático:</strong> {{eje_tematico}}</li></ul>
{{comentarios_bloque}}
<p>El día, la hora y la mesa asignada se comunicarán con el programa definitivo. Cualquier duda, escriba a {{correo_contacto}}.</p>
<p>Comité científico<br/>CIESS · CISS</p>$html$),
('ponencia_aceptada', 'en', 'Paper accepted · 1st Congress',
 $html$<p>Dear participant,</p>
<p>We are pleased to inform you that the scientific committee has <strong>accepted</strong> your proposal for the 1st Congress.</p>
<ul><li><strong>Reference:</strong> {{folio}}</li><li><strong>Title:</strong> {{titulo_ponencia}}</li><li><strong>Thematic axis:</strong> {{eje_tematico}}</li></ul>
{{comentarios_bloque}}
<p>The date, time and panel will be announced with the final programme. For any questions, write to {{correo_contacto}}.</p>
<p>Scientific committee<br/>CIESS · CISS</p>$html$),
('ponencia_aceptada', 'pt', 'Trabalho aceito · 1º Congresso',
 $html$<p>Prezada pessoa participante,</p>
<p>Temos o prazer de informar que o comitê científico <strong>aceitou</strong> sua proposta para o 1º Congresso.</p>
<ul><li><strong>Protocolo:</strong> {{folio}}</li><li><strong>Título:</strong> {{titulo_ponencia}}</li><li><strong>Eixo temático:</strong> {{eje_tematico}}</li></ul>
{{comentarios_bloque}}
<p>A data, o horário e a mesa serão comunicados com a programação definitiva. Em caso de dúvida, escreva para {{correo_contacto}}.</p>
<p>Comitê científico<br/>CIESS · CISS</p>$html$),

('ponencia_aceptada_con_cambios', 'es', 'Ponencia aceptada con cambios · 1er Congreso',
 $html$<p>Estimada persona participante:</p>
<p>El comité científico <strong>aceptó su propuesta con cambios</strong>. Le pedimos atender las observaciones y reenviar la versión corregida antes del {{fecha_limite}}.</p>
<ul><li><strong>Folio:</strong> {{folio}}</li><li><strong>Título:</strong> {{titulo_ponencia}}</li></ul>
{{comentarios_bloque}}
<p>Puede actualizar su resumen en <a href="{{url_edicion}}">este enlace</a>.</p>
<p>Comité científico<br/>CIESS · CISS</p>$html$),
('ponencia_aceptada_con_cambios', 'en', 'Paper accepted with changes · 1st Congress',
 $html$<p>Dear participant,</p>
<p>The scientific committee has <strong>accepted your proposal with changes</strong>. Please address the comments and resubmit the corrected version before {{fecha_limite}}.</p>
<ul><li><strong>Reference:</strong> {{folio}}</li><li><strong>Title:</strong> {{titulo_ponencia}}</li></ul>
{{comentarios_bloque}}
<p>You can update your abstract at <a href="{{url_edicion}}">this link</a>.</p>
<p>Scientific committee<br/>CIESS · CISS</p>$html$),
('ponencia_aceptada_con_cambios', 'pt', 'Trabalho aceito com alterações · 1º Congresso',
 $html$<p>Prezada pessoa participante,</p>
<p>O comitê científico <strong>aceitou sua proposta com alterações</strong>. Pedimos que atenda às observações e reenvie a versão corrigida até {{fecha_limite}}.</p>
<ul><li><strong>Protocolo:</strong> {{folio}}</li><li><strong>Título:</strong> {{titulo_ponencia}}</li></ul>
{{comentarios_bloque}}
<p>Você pode atualizar seu resumo <a href="{{url_edicion}}">neste link</a>.</p>
<p>Comitê científico<br/>CIESS · CISS</p>$html$),

('ponencia_rechazada', 'es', 'Resultado del dictamen · 1er Congreso',
 $html$<p>Estimada persona participante:</p>
<p>Agradecemos el envío de su propuesta al 1er Congreso. Tras la revisión, el comité científico <strong>no pudo incluirla</strong> en el programa de esta edición.</p>
<ul><li><strong>Folio:</strong> {{folio}}</li><li><strong>Título:</strong> {{titulo_ponencia}}</li></ul>
{{comentarios_bloque}}
<p>Su registro sigue vigente y puede participar como asistente. Agradecemos su interés y esperamos contar con usted.</p>
<p>Comité científico<br/>CIESS · CISS</p>$html$),
('ponencia_rechazada', 'en', 'Review outcome · 1st Congress',
 $html$<p>Dear participant,</p>
<p>Thank you for submitting your proposal to the 1st Congress. After review, the scientific committee <strong>was unable to include it</strong> in the programme for this edition.</p>
<ul><li><strong>Reference:</strong> {{folio}}</li><li><strong>Title:</strong> {{titulo_ponencia}}</li></ul>
{{comentarios_bloque}}
<p>Your registration remains valid and you are welcome to attend. We appreciate your interest and hope to see you there.</p>
<p>Scientific committee<br/>CIESS · CISS</p>$html$),
('ponencia_rechazada', 'pt', 'Resultado da avaliação · 1º Congresso',
 $html$<p>Prezada pessoa participante,</p>
<p>Agradecemos o envio da sua proposta ao 1º Congresso. Após a avaliação, o comitê científico <strong>não pôde incluí-la</strong> na programação desta edição.</p>
<ul><li><strong>Protocolo:</strong> {{folio}}</li><li><strong>Título:</strong> {{titulo_ponencia}}</li></ul>
{{comentarios_bloque}}
<p>Sua inscrição continua válida e você pode participar como ouvinte. Agradecemos seu interesse e esperamos contar com você.</p>
<p>Comitê científico<br/>CIESS · CISS</p>$html$)
on conflict (clave, idioma) do nothing;

-- ### Recordatorios ########################################

-- =====================================================================
-- Correos de recordatorio antes del congreso.
--
-- Cada envío queda asentado con una restricción única para que un cron que
-- se ejecute dos veces el mismo día no vuelva a escribir a nadie.
-- =====================================================================

create table if not exists envios_recordatorio (
  id           bigserial primary key,
  registro_id  uuid not null references registros(id) on delete cascade,
  /** Identifica el recordatorio: 't_30', 't_7', 't_1'. */
  clave        text not null,
  enviado_en   timestamptz not null default now(),
  error        text,
  unique (registro_id, clave)
);
create index if not exists envios_recordatorio_fecha_idx
  on envios_recordatorio (enviado_en desc);
-- Los envíos los escribe el cron con la clave de servicio, que ignora RLS.

-- ---------------------------------------------------------------------
-- Configuración de los recordatorios
-- ---------------------------------------------------------------------
insert into configuracion (clave, valor, descripcion) values
  ('recordatorios',
   '[{"clave":"t_30","dias_antes":30,"activo":true},
     {"clave":"t_7","dias_antes":7,"activo":true},
     {"clave":"t_1","dias_antes":1,"activo":true}]'::jsonb,
   'Recordatorios antes del congreso: días de antelación y si están activos')
on conflict (clave) do nothing;
-- ---------------------------------------------------------------------
-- Plantilla del recordatorio
-- ---------------------------------------------------------------------
insert into plantillas_correo (clave, idioma, asunto, cuerpo_html) values
('recordatorio', 'es', 'Faltan {{dias_faltantes}} días · 1er Congreso',
 $html$<p>Estimada persona participante:</p>
<p>Le recordamos que el <strong>1er Congreso Desafíos de la seguridad social en las Américas en el primer cuarto del siglo XXI</strong> comienza en <strong>{{dias_faltantes}} días</strong>.</p>
<ul>
  <li><strong>Folio:</strong> {{folio}}</li>
  <li><strong>Modalidad:</strong> {{modalidad}}</li>
  <li><strong>Sede y fechas:</strong> {{sede}} · {{fechas}}</li>
</ul>
<p>Puede revisar sus datos en <a href="{{url_edicion}}">este enlace</a> y consultar la agenda <a href="{{url_agenda}}">aquí</a>.</p>
<p>Cualquier duda, escriba a {{correo_contacto}}.</p>
<p>Comité organizador<br/>CIESS · CISS</p>$html$),

('recordatorio', 'en', '{{dias_faltantes}} days to go · 1st Congress',
 $html$<p>Dear participant,</p>
<p>A reminder that the <strong>1st Congress: Challenges of social security in the Americas in the first quarter of the 21st century</strong> starts in <strong>{{dias_faltantes}} days</strong>.</p>
<ul>
  <li><strong>Reference:</strong> {{folio}}</li>
  <li><strong>Format:</strong> {{modalidad}}</li>
  <li><strong>Venue and dates:</strong> {{sede}} · {{fechas}}</li>
</ul>
<p>You can review your details at <a href="{{url_edicion}}">this link</a> and see the agenda <a href="{{url_agenda}}">here</a>.</p>
<p>For any questions, write to {{correo_contacto}}.</p>
<p>Organizing committee<br/>CIESS · CISS</p>$html$),

('recordatorio', 'pt', 'Faltam {{dias_faltantes}} dias · 1º Congresso',
 $html$<p>Prezada pessoa participante,</p>
<p>Lembramos que o <strong>1º Congresso Desafios da seguridade social nas Américas no primeiro quarto do século XXI</strong> começa em <strong>{{dias_faltantes}} dias</strong>.</p>
<ul>
  <li><strong>Protocolo:</strong> {{folio}}</li>
  <li><strong>Modalidade:</strong> {{modalidad}}</li>
  <li><strong>Sede e datas:</strong> {{sede}} · {{fechas}}</li>
</ul>
<p>Você pode revisar seus dados <a href="{{url_edicion}}">neste link</a> e consultar a programação <a href="{{url_agenda}}">aqui</a>.</p>
<p>Em caso de dúvida, escreva para {{correo_contacto}}.</p>
<p>Comitê organizador<br/>CIESS · CISS</p>$html$)
on conflict (clave, idioma) do nothing;
-- ---------------------------------------------------------------------
-- Avance de los envíos, para el panel
-- ---------------------------------------------------------------------
drop view if exists v_recordatorios_enviados;
create view v_recordatorios_enviados as
select clave, count(*) as enviados, count(*) filter (where error is not null) as con_error,
       max(enviado_en) as ultimo_envio
from envios_recordatorio
group by clave;

-- ### Antiabuso ########################################

-- =====================================================================
-- Protección del formulario público.
--
-- Un formulario abierto en internet recibe envíos automatizados y
-- duplicados accidentales. Aquí se guarda lo mínimo para frenarlos: una
-- huella derivada de la dirección de origen —nunca la dirección misma— y
-- la fecha del intento. Las filas se purgan a las 24 horas.
-- =====================================================================

create table if not exists intentos_registro (
  id         bigserial primary key,
  /** SHA-256 de la dirección de origen con una sal del servidor. No es
      reversible y no se guarda la dirección. */
  huella     text not null,
  creado_en  timestamptz not null default now()
);
create index if not exists intentos_registro_huella_idx
  on intentos_registro (huella, creado_en desc);
create index if not exists intentos_registro_fecha_idx
  on intentos_registro (creado_en);
/** Borra los intentos que ya no sirven para contar. Lo llama el cron diario. */
create or replace function purgar_intentos_registro()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  borrados integer;
begin
  delete from intentos_registro where creado_en < now() - interval '24 hours';
  get diagnostics borrados = row_count;
  return borrados;
end;
$$;
-- ---------------------------------------------------------------------
-- Un correo, un registro
-- ---------------------------------------------------------------------
-- Índice parcial: los registros cancelados no bloquean volver a inscribirse.
create unique index if not exists registros_correo_vigente_idx
  on registros (lower(correo))
  where estado <> 'cancelado';
-- ---------------------------------------------------------------------
-- Límite configurable
-- ---------------------------------------------------------------------
insert into configuracion (clave, valor, descripcion) values
  ('limite_registros_por_huella', '20'::jsonb,
   'Registros que se aceptan en 24 h desde una misma dirección de origen. Holgado a propósito: una institución entera puede inscribirse desde la misma red.')
on conflict (clave) do nothing;

-- =====================================================================
-- Acceso al panel.
--
-- Sustituye a Supabase Auth: contraseña con scrypt, enlaces de acceso de un
-- solo uso y sesiones en tabla, revocables desde el propio panel.
-- =====================================================================

-- El correo identifica a la persona al entrar, así que no puede repetirse.
create unique index if not exists usuarios_panel_correo_idx
  on usuarios_panel (lower(correo));

alter table usuarios_panel
  /** Formato: scrypt$N$r$p$sal_base64$derivada_base64. Nulo mientras la
      persona sólo entre por enlace de acceso. */
  add column if not exists clave_hash text;

-- ---------------------------------------------------------------------
-- Sesiones
-- ---------------------------------------------------------------------
create table if not exists sesiones (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references usuarios_panel(id) on delete cascade,
  /** SHA-256 del testigo que viaja en la galleta. El testigo en claro no se
      guarda: con la base a la vista no se puede suplantar a nadie. */
  token_hash  text not null unique,
  creada_en   timestamptz not null default now(),
  ultimo_uso  timestamptz not null default now(),
  expira_en   timestamptz not null,
  agente      text
);

create index if not exists sesiones_usuario_idx on sesiones (usuario_id);
create index if not exists sesiones_expira_idx  on sesiones (expira_en);

-- ---------------------------------------------------------------------
-- Enlaces de acceso por correo
-- ---------------------------------------------------------------------
create table if not exists enlaces_acceso (
  id         uuid primary key default gen_random_uuid(),
  correo     text not null,
  token_hash text not null unique,
  creado_en  timestamptz not null default now(),
  expira_en  timestamptz not null,
  usado_en   timestamptz
);

create index if not exists enlaces_acceso_correo_idx on enlaces_acceso (lower(correo));
create index if not exists enlaces_acceso_expira_idx on enlaces_acceso (expira_en);

/** Limpia sesiones y enlaces vencidos. La llama el cron diario. */
create or replace function purgar_accesos() returns integer
language plpgsql as $$
declare
  borrados integer;
begin
  delete from sesiones where expira_en < now();
  get diagnostics borrados = row_count;
  delete from enlaces_acceso where expira_en < now();
  return borrados;
end $$;

-- ---------------------------------------------------------------------
-- Consulta de sólo lectura para el perfil de científico de datos
-- ---------------------------------------------------------------------
-- En Supabase la restricción vivía en una función con security invoker. Aquí
-- la aplicación abre la transacción en modo de sólo lectura, que es una
-- garantía del motor y no un filtro de palabras: ninguna escritura pasa,
-- aunque la consulta la esconda en una función o en un CTE.
drop function if exists ejecutar_sql_lectura(text, integer);
