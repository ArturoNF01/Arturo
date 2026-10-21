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

update configuracion set valor = '"ciess.cooperacion@ciss-bienestar.org"'::jsonb where clave = 'correo_contacto';

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

-- El aforo presencial sube de 60 a 100.
--
-- Con condición, y no como estaba. Esto corre en cada despliegue, y mientras
-- fue una orden sin condición el número del panel era decorativo: el comité lo
-- cambiaba, el despliegue siguiente lo devolvía a 60 y nadie ataba una cosa
-- con la otra. Así se aplica una sola vez —desde el valor que había— y a
-- partir de ahí manda el panel, que es donde se decide un aforo.
update configuracion set valor = '100'::jsonb
 where clave = 'cupos_presenciales' and valor = '60'::jsonb;

-- La sede y las fechas ya están decididas. Las filas de la base no se tocan
-- al desplegar —se insertan sólo si faltan— así que el texto nuevo se aplica
-- aquí; debajo de la respuesta, la página pinta además el mapa.
update faqs
   set respuesta = jsonb_build_object(
         'es', 'Del 11 al 13 de noviembre de 2026, en la sede del CIESS: San Ramón s/n, Col. San Jerónimo Lídice, C.P. 10200, Ciudad de México. La agenda detallada se publicará antes del inicio del Congreso.',
         'en', '11-13 November 2026, at the CIESS headquarters: San Ramón s/n, Col. San Jerónimo Lídice, C.P. 10200, Mexico City. The detailed programme will be published before the Congress begins.',
         'pt', 'De 11 a 13 de novembro de 2026, na sede do CIESS: San Ramón s/n, Col. San Jerónimo Lídice, C.P. 10200, Cidade do México. A agenda detalhada será publicada antes do início do Congresso.')
 where clave = 'sede-fechas';

-- El programa general ya está publicado, así que el botón de la portada deja
-- de apuntar a la convocatoria y apunta a él. Es lo que busca quien entra al
-- sitio con el registro ya abierto: a qué hora y en qué sala es cada mesa, no
-- la invitación a mandar trabajos.
--
-- Con condición, para que se aplique una vez y el panel siga mandando después:
-- si el comité sube una versión corregida del programa a otra dirección, el
-- despliegue siguiente no debe devolverla a ésta.
update configuracion
   set valor = '"https://home.ciess.org/wp-content/uploads/2026/10/Agenda_Congreso_RIUSS_2026_publico.pdf"'::jsonb,
       descripcion = 'PDF del programa general del Congreso'
 where clave = 'url_agenda'
   and valor = '"https://home.ciess.org/wp-content/uploads/2026/03/Convocatoria-congreso.pdf"'::jsonb;

-- El programa, en los acuses que confirman algo.
--
-- Va detrás del bloque del seminario donde lo hay, y delante de la firma
-- donde no. En los tres idiomas y en los tres acuses que confirman: el de
-- registro recibido, el de lista de espera y el de registro confirmado.
--
-- No en el de ponencia rechazada ni en el de registro cancelado: un botón de
-- «descargue el programa» ahí es sordo a lo que esa persona acaba de leer. Ni
-- en el recordatorio, que ya enlaza el programa en su propio texto.
--
-- Se salta las plantillas que ya lo traen, así que puede correr mil veces.
update plantillas_correo
   set cuerpo_html = replace(cuerpo_html, '{{zoom_bloque}}', '{{zoom_bloque}}' || chr(10) || '{{agenda_bloque}}')
 where clave in ('confirmacion_registro', 'lista_espera', 'registro_confirmado')
   and cuerpo_html like '%{{zoom_bloque}}%'
   and cuerpo_html not like '%{{agenda_bloque}}%';

update plantillas_correo
   set cuerpo_html = regexp_replace(
         cuerpo_html,
         '(<p>(Comité organizador|Organizing committee|Comitê organizador))',
         '{{agenda_bloque}}\1')
 where clave in ('confirmacion_registro', 'lista_espera', 'registro_confirmado')
   and cuerpo_html not like '%{{agenda_bloque}}%';

-- Y las frases que daban el programa por no publicado.
update plantillas_correo
   set cuerpo_html = replace(cuerpo_html,
         '—la convocatoria, la sede, el programa conforme se publique y las preguntas frecuentes—',
         '—el programa, la sede y las preguntas frecuentes—')
 where cuerpo_html like '%el programa conforme se publique%';
update plantillas_correo
   set cuerpo_html = replace(cuerpo_html,
         '—the call for papers, the venue, the programme as it is published and the frequently asked questions—',
         '—the programme, the venue and the frequently asked questions—')
 where cuerpo_html like '%the programme as it is published%';
update plantillas_correo
   set cuerpo_html = replace(cuerpo_html,
         '—a convocatória, a sede, a programação conforme for publicada e as perguntas frequentes—',
         '—a programação, a sede e as perguntas frequentes—')
 where cuerpo_html like '%a programação conforme for publicada%';

update plantillas_correo
   set cuerpo_html = replace(cuerpo_html, ' La información logística y el programa se enviarán por esta misma vía.', ' La información logística se enviará por esta misma vía.')
 where cuerpo_html like '%el programa se enviarán por esta misma vía%';
update plantillas_correo
   set cuerpo_html = replace(cuerpo_html, ' Logistical information and the programme will be sent through this same channel.', ' Logistical information will be sent through this same channel.')
 where cuerpo_html like '%and the programme will be sent through%';
update plantillas_correo
   set cuerpo_html = replace(cuerpo_html, ' As informações logísticas e a programação serão enviadas por este mesmo meio.', ' As informações logísticas serão enviadas por este mesmo meio.')
 where cuerpo_html like '%e a programação serão enviadas%';

-- La sala del seminario web: el enlace con el que entra el público en línea.
--
-- Hubo un registro previo en Zoom —un formulario aparte que devolvía a cada
-- persona un enlace personal por correo— y se retiró: eran dos pasos y dos
-- correos para ver una transmisión, y el enlace personal se perdía entre el
-- registro y el congreso. Ahora la sala es la misma para todos y se entrega
-- al terminar el registro, en pantalla y en el acuse.
--
-- Va en la configuración para que el comité pueda cambiarla desde el panel si
-- Zoom le da otra sala.
insert into configuracion (clave, valor, descripcion) values
  ('url_sesion_zoom', '"https://us02web.zoom.us/j/83396553628"'::jsonb,
   'Sala del seminario web: el enlace con el que entra el público en línea')
on conflict (clave) do nothing;

update configuracion
   set descripcion = 'Sala del seminario web: el enlace con el que entra el público en línea'
 where clave = 'url_sesion_zoom' and descripcion <> 'Sala del seminario web: el enlace con el que entra el público en línea';

-- Y fuera la del registro, que ya no lee nadie. Dejarla sería peor que
-- borrarla: un campo en el panel que no hace nada acaba usándose.
delete from configuracion where clave = 'url_registro_zoom';

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

-- El folio pasa de cuatro caracteres a seis, y se comprueba antes de
-- devolverlo. El motivo, en el propio cuerpo de la función.
create or replace function generar_folio() returns trigger
language plpgsql as $$
declare
  v_dia    text;
  v_intento int := 0;
begin
  if new.folio is not null and new.folio <> '' then
    return new;
  end if;

  -- Eran cuatro caracteres: 65.536 folios distintos por día. Parece mucho y
  -- no lo es. Con doscientas altas en un día la probabilidad de que dos
  -- coincidan ronda el 26 %; con mil, es prácticamente segura. Y al chocar,
  -- el alta se rechazaba diciendo que el correo ya estaba registrado —que es
  -- lo único que esa respuesta sabía decir—, así que esa persona se iba
  -- convencida de estar inscrita sin estarlo. Con seis son 16,7 millones al
  -- día, y además se comprueba antes de devolverlo.
  v_dia := to_char(now() at time zone 'America/Mexico_City', 'YYYYMMDD');

  loop
    new.folio := 'REG-' || v_dia || '-'
                 || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from registros where folio = new.folio);

    v_intento := v_intento + 1;
    -- Diez sorteos fallidos seguidos con 16,7 millones de combinaciones no
    -- pasa; si pasara, es que algo va muy mal y vale más parar que insistir.
    if v_intento >= 10 then
      raise exception 'No se pudo generar un folio único tras % intentos', v_intento;
    end if;
  end loop;

  return new;
end $$;

-- El valor por defecto de «¿requiere recepción y traslado?» era 'No'. Esa
-- pregunta se retiró del formulario, así que ese 'No' ya no es la respuesta
-- de nadie: es la base rellenando un hueco. En la ficha del registro salía
-- como un dato contestado, y en el libro de seguimiento contaba como una
-- persona que dijo que no quería un servicio que nunca se le ofreció.
-- Quitarlo deja el campo en nulo, que es lo que de verdad hay.
alter table registros alter column requiere_traslado drop default;

-- El acuse remitía a «este documento» para la convocatoria y la agenda. El
-- documento es un PDF que envejece: la agenda definitiva aún no existe, y
-- cuando exista habrá que sustituirlo. El sitio del congreso no envejece, y
-- ahí está todo —convocatoria, sede, programa y preguntas frecuentes—, así
-- que el acuse manda a la raíz y no a un archivo.
update plantillas_correo
   set cuerpo_html = replace(cuerpo_html,
         '<p>La convocatoria y la agenda están disponibles en <a href="{{url_agenda}}">este documento</a>.</p>',
         '<p>Toda la información del Congreso —la convocatoria, la sede, el programa conforme se publique y las preguntas frecuentes— está en el sitio: <a href="{{url_sitio}}">{{url_sitio}}</a>.</p>')
 where cuerpo_html like '%La convocatoria y la agenda están disponibles%';

update plantillas_correo
   set cuerpo_html = replace(cuerpo_html,
         '<p>The call for papers and the agenda are available in <a href="{{url_agenda}}">this document</a>.</p>',
         '<p>All the Congress information —the call for papers, the venue, the programme as it is published and the frequently asked questions— is on the website: <a href="{{url_sitio}}">{{url_sitio}}</a>.</p>')
 where cuerpo_html like '%The call for papers and the agenda are available%';

update plantillas_correo
   set cuerpo_html = replace(cuerpo_html,
         '<p>A convocatória e a agenda estão disponíveis <a href="{{url_agenda}}">neste documento</a>.</p>',
         '<p>Todas as informações do Congresso —a convocatória, a sede, a programação conforme for publicada e as perguntas frequentes— estão no site: <a href="{{url_sitio}}">{{url_sitio}}</a>.</p>')
 where cuerpo_html like '%A convocatória e a agenda estão disponíveis%';

commit;

select clave, valor from configuracion
 where clave in ('congreso_nombre', 'congreso_fechas', 'congreso_sede',
                 'congreso_fecha_inicio', 'congreso_fecha_fin',
                 'fecha_limite_registro', 'correo_contacto')
 order by clave;

select clave, orden, titulo->>'es' as apartado
  from aviso_privacidad where activo order by orden;

select count(*) as faqs_provisionales from faqs where provisional;
