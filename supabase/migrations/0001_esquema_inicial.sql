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
  id            uuid primary key references auth.users(id) on delete cascade,
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
  select rol from usuarios_panel where id = auth.uid() and activo;
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
begin
  select correo into v_correo from usuarios_panel where id = auth.uid();

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

  insert into auditoria (tabla, registro_id, accion, actor_id, actor_correo, actor_rol,
                         origen, datos_previos, datos_nuevos, campos)
  values (tg_table_name,
          coalesce((case when tg_op = 'DELETE' then old.id else new.id end)::text, ''),
          tg_op, auth.uid(), v_correo, rol_actual()::text,
          case when auth.uid() is null then 'sistema' else 'panel' end,
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
  actualizado_por uuid references auth.users(id),
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
  actualizado_por uuid references auth.users(id)
);

insert into configuracion (clave, valor, descripcion) values
  ('cupos_presenciales', '300'::jsonb, 'Lugares disponibles en modalidad presencial'),
  ('cupos_en_linea',     'null'::jsonb, 'Lugares en línea; null = sin límite'),
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
create or replace view cupos_estado as
select
  (select (valor #>> '{}')::int from configuracion where clave = 'cupos_presenciales') as cupo_presencial,
  (select count(*) from registros where modalidad = 'presencial' and estado <> 'cancelado') as ocupado_presencial,
  (select (valor #>> '{}')::int from configuracion where clave = 'cupos_en_linea') as cupo_en_linea,
  (select count(*) from registros where modalidad = 'en_linea' and estado <> 'cancelado') as ocupado_en_linea,
  (select (valor #>> '{}')::boolean from configuracion where clave = 'registro_abierto') as registro_abierto;

-- ---------------------------------------------------------------------
-- Vistas analíticas para el dashboard
-- ---------------------------------------------------------------------
create or replace view v_registros_por_dia as
select date_trunc('day', creado_en at time zone 'America/Mexico_City')::date as dia,
       count(*) as total
from registros where estado <> 'cancelado'
group by 1 order by 1;

create or replace view v_actividad_hora_dia as
select extract(dow  from creado_en at time zone 'America/Mexico_City')::int as dia_semana,
       extract(hour from creado_en at time zone 'America/Mexico_City')::int as hora,
       count(*) as total
from registros where estado <> 'cancelado'
group by 1, 2;

create or replace view v_registros_por_pais as
select coalesce(nullif(btrim(pais_residencia), ''), 'Sin especificar') as pais, count(*) as total
from registros where estado <> 'cancelado'
group by 1 order by 2 desc;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table registros         enable row level security;
alter table usuarios_panel    enable row level security;
alter table auditoria         enable row level security;
alter table plantillas_correo enable row level security;
alter table configuracion     enable row level security;
alter table perfiles          enable row level security;

-- Perfiles y configuración: lectura pública (el formulario los necesita)
drop policy if exists perfiles_lectura on perfiles;
create policy perfiles_lectura on perfiles for select using (true);

drop policy if exists perfiles_escritura on perfiles;
create policy perfiles_escritura on perfiles for all
  using (es_al_menos('organizador')) with check (es_al_menos('organizador'));

drop policy if exists config_lectura on configuracion;
create policy config_lectura on configuracion for select using (true);

drop policy if exists config_escritura on configuracion;
create policy config_escritura on configuracion for all
  using (es_al_menos('organizador')) with check (es_al_menos('organizador'));

-- Registros: el formulario público escribe con la clave de servicio (bypassa RLS).
drop policy if exists registros_lectura on registros;
create policy registros_lectura on registros for select using (es_al_menos('lector'));

drop policy if exists registros_edicion on registros;
create policy registros_edicion on registros for update
  using (es_al_menos('organizador')) with check (es_al_menos('organizador'));

drop policy if exists registros_borrado on registros;
create policy registros_borrado on registros for delete using (es_al_menos('superadmin'));

-- Usuarios del panel
drop policy if exists usuarios_lectura_propia on usuarios_panel;
create policy usuarios_lectura_propia on usuarios_panel for select
  using (id = auth.uid() or es_al_menos('organizador'));

drop policy if exists usuarios_admin on usuarios_panel;
create policy usuarios_admin on usuarios_panel for all
  using (es_al_menos('superadmin')) with check (es_al_menos('superadmin'));

-- Auditoría: sólo lectura, nunca escritura desde el cliente
drop policy if exists auditoria_lectura on auditoria;
create policy auditoria_lectura on auditoria for select using (es_al_menos('organizador'));

-- Plantillas de correo
drop policy if exists plantillas_lectura on plantillas_correo;
create policy plantillas_lectura on plantillas_correo for select using (es_al_menos('lector'));

drop policy if exists plantillas_escritura on plantillas_correo;
create policy plantillas_escritura on plantillas_correo for all
  using (es_al_menos('organizador')) with check (es_al_menos('organizador'));

-- ---------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table registros;
exception when duplicate_object then null; end $$;
