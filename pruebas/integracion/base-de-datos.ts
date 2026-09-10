/**
 * Prueba de integración contra un PostgreSQL de verdad.
 *
 *   DATABASE_URL=postgresql://… npm run prueba-bd
 *
 * Las pruebas unitarias cubren las reglas; esto cubre lo que sólo se ve al
 * hablar con el motor: los disparadores de auditoría, las vistas, los índices
 * únicos y la transacción de sólo lectura de la consola SQL.
 *
 * Escribe y borra en la base contra la que apunte DATABASE_URL: no usar con
 * la base de producción.
 */
import { consultar, conActor, unaFila, enSoloLectura, armarInsercion } from '../../src/lib/bd/conexion';
import { cifrarClave, claveCoincide } from '../../src/lib/bd/claves';

function comprobar(condicion: boolean, texto: string, detalle?: unknown) {
  if (condicion) {
    console.log('  ok  ' + texto);
  } else {
    console.log('FALLO ' + texto, detalle ?? '');
    process.exitCode = 1;
  }
}

const ok = (texto: string) => comprobar(true, texto);

async function principal() {
  // 1. Contraseñas
  const hash = await cifrarClave('contraseña-de-prueba-larga');
  comprobar(await claveCoincide('contraseña-de-prueba-larga', hash), 'scrypt acepta la buena');
  comprobar(!(await claveCoincide('otra', hash)), 'scrypt rechaza la mala');

  // 2. Usuario del panel
  const [usuario] = await consultar<{ id: string }>(
    `insert into usuarios_panel (correo, nombre, rol, clave_hash)
     values ('prueba@ciess.org', 'Prueba', 'superadmin', $1)
     on conflict (lower(correo)) do update set clave_hash = excluded.clave_hash
     returning id`, [hash]);
  comprobar(Boolean(usuario?.id), 'alta de usuario del panel');

  // 3. Alta de registro (como el formulario público, sin actor)
  const { columnas, marcadores, valores } = armarInsercion({
    perfil: 'conferencista', grupo: 'externo', modalidad: 'presencial', idioma: 'es',
    nombres: 'Ana', apellidos: 'Prueba', correo: 'ana.prueba@example.org',
    institucion: 'CIESS', pais_residencia: 'México', estado: 'en_proceso',
    consentimiento_datos: true, titulo_ponencia: 'Una ponencia', resumen_ponencia: 'Resumen.',
  });
  const registro = await unaFila<{ id: string; folio: string }>(
    `insert into registros (${columnas}) values (${marcadores}) returning id, folio`, valores);
  comprobar(Boolean(registro?.folio), `alta de registro con folio ${registro?.folio}`);

  // 4. Auditoría sin actor: origen «sistema»
  const aud = await unaFila<{ origen: string; actor_id: string | null }>(
    `select origen, actor_id from auditoria where registro_id = $1 order by ocurrido_en desc limit 1`,
    [registro!.id]);
  comprobar(
    aud?.origen === 'sistema' && aud.actor_id === null,
    'auditoría registra el alta pública como del sistema', aud);

  // 5. Cambio con actor: la auditoría lo atribuye
  await conActor(usuario!.id, `update registros set estado = 'confirmado' where id = $1`, [registro!.id]);
  const aud2 = await unaFila<{ origen: string; actor_correo: string; actor_rol: string; campos: string[] }>(
    `select origen, actor_correo, actor_rol, campos from auditoria
      where registro_id = $1 and accion = 'UPDATE' order by ocurrido_en desc limit 1`, [registro!.id]);
  comprobar(
    aud2?.actor_correo === 'prueba@ciess.org' && aud2.origen === 'panel',
    `auditoría atribuye el cambio (campos: ${aud2?.campos?.join(', ')})`, aud2);

  // 6. Auditoría de la configuración: la que fallaba por no tener columna id
  await conActor(usuario!.id, `update configuracion set valor = '250'::jsonb where clave = 'cupos_presenciales'`);
  const aud3 = await unaFila<{ registro_id: string }>(
    `select registro_id from auditoria where tabla = 'configuracion' order by ocurrido_en desc limit 1`);
  comprobar(
    aud3?.registro_id === 'cupos_presenciales',
    'auditoría de configuracion usa la clave como identificador', aud3);

  // 7. Vista de cupos
  const cupos = await unaFila<{ cupo_presencial: number; ocupado_presencial: string }>(
    'select cupo_presencial, ocupado_presencial from cupos_estado');
  comprobar(Boolean(cupos), `cupos_estado: ${cupos?.ocupado_presencial} de ${cupos?.cupo_presencial}`);

  // 8. Vista de ponencias
  const ponencias = await consultar('select * from v_ponencias');
  comprobar(ponencias.length >= 1, `v_ponencias devuelve ${ponencias.length}`);

  // 9. Consola SQL: lectura pasa, escritura no
  const filas = await enSoloLectura(async (c) => (await c.query('select count(*) from registros')).rows);
  comprobar(filas.length === 1, 'consulta de sólo lectura funciona');
  try {
    await enSoloLectura(async (c) => c.query(`delete from registros`));
    comprobar(false, 'la transacción de sólo lectura debía rechazar el DELETE');
  } catch {
    ok('la transacción de sólo lectura rechaza el DELETE');
  }

  // 10. Un correo, un registro vigente
  try {
    await consultar(`insert into registros (${columnas}) values (${marcadores})`, valores);
    comprobar(false, 'el índice único del correo debía rechazar el duplicado');
  } catch (e) {
    comprobar(
      (e as { code?: string }).code === '23505',
      'el índice único rechaza un segundo registro con el mismo correo', e);
  }

  // Limpieza
  await consultar(`delete from registros where correo = 'ana.prueba@example.org'`);
  await consultar(`delete from usuarios_panel where correo = 'prueba@ciess.org'`);
  await consultar(`update configuracion set valor = '300'::jsonb where clave = 'cupos_presenciales'`);
  ok('limpieza');
}

principal().then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => { console.error('ERROR', e); process.exit(1); });
