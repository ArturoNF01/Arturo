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

  // 11. Envíos masivos de comunicados
  const {
    repositorioPg, calcularAudiencia, crearCampana, procesarTanda, armarDeLaCampana, listarCampanas,
  } = await import('../../src/lib/servidor/comunicados');

  const altas: [string, string, string, string][] = [
    ['masivo.uno@example.org', 'ponente', 'confirmado', 'es'],
    ['masivo.dos@example.org', 'publico_general', 'en_proceso', 'en'],
    ['masivo.tres@example.org', 'publico_general', 'lista_espera', 'pt'],
    ['masivo.cuatro@example.org', 'publico_general', 'cancelado', 'es'],
  ];
  for (const [correo, perfil, estado, idioma] of altas) {
    const a = armarInsercion({
      perfil, grupo: 'externo', modalidad: 'presencial', idioma, nombres: 'Masivo', apellidos: correo.split('@')[0],
      correo, institucion: 'CIESS', pais_residencia: 'México', estado, consentimiento_datos: true,
    });
    await consultar(`insert into registros (${a.columnas}) values (${a.marcadores})`, a.valores);
  }

  const todos = await calcularAudiencia({ clave: 'comunicado', audiencia: 'todos' });
  const correosDe = (r: Awaited<ReturnType<typeof calcularAudiencia>>) => (r.ok ? r.destinatarios.map((d) => d.correo) : []);
  comprobar(
    todos.ok && correosDe(todos).includes('masivo.uno@example.org') && correosDe(todos).includes('masivo.dos@example.org'),
    'a todos: llegan los registros vigentes');
  comprobar(
    !correosDe(todos).includes('masivo.tres@example.org') && !correosDe(todos).includes('masivo.cuatro@example.org'),
    'a todos: no la lista de espera ni los cancelados');
  const conEspera = await calcularAudiencia({ clave: 'comunicado', audiencia: 'todos', incluirListaEspera: true });
  comprobar(correosDe(conEspera).includes('masivo.tres@example.org'), 'a todos: con la lista de espera incluida, también ella');
  const ponentes = await calcularAudiencia({ clave: 'comunicado', audiencia: 'ponentes' });
  comprobar(
    correosDe(ponentes).includes('masivo.uno@example.org') && !correosDe(ponentes).includes('masivo.dos@example.org'),
    'a ponentes: sólo ese perfil');
  const noMasiva = await calcularAudiencia({ clave: 'confirmacion_registro', audiencia: 'todos' });
  comprobar(!noMasiva.ok, 'un acuse no se manda en masa');

  const lista = 'masivo.uno@example.org, nuevo.fuera.de.registro@example.org';
  const mal = await crearCampana({ clave: 'comunicado', audiencia: 'lista', lista, confirmacion: '999', usuarioId: usuario!.id });
  comprobar(!mal.ok && mal.codigo === 'cifra', 'una cifra de confirmación equivocada no crea el envío', mal);
  comprobar(
    (await consultar(`select 1 from campanas_correo where creada_por = $1`, [usuario!.id])).length === 0,
    'y no deja nada a medias');

  const bien = await crearCampana({ clave: 'comunicado', audiencia: 'lista', lista, confirmacion: '2', usuarioId: usuario!.id, idioma: 'pt' });
  comprobar(bien.ok && bien.total === 2, 'con la cifra correcta se crea el envío', bien);
  if (!bien.ok) throw new Error('No se pudo crear la campaña de prueba');

  const dos = await crearCampana({ clave: 'comunicado', audiencia: 'lista', lista, confirmacion: '2', usuarioId: usuario!.id });
  comprobar(!dos.ok && dos.codigo === 'en_curso', 'no se crea otro envío mientras haya uno sin terminar', dos);

  const congelada = await unaFila<{ plantilla: Record<string, { asunto: string }> }>(
    'select plantilla from campanas_correo where id = $1', [bien.id]);
  comprobar(Boolean(congelada?.plantilla.es && congelada.plantilla.en && congelada.plantilla.pt), 'la plantilla queda congelada en los tres idiomas');

  const idiomas = await consultar<{ correo: string; idioma: string; registro_id: string | null }>(
    'select correo, idioma, registro_id from envios_campana where campana_id = $1 order by correo', [bien.id]);
  comprobar(
    idiomas[0]?.correo === 'masivo.uno@example.org' && idiomas[0].idioma === 'es' && idiomas[0].registro_id !== null &&
    idiomas[1]?.idioma === 'pt' && idiomas[1].registro_id === null,
    'la persona registrada va en su idioma y la que no lo está, en el elegido', idiomas);

  const mandados: { to: string; subject: string; html: string }[] = [];
  const enviador = {
    async lote(correos: typeof mandados) { mandados.push(...correos); return { error: null }; },
    async uno(correo: (typeof mandados)[number]) { mandados.push(correo); return { error: null }; },
  };
  const tanda = await procesarTanda({ repo: repositorioPg, enviador, armar: (f) => armarDeLaCampana(bien.id, f), campanaId: bien.id });
  comprobar(tanda.progreso.enviados === 2 && tanda.progreso.pendientes === 0, 'la tanda manda a las dos personas', tanda.progreso);
  comprobar(
    mandados.length === 2 && mandados.every((m) => m.html.includes('comunicado-cabecera.png') && !m.html.includes('{{')),
    'el correo sale armado, con el diseño y sin variables sueltas');
  comprobar(
    mandados.find((m) => m.to === 'nuevo.fuera.de.registro@example.org')?.subject.startsWith('Acesso às sessões') === true,
    'la persona no registrada recibe el asunto en portugués, el idioma elegido');
  const cerrada = await unaFila<{ estado: string }>('select estado from campanas_correo where id = $1', [bien.id]);
  comprobar(cerrada?.estado === 'terminada', 'al terminar, la campaña se cierra');

  const otra = await procesarTanda({ repo: repositorioPg, enviador, armar: (f) => armarDeLaCampana(bien.id, f), campanaId: bien.id });
  comprobar(mandados.length === 2 && otra.progreso.enviados === 2, 'otra pasada no vuelve a mandar a nadie');

  const despues = await calcularAudiencia({ clave: 'comunicado', audiencia: 'todos' });
  comprobar(
    despues.ok && !correosDe(despues).includes('masivo.uno@example.org') && correosDe(despues).includes('masivo.dos@example.org'),
    'a todos, después: quien ya lo recibió queda fuera y quien falta, no');

  // Dos reclamos a la vez no se solapan (FOR UPDATE SKIP LOCKED).
  const seis = Array.from({ length: 6 }, (_, i) => `concurrente${i}@example.org`).join(',');
  const c2 = await crearCampana({ clave: 'comunicado', audiencia: 'lista', lista: seis, confirmacion: '6', usuarioId: usuario!.id });
  if (!c2.ok) throw new Error('No se pudo crear la campaña concurrente');
  const [x, y] = await Promise.all([repositorioPg.reclamar(c2.id, 4), repositorioPg.reclamar(c2.id, 4)]);
  const repartidos = [...x, ...y].map((f) => f.correo);
  comprobar(new Set(repartidos).size === repartidos.length && repartidos.length === 6, 'dos reclamos a la vez reparten a cada persona una sola vez', repartidos);
  await repositorioPg.devolverAPendientes(c2.id, repartidos);
  comprobar((await repositorioPg.progreso(c2.id)).pendientes === 6, 'lo reclamado y no enviado vuelve a pendiente');

  const historial = await listarCampanas('comunicado');
  comprobar(historial.length >= 2 && historial.some((h) => h.id === bien.id && h.progreso.enviados === 2), 'el historial cuenta lo enviado');

  await consultar('delete from campanas_correo where creada_por = $1', [usuario!.id]);
  await consultar(`delete from registros where correo like '%@example.org' and nombres = 'Masivo'`);
  ok('limpieza de los envíos masivos');

  // Limpieza
  await consultar(`delete from registros where correo = 'ana.prueba@example.org'`);
  await consultar(`delete from usuarios_panel where correo = 'prueba@ciess.org'`);
  await consultar(`update configuracion set valor = '300'::jsonb where clave = 'cupos_presenciales'`);
  ok('limpieza');
}

principal().then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => { console.error('ERROR', e); process.exit(1); });
