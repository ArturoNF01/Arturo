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

alter table intentos_registro enable row level security;

-- Sólo el servidor escribe, con la clave de servicio. El panel lo lee para
-- saber si alguien está tropezando con el límite.
drop policy if exists intentos_lectura on intentos_registro;
create policy intentos_lectura on intentos_registro for select
  using (es_al_menos('organizador'));

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
