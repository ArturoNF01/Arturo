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

revoke all on function ejecutar_sql_lectura(text, int) from public;
grant execute on function ejecutar_sql_lectura(text, int) to authenticated;
