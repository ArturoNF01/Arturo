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
  add column if not exists dictamen_por uuid references auth.users(id),
  add column if not exists dictamen_en timestamptz;

create index if not exists registros_estado_ponencia_idx
  on registros (estado_ponencia)
  where estado_ponencia <> 'sin_dictamen';

-- ---------------------------------------------------------------------
-- Ponencias a dictaminar: sólo quien presenta trabajo académico
-- ---------------------------------------------------------------------
create or replace view v_ponencias as
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
