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

alter table envios_recordatorio enable row level security;

drop policy if exists envios_lectura on envios_recordatorio;
create policy envios_lectura on envios_recordatorio for select
  using (es_al_menos('lector'));

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
create or replace view v_recordatorios_enviados as
select clave, count(*) as enviados, count(*) filter (where error is not null) as con_error,
       max(enviado_en) as ultimo_envio
from envios_recordatorio
group by clave;
