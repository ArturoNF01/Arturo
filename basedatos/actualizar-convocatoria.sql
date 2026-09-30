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

-- La convocatoria es la definitiva: ninguna pregunta frecuente debe seguir
-- marcada como provisional. Esa marca pintaba un aviso ámbar en la página
-- pública —«documento provisional, se sustituirá»— que hacía ver el portal
-- como un borrador. La casilla sigue en el panel para cuando haga falta.
update faqs set provisional = false where provisional;

-- El aforo presencial baja de 300 a 60.
update configuracion set valor = '60'::jsonb where clave = 'cupos_presenciales';

-- La sede y las fechas ya están decididas. Las filas de la base no se tocan
-- al desplegar —se insertan sólo si faltan— así que el texto nuevo se aplica
-- aquí; debajo de la respuesta, la página pinta además el mapa.
update faqs
   set respuesta = jsonb_build_object(
         'es', 'Del 11 al 13 de noviembre de 2026, en la sede del CIESS: San Ramón s/n, Col. San Jerónimo Lídice, C.P. 10200, Ciudad de México. La agenda detallada se publicará antes del inicio del congreso.',
         'en', '11-13 November 2026, at the CIESS headquarters: San Ramón s/n, Col. San Jerónimo Lídice, C.P. 10200, Mexico City. The detailed programme will be published before the congress begins.',
         'pt', 'De 11 a 13 de novembro de 2026, na sede do CIESS: San Ramón s/n, Col. San Jerónimo Lídice, C.P. 10200, Cidade do México. A agenda detalhada será publicada antes do início do congresso.')
 where clave = 'sede-fechas';

-- El público que sigue la transmisión recibe su enlace de Zoom, no nuestro:
-- el registro del congreso sólo recoge su nombre y su correo, y de ahí se le
-- manda al formulario del seminario web. Se guarda en la configuración para
-- que el comité pueda cambiarlo desde el panel si Zoom le da otro.
insert into configuracion (clave, valor, descripcion) values
  ('url_registro_zoom', '"https://us02web.zoom.us/webinar/register/WN_LMCy6fENTOiR2dSOvb_jDg"'::jsonb,
   'Registro en Zoom para quien sigue la transmisión; de ahí sale el enlace personal')
on conflict (clave) do nothing;

-- Los perfiles bajaron de seis a dos. Los otros cuatro son por invitación del
-- comité y se resuelven por correo; dejarlos elegibles obligaba a sostener
-- cuatro ramas de formulario para un puñado de personas. No se borran: hay
-- registros hechos que apuntan a ellos y el panel los sigue mostrando.
update perfiles set activo = false
 where clave in ('conferencista', 'coordinador', 'moderador', 'dictaminador');

-- Y el ponente pasa a recibir lo que recibía el conferencista —fotografía en
-- el programa y traslado—, que era el perfil que ahora absorbe.
update perfiles set en_programa = true, presenta_ponencia = true, invitado = true
 where clave = 'ponente';

-- El acuse del público en línea tiene que llevar el registro de Zoom: sin él
-- esa persona se queda con un folio y sin manera de conectarse. El bloque se
-- rellena solo, y en los demás acuses sale vacío.
update plantillas_correo
   set cuerpo_html = replace(cuerpo_html,
         '</ul>' || chr(10) || '<p>', '</ul>' || chr(10) || '{{zoom_bloque}}' || chr(10) || '<p>')
 where clave in ('confirmacion_registro', 'recordatorio')
   and cuerpo_html not like '%{{zoom_bloque}}%';

-- Veinte registros por dirección en 24 h se pensó contra quien insiste. Con el
-- registro abierto al público el cálculo se invierte: una institución entera
-- sale a internet por una sola dirección, y la persona veintiuna se encontraba
-- un rechazo sin haber hecho nada mal. Sólo se sube si sigue en el valor de
-- antes: si el comité ya lo ajustó a mano, esa decisión manda.
update configuracion set valor = '300'::jsonb
 where clave = 'limite_registros_por_huella' and valor = '20'::jsonb;

-- Quien convoca es el CIESS con la RIUSS; la CISS ya no se nombra. Iba sólo
-- en las preguntas frecuentes, y la firma de los dieciocho correos se quedó
-- atrás: cada acuse salía firmado por una institución que no convoca.
update plantillas_correo
   set cuerpo_html = replace(cuerpo_html, 'CIESS · CISS', 'CIESS · RIUSS')
 where cuerpo_html like '%CIESS · CISS%';

-- El comité pasó a llamarse dictaminador en el formulario y en el panel; los
-- correos del dictamen eran lo único que seguía firmando como científico.
update plantillas_correo
   set cuerpo_html = replace(replace(replace(replace(replace(replace(cuerpo_html,
         'comité científico',   'comité dictaminador'),
         'Comité científico',   'Comité dictaminador'),
         'scientific committee', 'review committee'),
         'Scientific committee', 'Review committee'),
         'comitê científico',   'comitê avaliador'),
         'Comitê científico',   'Comitê avaliador')
 where cuerpo_html ilike '%científic%' or cuerpo_html ilike '%scientific%';

-- Y el eje temático dejó de pedirse: la variable llega vacía, así que el
-- correo de dictamen salía con un «Eje temático:» seguido de nada.
update plantillas_correo
   set cuerpo_html = replace(replace(replace(cuerpo_html,
         '<li><strong>Eje temático:</strong> {{eje_tematico}}</li>', ''),
         '<li><strong>Thematic axis:</strong> {{eje_tematico}}</li>', ''),
         '<li><strong>Eixo temático:</strong> {{eje_tematico}}</li>', '')
 where cuerpo_html like '%{{eje_tematico}}%';

update faqs
   set respuesta = jsonb_set(respuesta, '{es}',
         to_jsonb(replace(respuesta->>'es', 'el CIESS y la CISS', 'el CIESS y la RIUSS')))
 where respuesta->>'es' like '%el CIESS y la CISS%';

-- Campos que dejaron de pedirse. Se quitan de verdad, no se dejan vacíos: una
-- columna que nadie llena y nadie mira se convierte en una trampa para quien
-- lea la tabla dentro de un año. Lo que hubiera dentro se pierde, y por eso
-- el despliegue respalda la base antes de tocar nada.
alter table registros drop column if exists semblanza_palabras;
alter table registros drop column if exists semblanza;
alter table registros drop column if exists linea_investigacion;
alter table registros drop column if exists nombre_personificador;
alter table registros drop column if exists tipo_habitacion;
alter table registros drop column if exists comparte_habitacion_con;
alter table registros drop column if exists alergias;

-- ---------------------------------------------------------------------
-- Borrar una cuenta del panel sin perder lo que esa persona hizo
-- ---------------------------------------------------------------------
-- Tres tablas apuntan a usuarios_panel para decir quién tocó cada cosa. Sin
-- decir qué pasa al borrar, PostgreSQL se niega: la cuenta no se puede
-- eliminar mientras haya una plantilla, una clave de configuración o un
-- dictamen firmados por ella, y el panel devolvía un error que no explicaba
-- nada. Con SET NULL la fila sobrevive y sólo pierde el puntero.
--
-- La auditoría no entra aquí y es deliberado: guarda el correo y el rol como
-- texto, no como referencia, así que el rastro de quién hizo qué sigue legible
-- después de borrar la cuenta. Es lo que permite explicar un cambio de hace
-- seis meses hecho por alguien que ya no está.
do $$
declare
  v record;
begin
  for v in
    select c.conname, c.conrelid::regclass as tabla
      from pg_constraint c
      join pg_class t on t.oid = c.confrelid
     where c.contype = 'f'
       and t.relname = 'usuarios_panel'
       -- Todas menos las que ya cascadean: 'a' es la NO ACTION que estorba y
       -- 'n' es la que este mismo bloque pudo dejar en una corrida anterior.
       -- Si sólo se quitara la 'a', la segunda pasada chocaría al volver a
       -- crearlas —y este archivo se ejecuta en cada despliegue.
       and c.confdeltype <> 'c'
  loop
    execute format('alter table %s drop constraint %I', v.tabla, v.conname);
  end loop;
end $$;

alter table plantillas_correo
  add constraint plantillas_correo_actualizado_por_fkey
  foreign key (actualizado_por) references usuarios_panel(id) on delete set null;
alter table configuracion
  add constraint configuracion_actualizado_por_fkey
  foreign key (actualizado_por) references usuarios_panel(id) on delete set null;
alter table registros
  add constraint registros_dictamen_por_fkey
  foreign key (dictamen_por) references usuarios_panel(id) on delete set null;

-- ---------------------------------------------------------------------
-- Auditoría de las cuentas del panel
-- ---------------------------------------------------------------------
-- Faltaba, y es de las que más falta hacen: dar de alta una cuenta, subirle
-- el rol, desactivarla o borrarla no dejaba ningún rastro. Con varias
-- personas administrando, «quién hizo superadministrador a esta cuenta» es
-- una pregunta que hay que poder responder.
--
-- Va con su propia función porque la general guarda la fila entera, y la fila
-- entera incluye `clave_hash`. Un histórico de hashes de contraseña, legible
-- por cualquiera con acceso a la auditoría, es exactamente lo que no se debe
-- construir: se quita antes de guardar nada.
create or replace function registrar_auditoria_usuarios() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_previos jsonb;
  v_nuevos  jsonb;
  v_campos  text[];
  v_correo  text;
  v_fila    jsonb;
begin
  select correo into v_correo from usuarios_panel where id = usuario_actual_id();

  if tg_op <> 'INSERT' then v_previos := to_jsonb(old) - 'clave_hash'; end if;
  if tg_op <> 'DELETE' then v_nuevos  := to_jsonb(new) - 'clave_hash'; end if;

  if tg_op = 'UPDATE' then
    select array_agg(clave) into v_campos
      from jsonb_each(v_nuevos) as n(clave, valor)
      where n.valor is distinct from v_previos -> n.clave;
    -- El cambio de contraseña sí se anota, aunque su valor no se guarde:
    -- interesa saber que ocurrió y cuándo.
    if old.clave_hash is distinct from new.clave_hash then
      -- Con los tipos escritos: sin ellos PostgreSQL no sabe que '{}' es un
      -- array de texto y revienta el `update` entero con «malformed array
      -- literal», que es lo último que uno espera al cambiarse la contraseña.
      v_campos := coalesce(v_campos, array[]::text[]) || 'clave_hash'::text;
    end if;
    -- Un `update` que no cambia nada —la marca de último acceso al entrar—
    -- no merece una fila de auditoría por sesión abierta.
    if v_campos is null or v_campos = '{}' or v_campos = array['ultimo_acceso'] then
      return new;
    end if;
  end if;

  v_fila := case when tg_op = 'DELETE' then v_previos else v_nuevos end;

  insert into auditoria (tabla, registro_id, accion, actor_id, actor_correo, actor_rol,
                         origen, datos_previos, datos_nuevos, campos)
  values ('usuarios_panel', coalesce(v_fila ->> 'id', ''), tg_op,
          usuario_actual_id(), v_correo, rol_actual()::text,
          case when usuario_actual_id() is null then 'sistema' else 'panel' end,
          v_previos, v_nuevos, v_campos);

  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists trg_auditoria_usuarios on usuarios_panel;
create trigger trg_auditoria_usuarios
  after insert or update or delete on usuarios_panel
  for each row execute function registrar_auditoria_usuarios();

commit;

select clave, valor from configuracion
 where clave in ('congreso_nombre', 'congreso_fechas', 'congreso_sede',
                 'congreso_fecha_inicio', 'congreso_fecha_fin',
                 'fecha_limite_registro', 'correo_contacto')
 order by clave;

select clave, orden, titulo->>'es' as apartado
  from aviso_privacidad where activo order by orden;

select count(*) as faqs_provisionales from faqs where provisional;
