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
create or replace view v_lista_espera as
select
  id, folio, creado_en, nombres, apellidos, correo, institucion, pais_residencia,
  perfil, modalidad, idioma,
  row_number() over (order by creado_en) as turno
from registros
where estado = 'lista_espera'
order by creado_en;

-- La ocupación presencial cuenta lo que no está cancelado ni en espera: un
-- registro en lista de espera todavía no tiene lugar asignado.
create or replace view cupos_estado as
select
  (select (valor #>> '{}')::int from configuracion where clave = 'cupos_presenciales') as cupo_presencial,
  (select count(*) from registros
     where modalidad = 'presencial' and estado not in ('cancelado', 'lista_espera')) as ocupado_presencial,
  (select (valor #>> '{}')::int from configuracion where clave = 'cupos_en_linea') as cupo_en_linea,
  (select count(*) from registros
     where modalidad = 'en_linea' and estado not in ('cancelado', 'lista_espera')) as ocupado_en_linea,
  (select count(*) from registros where estado = 'lista_espera') as en_lista_espera,
  (select (valor #>> '{}')::boolean from configuracion where clave = 'registro_abierto') as registro_abierto;
