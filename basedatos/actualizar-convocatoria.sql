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

-- Sin fecha límite de inscripción: el registro se mantiene abierto.
--
-- El comité pidió quitar el plazo del 2 de noviembre. «Vacía» quiere decir «sin plazo»: el
-- formulario no enseña ninguna fecha, cada persona puede editar su registro cuando quiera
-- y los correos dicen «en cualquier momento».
--
-- Con condición, como el aforo de más abajo: esto corre en cada despliegue, y sin ella la
-- fecha que el comité pusiera después en el panel volvería a quedar vacía. Sólo se vacía si
-- sigue en alguna de las tres fechas que el sistema trajo (la de reserva del código, la del 30
-- de octubre y la del 2 de noviembre); a partir de ahí manda el panel. No toca ningún registro.
update configuracion set valor = '""'::jsonb
 where clave = 'fecha_limite_registro'
   and valor in ('"2026-05-15"'::jsonb, '"2026-10-30"'::jsonb, '"2026-11-02"'::jsonb);

update configuracion
   set descripcion = 'Fecha límite de registro y de edición; vacía = el registro sigue abierto, sin límite'
 where clave = 'fecha_limite_registro' and descripcion = 'Fecha límite de registro y de edición';

-- Los correos no repiten la fecha pelada: con el plazo vacío una frase como «hasta el .»
-- quedaría rota. Llevan `{{plazo_edicion}}` / `{{plazo_reenvio}}`, que con fecha dicen lo mismo
-- que antes («hasta el 2 de noviembre de 2026») y sin fecha, «en cualquier momento» / «a la
-- brevedad». Es un reemplazo exacto de la frase sembrada, así que lo que el comité haya
-- reescrito a su manera no se toca, y repetirlo no cambia nada.
update plantillas_correo set cuerpo_html = replace(cuerpo_html, 'hasta el {{fecha_limite}}', '{{plazo_edicion}}')
 where idioma = 'es' and clave in ('confirmacion_registro', 'registro_confirmado')
   and cuerpo_html like '%hasta el {{fecha_limite}}%';
update plantillas_correo set cuerpo_html = replace(cuerpo_html, 'until {{fecha_limite}}', '{{plazo_edicion}}')
 where idioma = 'en' and clave in ('confirmacion_registro', 'registro_confirmado')
   and cuerpo_html like '%until {{fecha_limite}}%';
update plantillas_correo set cuerpo_html = replace(cuerpo_html, 'até {{fecha_limite}}', '{{plazo_edicion}}')
 where idioma = 'pt' and clave in ('confirmacion_registro', 'registro_confirmado')
   and cuerpo_html like '%até {{fecha_limite}}%';
update plantillas_correo set cuerpo_html = replace(cuerpo_html, 'antes del {{fecha_limite}}', '{{plazo_reenvio}}')
 where idioma = 'es' and clave = 'ponencia_aceptada_con_cambios'
   and cuerpo_html like '%antes del {{fecha_limite}}%';
update plantillas_correo set cuerpo_html = replace(cuerpo_html, 'before {{fecha_limite}}', '{{plazo_reenvio}}')
 where idioma = 'en' and clave = 'ponencia_aceptada_con_cambios'
   and cuerpo_html like '%before {{fecha_limite}}%';
update plantillas_correo set cuerpo_html = replace(cuerpo_html, 'até {{fecha_limite}}', '{{plazo_reenvio}}')
 where idioma = 'pt' and clave = 'ponencia_aceptada_con_cambios'
   and cuerpo_html like '%até {{fecha_limite}}%';

-- La constancia exige registrarse y un 80 % de asistencia como mínimo.
--
-- Va en el acuse de confirmación y en el de registro confirmado, delante del bloque de la
-- agenda. Se aplica UNA sola vez, y por eso lleva una marca: esto corre en cada despliegue, y
-- sin ella una plantilla de la que el comité quitara el bloque desde el panel lo recuperaría en
-- el siguiente (el panel manda). La marca es una fila más de `configuracion` que ninguna
-- pantalla enseña; no hay que borrarla.
do $constancia$
begin
  if not exists (select 1 from configuracion where clave = 'migracion_constancia_bloque') then
    update plantillas_correo
       set cuerpo_html = replace(cuerpo_html, '{{agenda_bloque}}', '{{constancia_bloque}}' || E'\n' || '{{agenda_bloque}}')
     where cuerpo_html like '%{{agenda_bloque}}%'
       and cuerpo_html not like '%{{constancia_bloque}}%';

    insert into configuracion (clave, valor, descripcion)
    values ('migracion_constancia_bloque', 'true'::jsonb,
            'Marca interna de una migración ya aplicada: las plantillas de acuse recibieron {{constancia_bloque}}. No borrar.');
  end if;
end
$constancia$;

-- Y la pregunta frecuente de la constancia lo dice. Sólo si conserva el texto sembrado.
-- (Escribe ya el requisito vigente: el 80 % de asistencia.)
update faqs
   set respuesta = jsonb_build_object(
         'es', 'Sí. Para recibir la constancia de participación es requisito registrarse y tener un porcentaje de asistencia mínimo del 80%, en persona o en línea. En el formulario puede indicar el nombre exacto tal como debe aparecer en la constancia. Las condiciones y los plazos de entrega los comunica el comité organizador por correo.',
         'en', 'Yes. To receive the certificate of participation you must register and have a minimum attendance of 80%, in person or online. In the form you can state the exact name as it should appear on the certificate. The conditions and delivery times are communicated by the organizing committee by email.',
         'pt', 'Sim. Para receber o certificado de participação é necessário inscrever-se e ter uma frequência mínima de 80%, presencialmente ou on-line. No formulário você pode indicar o nome exato como deve constar no certificado. As condições e os prazos de entrega são comunicados pelo comitê organizador por e-mail.')
 where clave = 'constancia'
   and respuesta->>'es' like '%Las condiciones y los plazos de entrega los comunica el comité organizador por correo.%'
   and respuesta->>'es' not like '%es requisito registrarse%';

-- El requisito cambió: antes se pedía asistir a todas las sesiones y ahora basta un porcentaje
-- de asistencia mínimo del 80 %. Alcanza a las bases que ya habían recibido el texto anterior.
-- Sólo si la pregunta conserva ese texto: lo que el comité haya reescrito en el panel no se toca.
update faqs
   set respuesta = jsonb_build_object(
         'es', 'Sí. Para recibir la constancia de participación es requisito registrarse y tener un porcentaje de asistencia mínimo del 80%, en persona o en línea. En el formulario puede indicar el nombre exacto tal como debe aparecer en la constancia. Las condiciones y los plazos de entrega los comunica el comité organizador por correo.',
         'en', 'Yes. To receive the certificate of participation you must register and have a minimum attendance of 80%, in person or online. In the form you can state the exact name as it should appear on the certificate. The conditions and delivery times are communicated by the organizing committee by email.',
         'pt', 'Sim. Para receber o certificado de participação é necessário inscrever-se e ter uma frequência mínima de 80%, presencialmente ou on-line. No formulário você pode indicar o nome exato como deve constar no certificado. As condições e os prazos de entrega são comunicados pelo comitê organizador por e-mail.')
 where clave = 'constancia'
   and respuesta->>'es' like '%es requisito registrarse y asistir —en persona o en línea— a todas las sesiones del Congreso%';

-- La pregunta frecuente de la constancia decía también que entrar a Zoom o a Meet sin haberse
-- registrado no da derecho a constancia. Se quita esa frase, para no sonar tan tajantes con el
-- público; el requisito (registrarse y el 80 % de asistencia) se queda.
--
-- Sólo se quita la frase, con un replace exacto, y no se reescribe la respuesta entera: si el
-- comité retocó el resto del texto desde el panel, eso se respeta. Si la frase ya no está (porque
-- la base recibió ya el texto sin ella, o la quitó el comité), no se toca nada.
update faqs
   set respuesta = jsonb_build_object(
         'es', replace(respuesta->>'es', '; entrar a Zoom o a Meet sin haberse registrado no da derecho a constancia.', '.'),
         'en', replace(respuesta->>'en', '; joining Zoom or Meet without registering does not entitle you to a certificate.', '.'),
         'pt', replace(respuesta->>'pt', '; entrar no Zoom ou no Meet sem ter se inscrito não dá direito ao certificado.', '.'))
 where clave = 'constancia'
   and respuesta->>'es' is not null and respuesta->>'en' is not null and respuesta->>'pt' is not null
   and (   respuesta->>'es' like '%; entrar a Zoom o a Meet sin haberse registrado no da derecho a constancia.%'
        or respuesta->>'en' like '%; joining Zoom or Meet without registering does not entitle you to a certificate.%'
        or respuesta->>'pt' like '%; entrar no Zoom ou no Meet sem ter se inscrito não dá direito ao certificado.%');

-- El comunicado del comité cambió de estilo (logos de la RIUSS y del CIESS en la cabecera, título y
-- subtítulos en azul marino, saludo y firma en dorado, texto justificado) y de texto (la asistencia
-- presencial ahora se registra con un código QR, ya no con una lista firmada). Se pone al día la
-- plantilla ya sembrada, y sólo si conserva el diseño y el texto de la primera versión: si el comité
-- la retocó desde el panel, no se toca.
update plantillas_correo
   set cuerpo_html = $html$<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#ffffff;">Horarios y salas, cómo asistir en la sede o en línea y requisitos para la constancia de participación.</div>
<h1 style="margin:0 0 20px;font-size:26px;line-height:1.25;font-weight:bold;color:#002269;text-align:left;">Acceso a las sesiones, asistencia y constancias</h1>
<p style="margin:0 0 18px;font-weight:bold;color:#a08536;">Estimadas y estimados participantes:</p>
<p style="margin:0 0 16px;">Nos dará mucho gusto contar con su participación en el <strong>Primer Congreso de Estudios Interamericanos de Seguridad Social</strong>, que se realizará del <strong>11 al 13 de noviembre de 2026</strong> en <strong>modalidad híbrida</strong>, con actividades presenciales y en línea.</p>
<p style="margin:0 0 16px;">El <strong>miércoles 11 de noviembre</strong> se llevarán a cabo las mesas de trabajo y la reunión general de la RIUSS. El <strong>jueves 12 y el viernes 13</strong> tendrán lugar las mesas temáticas de ponencias. En la <a href="{{url_sitio}}/#agenda" style="color:#467886;text-decoration:underline;">agenda del Congreso</a> encontrarán <strong>los horarios, las salas y los enlaces de acceso a las sesiones virtuales</strong>. Todos los horarios corresponden a la <strong>Ciudad de México</strong>.</p>
<p style="margin:26px 0 8px;font-size:18px;line-height:1.35;font-weight:bold;color:#002269;text-align:left;">Constancia de participación</p>
<p style="margin:0 0 16px;">Se otorgará una constancia a quienes acrediten al menos el <strong>80% de asistencia a las mesas temáticas del 12 y 13 de noviembre</strong>. Cuando dos mesas se realicen en el mismo horario, podrán elegir la de su interés y su asistencia contará para ese bloque.</p>
<p style="margin:26px 0 8px;font-size:18px;line-height:1.35;font-weight:bold;color:#002269;text-align:left;">Participación presencial</p>
<p style="margin:0 0 16px;">Les esperamos en la sede del CIESS, en <strong>calle San Ramón s/n, colonia San Jerónimo Lídice, C.P. 10200, Ciudad de México</strong>. Durante la sesión se distribuirá un <strong>código QR con el que podrán registrar su asistencia para cada sesión.</strong></p>
<p style="margin:26px 0 8px;font-size:18px;line-height:1.35;font-weight:bold;color:#002269;text-align:left;">Participación en línea</p>
<p style="margin:0 0 16px;">Para conectarse, consulten la <a href="{{url_sitio}}/#agenda" style="color:#467886;text-decoration:underline;">agenda del Congreso</a> y seleccionen el <strong>enlace de la sesión</strong> a la que desean asistir. La plataforma registrará automáticamente su asistencia. Para que podamos identificarla correctamente, les pedimos ingresar con el <strong>nombre completo que utilizaron al inscribirse</strong> y conectarse desde el inicio de cada sesión. El registro de la plataforma se utilizará para verificar el cumplimiento del requisito de asistencia para la constancia.</p>
<p style="margin:0 0 16px;">Muchas gracias por sumarse a este encuentro que hemos preparado en conjunto desde la RIUSS. Nos alegra compartir estos días de intercambio con quienes nos acompañarán en la sede y con quienes se conectarán desde distintos países.</p>
<p style="margin:0 0 16px;">Un cordial saludo,</p>
<p style="margin:0 0 24px;font-weight:bold;"><span style="color:#002269;">Comité Organizador</span><br/><span style="color:#a08536;">Congreso de la RIUSS | CIESS</span></p>$html$
 where clave = 'comunicado' and idioma = 'es'
   and cuerpo_html like '%font-size:24px;line-height:1.25;font-weight:bold;color:#111111%'
   and cuerpo_html like '%mesa de registro ubicada a la entrada del auditorio%';
update plantillas_correo
   set cuerpo_html = $html$<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#ffffff;">Schedules and rooms, how to attend in person or online, and the requirements for the certificate of participation.</div>
<h1 style="margin:0 0 20px;font-size:26px;line-height:1.25;font-weight:bold;color:#002269;text-align:left;">Access to the sessions, attendance and certificates</h1>
<p style="margin:0 0 18px;font-weight:bold;color:#a08536;">Dear participants:</p>
<p style="margin:0 0 16px;">We look forward to your participation in the <strong>First Congress of Inter-American Social Security Studies</strong>, to be held from <strong>11 to 13 November 2026</strong> in <strong>hybrid format</strong>, with in-person and online activities.</p>
<p style="margin:0 0 16px;">On <strong>Wednesday 11 November</strong> the working groups and the general RIUSS meeting will take place. On <strong>Thursday 12 and Friday 13</strong> the thematic panels with paper presentations will be held. In the <a href="{{url_sitio}}/#agenda" style="color:#467886;text-decoration:underline;">Congress agenda</a> you will find <strong>the schedules, the rooms and the access links to the virtual sessions</strong>. All times are <strong>Mexico City</strong> time.</p>
<p style="margin:26px 0 8px;font-size:18px;line-height:1.35;font-weight:bold;color:#002269;text-align:left;">Certificate of participation</p>
<p style="margin:0 0 16px;">A certificate will be awarded to those who attend at least <strong>80% of the thematic panels on 12 and 13 November</strong>. When two panels are held at the same time, you may choose the one that interests you and your attendance will count for that time block.</p>
<p style="margin:26px 0 8px;font-size:18px;line-height:1.35;font-weight:bold;color:#002269;text-align:left;">In-person participation</p>
<p style="margin:0 0 16px;">We look forward to welcoming you at the CIESS headquarters, at <strong>calle San Ramón s/n, colonia San Jerónimo Lídice, C.P. 10200, Mexico City</strong>. During the session a <strong>QR code will be distributed with which you can record your attendance for each session.</strong></p>
<p style="margin:26px 0 8px;font-size:18px;line-height:1.35;font-weight:bold;color:#002269;text-align:left;">Online participation</p>
<p style="margin:0 0 16px;">To connect, please consult the <a href="{{url_sitio}}/#agenda" style="color:#467886;text-decoration:underline;">Congress agenda</a> and select the <strong>link for the session</strong> you wish to attend. The platform will automatically record your attendance. So that we can identify you correctly, please log in with the <strong>full name you used when registering</strong> and connect from the start of each session. The platform record will be used to verify compliance with the attendance requirement for the certificate.</p>
<p style="margin:0 0 16px;">Thank you very much for joining this meeting, which we have prepared together from RIUSS. We are glad to share these days of exchange with those who will be with us at the venue and those who will connect from different countries.</p>
<p style="margin:0 0 16px;">Kind regards,</p>
<p style="margin:0 0 24px;font-weight:bold;"><span style="color:#002269;">Organizing Committee</span><br/><span style="color:#a08536;">RIUSS Congress | CIESS</span></p>$html$
 where clave = 'comunicado' and idioma = 'en'
   and cuerpo_html like '%font-size:24px;line-height:1.25;font-weight:bold;color:#111111%'
   and cuerpo_html like '%registration desk located at the entrance of the auditorium%';
update plantillas_correo
   set cuerpo_html = $html$<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#ffffff;">Horários e salas, como participar presencialmente ou on-line e requisitos para o certificado de participação.</div>
<h1 style="margin:0 0 20px;font-size:26px;line-height:1.25;font-weight:bold;color:#002269;text-align:left;">Acesso às sessões, frequência e certificados</h1>
<p style="margin:0 0 18px;font-weight:bold;color:#a08536;">Prezadas e prezados participantes:</p>
<p style="margin:0 0 16px;">Teremos grande prazer em contar com a sua participação no <strong>Primeiro Congresso de Estudos Interamericanos de Seguridade Social</strong>, que será realizado de <strong>11 a 13 de novembro de 2026</strong> em <strong>formato híbrido</strong>, com atividades presenciais e on-line.</p>
<p style="margin:0 0 16px;">Na <strong>quarta-feira, 11 de novembro</strong>, serão realizadas as mesas de trabalho e a reunião geral da RIUSS. Na <strong>quinta-feira, 12, e na sexta-feira, 13</strong>, ocorrerão as mesas temáticas de trabalhos. Na <a href="{{url_sitio}}/#agenda" style="color:#467886;text-decoration:underline;">agenda do Congresso</a> vocês encontrarão <strong>os horários, as salas e os links de acesso às sessões virtuais</strong>. Todos os horários correspondem à <strong>Cidade do México</strong>.</p>
<p style="margin:26px 0 8px;font-size:18px;line-height:1.35;font-weight:bold;color:#002269;text-align:left;">Certificado de participação</p>
<p style="margin:0 0 16px;">Será concedido certificado a quem comprovar pelo menos <strong>80% de frequência nas mesas temáticas de 12 e 13 de novembro</strong>. Quando duas mesas ocorrerem no mesmo horário, poderão escolher a de seu interesse e a sua presença será contabilizada para esse bloco.</p>
<p style="margin:26px 0 8px;font-size:18px;line-height:1.35;font-weight:bold;color:#002269;text-align:left;">Participação presencial</p>
<p style="margin:0 0 16px;">Aguardamos vocês na sede do CIESS, na <strong>calle San Ramón s/n, colonia San Jerónimo Lídice, C.P. 10200, Cidade do México</strong>. Durante a sessão será distribuído um <strong>código QR com o qual poderão registrar a sua presença em cada sessão.</strong></p>
<p style="margin:26px 0 8px;font-size:18px;line-height:1.35;font-weight:bold;color:#002269;text-align:left;">Participação on-line</p>
<p style="margin:0 0 16px;">Para se conectar, consultem a <a href="{{url_sitio}}/#agenda" style="color:#467886;text-decoration:underline;">agenda do Congresso</a> e selecionem o <strong>link da sessão</strong> a que desejam assistir. A plataforma registrará automaticamente a sua presença. Para que possamos identificá-la corretamente, pedimos que entrem com o <strong>nome completo que utilizaram ao se inscrever</strong> e se conectem desde o início de cada sessão. O registro da plataforma será utilizado para verificar o cumprimento do requisito de frequência para o certificado.</p>
<p style="margin:0 0 16px;">Muito obrigado por participar deste encontro, que preparamos em conjunto a partir da RIUSS. É uma alegria compartilhar estes dias de intercâmbio com quem nos acompanhará na sede e com quem se conectará de diferentes países.</p>
<p style="margin:0 0 16px;">Um cordial abraço,</p>
<p style="margin:0 0 24px;font-weight:bold;"><span style="color:#002269;">Comitê Organizador</span><br/><span style="color:#a08536;">Congresso da RIUSS | CIESS</span></p>$html$
 where clave = 'comunicado' and idioma = 'pt'
   and cuerpo_html like '%font-size:24px;line-height:1.25;font-weight:bold;color:#111111%'
   and cuerpo_html like '%mesa de registro localizada na entrada do auditório%';

-- Se quitó del comunicado la línea final de contacto («Para dudas o aclaraciones, escríbanos a …»).
-- Sólo se quita ese párrafo, con un replace exacto, y no se reescribe el cuerpo: si el comité retocó
-- el resto del texto desde el panel, se respeta. Si la línea ya no está, no se toca nada. Las
-- versiones nuevas del comunicado (arriba y en el esquema) ya nacen sin ella.
update plantillas_correo
   set cuerpo_html = replace(replace(replace(cuerpo_html,
         E'\n<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#5b6b7f;text-align:left;">Para dudas o aclaraciones, escríbanos a {{correo_contacto}}.</p>', ''),
         E'\n<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#5b6b7f;text-align:left;">For questions or clarifications, write to us at {{correo_contacto}}.</p>', ''),
         E'\n<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#5b6b7f;text-align:left;">Em caso de dúvida ou esclarecimento, escreva para {{correo_contacto}}.</p>', '')
 where clave = 'comunicado'
   and (   cuerpo_html like '%Para dudas o aclaraciones, escríbanos a {{correo_contacto}}.</p>%'
        or cuerpo_html like '%For questions or clarifications, write to us at {{correo_contacto}}.</p>%'
        or cuerpo_html like '%Em caso de dúvida ou esclarecimento, escreva para {{correo_contacto}}.</p>%');

-- La pregunta frecuente sobre editar el registro hablaba de «la fecha límite». Mismo criterio
-- que las demás: sólo si conserva el texto sembrado.
update faqs
   set respuesta = jsonb_build_object(
         'es', 'Sí. Al terminar el registro recibirá un folio y un enlace personal de edición, que también llega en el correo de confirmación. Puede modificar sus datos con ese enlace en cualquier momento; el registro se mantiene abierto, sin fecha límite.',
         'en', 'Yes. When you finish registering you receive a reference number and a personal editing link, which also arrives in the confirmation e-mail. You can amend your details with that link at any time; registration remains open, with no deadline.',
         'pt', 'Sim. Ao concluir a inscrição você recebe um protocolo e um link pessoal de edição, que também chega no e-mail de confirmação. Você pode alterar seus dados com esse link a qualquer momento; a inscrição continua aberta, sem prazo final.')
 where clave = 'editar'
   and respuesta->>'es' like '%hasta la fecha límite de registro; después de esa fecha%';

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

-- El aforo presencial sube de 60 a 100, y de ahí a 120.
--
-- Con condición, y no como estaba. Esto corre en cada despliegue, y mientras
-- fue una orden sin condición el número del panel era decorativo: el comité lo
-- cambiaba, el despliegue siguiente lo devolvía a 60 y nadie ataba una cosa
-- con la otra. Así se aplica una sola vez —desde el valor que había— y a
-- partir de ahí manda el panel, que es donde se decide un aforo.
update configuracion set valor = '100'::jsonb
 where clave = 'cupos_presenciales' and valor = '60'::jsonb;

-- Y de 100 a 120, con la misma condición: sólo si sigue en 100.
update configuracion set valor = '120'::jsonb
 where clave = 'cupos_presenciales' and valor = '100'::jsonb;

-- Las preguntas frecuentes que hablaban de la agenda como algo por publicar.
--
-- Las filas de la base no se tocan al desplegar —se insertan sólo si faltan—, y
-- lo que hay en src/i18n/faqs.ts es sólo la reserva para cuando la tabla está
-- vacía: reescribir el texto allí no llega a un servidor que ya tiene sus filas.
-- Por eso la respuesta nueva se aplica aquí.
--
-- Cada una se reconoce por una frase del texto viejo y sólo se reescribe si
-- todavía la lleva. Si el comité la editó desde el panel, ya no la lleva y se
-- respeta lo que escribió.
--
-- La de «sede-fechas» se reescribía antes sin condición en cada despliegue:
-- cualquier cambio que se le hiciera, aquí o en el panel, se deshacía en el
-- siguiente. Ése era el motivo de que siguiera diciendo «se publicará».
update faqs
   set pregunta  = jsonb_build_object('es', '¿Qué es el 1er Congreso Desafíos de la seguridad social en las Américas?', 'en', 'What is the 1st Congress on the challenges of social security in the Americas?', 'pt', 'O que é o 1º Congresso Desafios da seguridade social nas Américas?'),
       respuesta = jsonb_build_object('es', 'Es el primer Congreso de estudios interamericanos de seguridad social convocado por el CIESS y la RIUSS. Reúne a personas investigadoras, funcionarias y especialistas del continente para discutir los desafíos de la seguridad social en el primer cuarto del siglo XXI. La agenda general —tres días y once mesas temáticas— ya está publicada: puede verla en la página de inicio o descargarla desde el botón de esta página.', 'en', 'It is the first Congress of inter-American social security studies convened by CIESS and CISS. It brings together researchers, public officials and specialists from across the continent to discuss the challenges facing social security in the first quarter of the 21st century. The general agenda —three days and eleven thematic panels— is now published: you can see it on the home page or download it from the button on this page.', 'pt', 'É o primeiro Congresso de estudos interamericanos de seguridade social convocado pelo CIESS e pela CISS. Reúne pesquisadores, servidores públicos e especialistas do continente para discutir os desafios da seguridade social no primeiro quarto do século XXI. A agenda geral —três dias e onze mesas temáticas— já está publicada: pode vê-la na página inicial ou baixá-la no botão desta página.')
 where clave = 'que-es'
   and respuesta->>'es' like '%se publican en la convocatoria oficial%';

update faqs
   set pregunta  = jsonb_build_object('es', '¿Dónde y cuándo se realiza?', 'en', 'Where and when does it take place?', 'pt', 'Onde e quando acontece?'),
       respuesta = jsonb_build_object('es', 'Del 11 al 13 de noviembre de 2026, en la sede del CIESS: San Ramón s/n, Col. San Jerónimo Lídice, C.P. 10200, Ciudad de México. La agenda general ya está publicada: el miércoles 11 son las sesiones internas de trabajo de la RIUSS; el jueves 12, la inauguración, la conferencia magistral y las mesas temáticas 1 a 4; y el viernes 13, las mesas 5 a 11 y la clausura.', 'en', '11–13 November 2026, at the CIESS headquarters: San Ramón s/n, Col. San Jerónimo Lídice, C.P. 10200, Mexico City. The general agenda is now published: Wednesday 11 brings the RIUSS internal working sessions; Thursday 12 brings the opening, the keynote lecture and thematic panels 1 to 4; and Friday 13, panels 5 to 11 and the closing.', 'pt', 'De 11 a 13 de novembro de 2026, na sede do CIESS: San Ramón s/n, Col. San Jerónimo Lídice, C.P. 10200, Cidade do México. A agenda geral já está publicada: na quarta-feira 11 são as sessões internas de trabalho da RIUSS; na quinta-feira 12, a abertura, a conferência magistral e as mesas temáticas 1 a 4; e na sexta-feira 13, as mesas 5 a 11 e o encerramento.')
 where clave = 'sede-fechas'
   and respuesta->>'es' like '%se publicará antes del inicio del Congreso%';

update faqs
   set pregunta  = jsonb_build_object('es', '¿Cuáles son los ejes temáticos?', 'en', 'What are the thematic axes?', 'pt', 'Quais são os eixos temáticos?'),
       respuesta = jsonb_build_object('es', 'Son nueve y están en la página de inicio: seguridad y salud en el trabajo, pensiones, salud, financiamiento, servicios sociales, población migrante, género, la seguridad social en América, y mercado laboral. Al registrarse como ponente elige el eje al que se adscribe su trabajo. Los trabajos aceptados se agruparon después en once mesas temáticas, que puede ver en la agenda.', 'en', 'There are nine, listed on the home page: occupational safety and health, pensions, health, financing, social services, migrant population, gender, social security in the Americas, and the labour market. When you register as a speaker you choose the axis your paper belongs to. Accepted papers were then grouped into eleven thematic panels, which you can see in the agenda.', 'pt', 'São nove e estão na página inicial: segurança e saúde no trabalho, pensões, saúde, financiamento, serviços sociais, população migrante, gênero, a seguridade social na América e mercado de trabalho. Ao se inscrever como palestrante você escolhe o eixo ao qual seu trabalho se vincula. Os trabalhos aprovados foram depois agrupados em onze mesas temáticas, que pode ver na agenda.')
 where clave = 'ejes'
   and respuesta->>'es' like '%definitivos se establecen en la convocatoria oficial%';

update faqs
   set pregunta  = jsonb_build_object('es', '¿Se entrega constancia de participación?', 'en', 'Is a certificate of participation issued?', 'pt', 'É emitido certificado de participação?'),
       respuesta = jsonb_build_object('es', 'Sí. En el formulario puede indicar el nombre exacto tal como debe aparecer en la constancia. Las condiciones y los plazos de entrega los comunica el comité organizador por correo.', 'en', 'Yes. In the form you can state the exact name as it should appear on the certificate. The conditions and delivery times are communicated by the organizing committee by email.', 'pt', 'Sim. No formulário você pode indicar o nome exato como deve constar no certificado. As condições e os prazos de entrega são comunicados pelo comitê organizador por e-mail.')
 where clave = 'constancia'
   and respuesta->>'es' like '%se precisan en la convocatoria oficial%';

update faqs
   set pregunta  = jsonb_build_object('es', '¿Dónde consulto la agenda del Congreso?', 'en', 'Where can I see the Congress agenda?', 'pt', 'Onde consulto a agenda do Congresso?'),
       respuesta = jsonb_build_object('es', 'En la página de inicio está la agenda de los tres días, con el horario y la sala de cada sesión. El PDF completo —con el título, la autoría y el país de cada ponencia— se descarga desde el botón de esta página, y es siempre la versión vigente: si algo cambia, cambia ahí.', 'en', 'The home page shows the agenda for all three days, with the time and room of each session. The full PDF —with the title, authors and country of every paper— can be downloaded from the button on this page, and it is always the current version: if anything changes, it changes there.', 'pt', 'Na página inicial está a agenda dos três dias, com o horário e a sala de cada sessão. O PDF completo —com o título, a autoria e o país de cada trabalho— baixa-se no botão desta página, e é sempre a versão vigente: se algo mudar, muda ali.')
 where clave = 'agenda'
   and respuesta->>'es' like '%Mientras se publica la agenda definitiva%';

-- El interruptor de la agenda.
--
-- Entra apagado: el PDF se corrige hasta el último momento, y una versión
-- vieja circulando por los acuses es peor que ninguna. Lo enciende el comité
-- desde el panel cuando la versión buena esté arriba, sin esperar un
-- despliegue.
--
-- Con «do nothing», que es lo que hace que el panel mande: una vez encendido,
-- ningún despliegue posterior vuelve a apagarlo.
insert into configuracion (clave, valor, descripcion) values
  ('programa_publicado', 'false'::jsonb,
   'Enseña la agenda en el sitio y el botón de descarga en los acuses')
on conflict (clave) do nothing;

-- La agenda en portugués.
--
-- Quien tiene el sitio en portugués descarga ésta, y quien se registra en ese
-- idioma la recibe en su acuse. Con `do nothing`, lo que el comité escriba en
-- el panel —incluso dejarla vacía, para volver a la general— no se pisa.
insert into configuracion (clave, valor, descripcion) values
  ('url_agenda_en', '"https://home.ciess.org/wp-content/uploads/2026/10/Programa_Congreso_RIUSS_2026_EN.pdf"'::jsonb,
   'PDF de la agenda en inglés; vacío = se usa el general'),
  ('url_agenda_pt', '"https://home.ciess.org/wp-content/uploads/2026/10/Programa_Congreso_RIUSS_2026_PT.pdf"'::jsonb,
   'PDF de la agenda en portugués; vacío = se usa el general')
on conflict (clave) do nothing;

-- La agenda definitiva.
--
-- Pasó por tres direcciones: la convocatoria de marzo, la agenda
-- provisional de octubre y, ahora, la definitiva. Según cuándo se haya
-- desplegado por última vez, el servidor tiene guardada la primera o la
-- segunda, y las dos se llevan a la nueva.
--
-- Sólo esas dos: si el comité escribió otra dirección en el panel, el
-- despliegue siguiente no debe devolverla a ésta. El panel manda.
update configuracion
   set valor = '"https://home.ciess.org/wp-content/uploads/2026/10/Agenda_Congreso_RIUSS_2026.pdf"'::jsonb,
       descripcion = 'PDF de la agenda general del Congreso'
 where clave = 'url_agenda'
   and valor in (
     '"https://home.ciess.org/wp-content/uploads/2026/03/Convocatoria-congreso.pdf"'::jsonb,
     '"https://home.ciess.org/wp-content/uploads/2026/10/Agenda_Congreso_RIUSS_2026_publico.pdf"'::jsonb
   );

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
         '—la agenda, la sede y las preguntas frecuentes—')
 where cuerpo_html like '%el programa conforme se publique%';
update plantillas_correo
   set cuerpo_html = replace(cuerpo_html,
         '—the call for papers, the venue, the programme as it is published and the frequently asked questions—',
         '—the agenda, the venue and the frequently asked questions—')
 where cuerpo_html like '%the programme as it is published%';
update plantillas_correo
   set cuerpo_html = replace(cuerpo_html,
         '—a convocatória, a sede, a programação conforme for publicada e as perguntas frequentes—',
         '—a agenda, a sede e as perguntas frequentes—')
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

-- La sala de Meet.
--
-- En la agenda, lo que pasa en el Auditorio se sigue por Zoom y lo que pasa en las
-- salas de la planta baja (comisiones y sesiones), por Meet. Con `do nothing`: si el
-- comité cambia el enlace en el panel —o lo deja vacío para quitar el botón—, el
-- siguiente despliegue no lo pisa. No toca ningún registro.
insert into configuracion (clave, valor, descripcion) values
  ('url_sesion_meet', '"https://meet.google.com/gfa-wwhs-eep?hs=151"'::jsonb,
   'Sala de Google Meet de las salas de la planta baja (comisiones y sesiones)')
on conflict (clave) do nothing;

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
         '<p>Toda la información del Congreso —la agenda, la sede y las preguntas frecuentes— está en el sitio: <a href="{{url_sitio}}">{{url_sitio}}</a>.</p>')
 where cuerpo_html like '%La convocatoria y la agenda están disponibles%';

update plantillas_correo
   set cuerpo_html = replace(cuerpo_html,
         '<p>The call for papers and the agenda are available in <a href="{{url_agenda}}">this document</a>.</p>',
         '<p>All the Congress information —the agenda, the venue and the frequently asked questions— is on the website: <a href="{{url_sitio}}">{{url_sitio}}</a>.</p>')
 where cuerpo_html like '%The call for papers and the agenda are available%';

update plantillas_correo
   set cuerpo_html = replace(cuerpo_html,
         '<p>A convocatória e a agenda estão disponíveis <a href="{{url_agenda}}">neste documento</a>.</p>',
         '<p>Todas as informações do Congresso —a agenda, a sede e as perguntas frequentes— estão no site: <a href="{{url_sitio}}">{{url_sitio}}</a>.</p>')
 where cuerpo_html like '%A convocatória e a agenda estão disponíveis%';

-- Programa → Agenda, en lo que ya está guardado en la base.
--
-- El texto del sitio sale de las tablas y no del código: el aviso de
-- privacidad, las plantillas de correo y las preguntas frecuentes que el
-- comité haya editado conservan lo que decían. Se reemplazan frases enteras y
-- no la palabra, porque en español «el programa» es masculino y «la agenda»
-- femenino: «el programa general ya está publicado» pide «la agenda general ya
-- está publicada», y un reemplazo ciego dejaría «el agenda».
--
-- Puede correr mil veces: tras el reemplazo, la frase vieja ya no existe.
do $renombrar$
declare
  par record;
begin
  for par in
    select * from (values
      ('sin participar en el programa.', 'sin participar en la agenda.'),
      ('necesaria para elaborar el programa, preparar', 'necesaria para elaborar la agenda, preparar'),
      ('cómo debe aparecer en el programa.', 'cómo debe aparecer en la agenda.'),
      ('antes de cerrar el programa.', 'antes de cerrar la agenda.'),
      ('se usan en el programa, las constancias', 'se usan en la agenda, las constancias'),
      ('se publica en el programa', 'se publica en la agenda'),
      ('Se publica en el programa', 'Se publica en la agenda'),
      ('quienes participan en el programa', 'quienes participan en la agenda'),
      ('El programa del Congreso', 'La agenda del Congreso'),
      ('Descargar el programa (PDF)', 'Descargar la agenda (PDF)'),
      ('El programa general ya está publicado.', 'La agenda general ya está publicada.'),
      ('Consultar el programa completo (PDF)', 'Consultar la agenda completa (PDF)'),
      ('el programa no se enseña en el sitio', 'la agenda no se enseña en el sitio'),
      ('El programa general publicado:', 'La agenda general publicada:'),
      ('Consúltelo para saber', 'Consúltela para saber'),
      ('Publicación de la programación completa', 'Publicación de la agenda completa'),
      ('tal como debe aparecer en el programa', 'tal como debe aparecer en la agenda'),
      ('elaborar el programa académico', 'elaborar la agenda académica'),
      ('El programa general —tres días y once mesas temáticas— ya está publicado: puede verlo en la página de inicio o descargarlo desde el botón de esta página.', 'La agenda general —tres días y once mesas temáticas— ya está publicada: puede verla en la página de inicio o descargarla desde el botón de esta página.'),
      ('El programa general ya está publicado: el miércoles 11 es la jornada de la RIUSS;', 'La agenda general ya está publicada: el miércoles 11 son las sesiones internas de trabajo de la RIUSS;'),
      ('que puede ver en el programa.', 'que puede ver en la agenda.'),
      ('¿Dónde consulto el programa del Congreso?', '¿Dónde consulto la agenda del Congreso?'),
      ('En la página de inicio está el programa de los tres días', 'En la página de inicio está la agenda de los tres días'),
      ('—el programa, la sede y las preguntas frecuentes—', '—la agenda, la sede y las preguntas frecuentes—'),
      ('se comunicarán con el programa definitivo.', 'se comunicarán con la agenda definitiva.'),
      ('en el programa de esta edición', 'en la agenda de esta edición'),
      ('Enseña el programa en el sitio', 'Enseña la agenda en el sitio'),
      ('PDF del programa general del Congreso', 'PDF de la agenda general del Congreso'),
      ('without taking part in the programme.', 'without taking part in the agenda.'),
      ('required to prepare the programme, name plates', 'required to prepare the agenda, name plates'),
      ('how it should appear in the programme.', 'how it should appear in the agenda.'),
      ('before the programme is finalised.', 'before the agenda is finalised.'),
      ('is used in the programme, the certificates', 'is used in the agenda, the certificates'),
      ('published in the programme', 'published in the agenda'),
      ('those taking part in the programme', 'those taking part in the agenda'),
      ('The Congress programme', 'The Congress agenda'),
      ('the Congress programme', 'the Congress agenda'),
      ('Download the programme (PDF)', 'Download the agenda (PDF)'),
      ('The general programme is now published.', 'The general agenda is now published.'),
      ('Read the full programme (PDF)', 'Read the full agenda (PDF)'),
      ('the programme is not shown on the site', 'the agenda is not shown on the site'),
      ('Full programme published', 'Full agenda published'),
      ('preparing the academic programme', 'preparing the academic agenda'),
      ('The general programme —three days and eleven thematic panels— is now published:', 'The general agenda —three days and eleven thematic panels— is now published:'),
      ('The general programme is now published: Wednesday 11 is the RIUSS working day;', 'The general agenda is now published: Wednesday 11 brings the RIUSS internal working sessions;'),
      ('which you can see in the programme.', 'which you can see in the agenda.'),
      ('The home page shows the programme for all three days', 'The home page shows the agenda for all three days'),
      ('—the programme, the venue and the frequently asked questions—', '—the agenda, the venue and the frequently asked questions—'),
      ('will be announced with the final programme.', 'will be announced with the final agenda.'),
      ('in the programme for this edition', 'in the agenda for this edition'),
      ('sem integrar a programação.', 'sem integrar a agenda.'),
      ('para a elaboração do programa,', 'para a elaboração da agenda,'),
      ('deve aparecer na programação.', 'deve aparecer na agenda.'),
      ('antes de fechar a programação.', 'antes de fechar a agenda.'),
      ('são usados no programa,', 'são usados na agenda,'),
      ('publicado no programa', 'publicado na agenda'),
      ('publicada no programa', 'publicada na agenda'),
      ('quem participa do programa', 'quem participa da agenda'),
      ('A programação do Congresso', 'A agenda do Congresso'),
      ('a programação do Congresso', 'a agenda do Congresso'),
      ('Baixar a programação (PDF)', 'Baixar a agenda (PDF)'),
      ('A programação geral já está publicada.', 'A agenda geral já está publicada.'),
      ('Consultar a programação completa (PDF)', 'Consultar a agenda completa (PDF)'),
      ('a programação não é exibida no site', 'a agenda não é exibida no site'),
      ('Publicação da programação completa', 'Publicação da agenda completa'),
      ('elaborar o programa acadêmico', 'elaborar a agenda acadêmica'),
      ('A programação geral —três dias e onze mesas temáticas— já está publicada:', 'A agenda geral —três dias e onze mesas temáticas— já está publicada:'),
      ('A programação geral já está publicada: na quarta-feira 11 é a jornada da RIUSS;', 'A agenda geral já está publicada: na quarta-feira 11 são as sessões internas de trabalho da RIUSS;'),
      ('que pode ver na programação.', 'que pode ver na agenda.'),
      ('Na página inicial está a programação dos três dias', 'Na página inicial está a agenda dos três dias'),
      ('—a programação, a sede e as perguntas frequentes—', '—a agenda, a sede e as perguntas frequentes—'),
      (' As informações logísticas e a programação serão enviadas por esta mesma via.', ' As informações logísticas serão enviadas por esta mesma via.'),
      ('serão comunicados com a programação definitiva.', 'serão comunicados com a agenda definitiva.'),
      ('na programação desta edição', 'na agenda desta edição'),
      ('consultar a programação <a', 'consultar a agenda <a')
    ) as t(viejo, nuevo)
  loop
    update faqs
       set pregunta  = replace(pregunta::text,  par.viejo, par.nuevo)::jsonb,
           respuesta = replace(respuesta::text, par.viejo, par.nuevo)::jsonb
     where position(par.viejo in pregunta::text) > 0
        or position(par.viejo in respuesta::text) > 0;

    update aviso_privacidad
       set titulo   = replace(titulo::text,   par.viejo, par.nuevo)::jsonb,
           parrafos = replace(parrafos::text, par.viejo, par.nuevo)::jsonb
     where position(par.viejo in titulo::text) > 0
        or position(par.viejo in parrafos::text) > 0;

    update plantillas_correo
       set asunto      = replace(asunto,      par.viejo, par.nuevo),
           cuerpo_html = replace(cuerpo_html, par.viejo, par.nuevo)
     where position(par.viejo in asunto) > 0
        or position(par.viejo in cuerpo_html) > 0;

    update configuracion
       set descripcion = replace(descripcion, par.viejo, par.nuevo)
     where position(par.viejo in coalesce(descripcion, '')) > 0;
  end loop;
end
$renombrar$;

commit;

select clave, valor from configuracion
 where clave in ('congreso_nombre', 'congreso_fechas', 'congreso_sede',
                 'congreso_fecha_inicio', 'congreso_fecha_fin',
                 'fecha_limite_registro', 'correo_contacto')
 order by clave;

select clave, orden, titulo->>'es' as apartado
  from aviso_privacidad where activo order by orden;

select count(*) as faqs_provisionales from faqs where provisional;
