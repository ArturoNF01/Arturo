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

  // 12. Asistencia con QR
  const {
    asegurarCodigos, cambiarCodigo, resolverCodigo, registrarAsistencia, resumenPorSesion, asistentesDeSesion,
    conciliarAsistencia, buscarRegistros, todasLasAsistencias, eliminarAsistencia,
  } = await import('../../src/lib/servidor/asistencia');
  const { SESIONES_DE_ASISTENCIA } = await import('../../src/lib/asistencia');

  const codigos = await asegurarCodigos();
  const todosLosCodigos = Object.values(codigos).flatMap((c) => [c.presencial, c.en_linea]);
  comprobar(
    Object.keys(codigos).length === SESIONES_DE_ASISTENCIA.length && todosLosCodigos.length === SESIONES_DE_ASISTENCIA.length * 2,
    'asistencia: hay un código presencial y uno en línea por cada sesión', Object.keys(codigos).length);
  comprobar(new Set(todosLosCodigos).size === todosLosCodigos.length, 'asistencia: ningún código se repite');
  comprobar(JSON.stringify(await asegurarCodigos()) === JSON.stringify(codigos), 'asistencia: repetir no cambia los códigos que ya podían estar impresos');
  const viejo = codigos['mesa-4'].presencial;
  const nuevoCodigo = await cambiarCodigo('mesa-4', 'presencial');
  comprobar(
    nuevoCodigo !== null && nuevoCodigo !== viejo && (await resolverCodigo(viejo)) === null &&
    (await resolverCodigo(nuevoCodigo))?.sesion === 'mesa-4' && (await resolverCodigo(codigos['mesa-4'].en_linea))?.via === 'en_linea',
    'asistencia: cambiar un código invalida el anterior y no toca los demás');
  comprobar((await resolverCodigo('zzzzzzzzzz')) === null && (await resolverCodigo('corto')) === null, 'asistencia: un código que no existe no resuelve nada');

  const altasAsistencia: [string, string, string, string, string][] = [
    ['asis.uno@example.org', 'María Fernanda', 'Robles Iturbide', 'confirmado', 'es'],
    ['asis.dos@example.org', 'Luis', 'Pérez Gómez', 'en_proceso', 'en'],
    ['asis.tres@example.org', 'Ana', 'Cancelada', 'cancelado', 'es'],
  ];
  const idsAsis: Record<string, string> = {};
  for (const [correo, nombres, apellidos, estado, idioma] of altasAsistencia) {
    const a = armarInsercion({
      perfil: 'publico_general', grupo: 'externo', modalidad: 'presencial', idioma, nombres, apellidos,
      correo, institucion: 'CIESS', pais_residencia: 'México', estado, consentimiento_datos: true,
    });
    const fila = await unaFila<{ id: string }>(`insert into registros (${a.columnas}) values (${a.marcadores}) returning id`, a.valores);
    idsAsis[correo] = fila!.id;
  }

  const EN_SESION = new Date('2026-11-12T22:00:00Z'); // jueves 12, 16:00 en México: mesa 3 y mesa 4 en curso
  const codigoDe = (sesion: string, via: 'presencial' | 'en_linea') =>
    via === 'presencial' && sesion === 'mesa-4' ? nuevoCodigo! : codigos[sesion][via];

  const fuera = await registrarAsistencia({ codigo: codigoDe('mesa-4', 'presencial'), correo: 'asis.uno@example.org', ahora: new Date('2026-11-12T10:00:00Z') });
  comprobar(!fuera.ok && fuera.motivo === 'fuera_de_horario' && fuera.estado === 'antes', 'asistencia: fuera de horario no se registra', fuera);
  comprobar((await consultar('select 1 from asistencias')).length === 0, 'asistencia: y no deja nada guardado');

  const primera = await registrarAsistencia({ codigo: codigoDe('mesa-4', 'presencial'), correo: ' ASIS.UNO@Example.org ', ahora: EN_SESION });
  comprobar(primera.ok && primera.estado === 'registrada' && !primera.sinRegistro && primera.nombre === 'María' && primera.via === 'presencial',
    'asistencia: el correo de un registro (sin importar mayúsculas ni espacios) registra la asistencia presencial', primera);
  const repetida = await registrarAsistencia({ codigo: codigoDe('mesa-4', 'presencial'), correo: 'asis.uno@example.org', ahora: EN_SESION });
  comprobar(repetida.ok && repetida.estado === 'ya_registrada', 'asistencia: escanear dos veces no duplica', repetida);
  const porLaOtraVia = await registrarAsistencia({ codigo: codigoDe('mesa-4', 'en_linea'), correo: 'asis.uno@example.org', ahora: EN_SESION });
  comprobar(porLaOtraVia.ok && porLaOtraVia.estado === 'ya_registrada' && porLaOtraVia.via === 'presencial',
    'asistencia: la misma persona por la otra vía no cuenta dos veces y se le dice por cuál quedó', porLaOtraVia);
  const enOtraSesion = await registrarAsistencia({ codigo: codigoDe('mesa-3', 'en_linea'), correo: 'asis.dos@example.org', ahora: EN_SESION });
  comprobar(enOtraSesion.ok && enOtraSesion.via === 'en_linea', 'asistencia: la vía sale del código, no de lo que diga la persona', enOtraSesion);

  const primerPaso = await registrarAsistencia({ codigo: codigoDe('mesa-4', 'presencial'), correo: 'asis.mal.escrito@example.org', ahora: EN_SESION });
  comprobar(!primerPaso.ok && primerPaso.motivo === 'no_encontrado', 'asistencia: un correo desconocido pide nombre y correo, sin guardar nada todavía', primerPaso);
  comprobar((await resumenPorSesion())['mesa-4']?.total === 1, 'asistencia: y el primer paso no deja nada guardado');

  const porNombre = await registrarAsistencia({ codigo: codigoDe('mesa-4', 'presencial'), correo: 'asis.mal.escrito@example.org', nombre: 'robles iturbide, maria fernanda', ahora: EN_SESION });
  comprobar(porNombre.ok && porNombre.estado === 'ya_registrada' && !porNombre.sinRegistro,
    'asistencia: en el segundo paso, un nombre que coincide con un solo registro la identifica (aquí ya tenía su asistencia)', porNombre);

  const sinRegistro = await registrarAsistencia({ codigo: codigoDe('mesa-4', 'presencial'), correo: 'quien.sea@example.org', nombre: 'Pedro Ramírez', ahora: EN_SESION });
  comprobar(sinRegistro.ok && sinRegistro.estado === 'registrada' && sinRegistro.sinRegistro && sinRegistro.nombre === 'Pedro',
    'asistencia: si ni el correo ni el nombre aparecen, se guarda «sin registro»', sinRegistro);
  const sinRegistroOtraVez = await registrarAsistencia({ codigo: codigoDe('mesa-4', 'presencial'), correo: 'QUIEN.SEA@example.org', nombre: 'Pedro Ramírez', ahora: EN_SESION });
  comprobar(sinRegistroOtraVez.ok && sinRegistroOtraVez.estado === 'ya_registrada', 'asistencia: la asistencia «sin registro» tampoco se duplica', sinRegistroOtraVez);

  const cancelada = await registrarAsistencia({ codigo: codigoDe('mesa-4', 'presencial'), correo: 'asis.tres@example.org', nombre: 'Ana Cancelada', ahora: EN_SESION });
  comprobar(cancelada.ok && cancelada.sinRegistro, 'asistencia: un registro cancelado no se reconoce: queda «sin registro»', cancelada);

  const malCorreo = await registrarAsistencia({ codigo: codigoDe('mesa-4', 'presencial'), correo: 'no-es-un-correo', ahora: EN_SESION });
  comprobar(!malCorreo.ok && malCorreo.motivo === 'datos_invalidos', 'asistencia: un correo que no lo es se rechaza', malCorreo);
  const malCodigo = await registrarAsistencia({ codigo: 'zzzzzzzzzz', correo: 'asis.uno@example.org', ahora: EN_SESION });
  comprobar(!malCodigo.ok && malCodigo.motivo === 'codigo_invalido', 'asistencia: un código que no existe se rechaza', malCodigo);

  const resumen = await resumenPorSesion();
  comprobar(
    resumen['mesa-4']?.presencial === 3 && resumen['mesa-4'].sinRegistro === 2 && resumen['mesa-3']?.en_linea === 1,
    'asistencia: el resumen cuenta por sesión, por vía y «sin registro»', resumen);

  const asistentes = await asistentesDeSesion('mesa-4');
  comprobar(
    asistentes[0]?.nombre === 'María Fernanda Robles Iturbide' && asistentes[0].identificado_por === 'correo' && asistentes[0].folio !== null,
    'asistencia: la lista de una sesión trae el nombre del registro, no lo escrito', asistentes[0]);

  const suelta = asistentes.find((x) => x.registro_id === null && x.correo === 'quien.sea@example.org');
  const conciliada = await conciliarAsistencia(suelta!.id, idsAsis['asis.dos@example.org']);
  comprobar(conciliada.ok && conciliada.resultado === 'ligada', 'asistencia: el comité puede ligar una «sin registro» a su registro', conciliada);
  const despuesDeConciliar = (await asistentesDeSesion('mesa-4')).find((x) => x.id === suelta!.id);
  comprobar(despuesDeConciliar?.registro_id === idsAsis['asis.dos@example.org'] && despuesDeConciliar.identificado_por === 'conciliada' && despuesDeConciliar.nombre === 'Luis Pérez Gómez',
    'asistencia: y queda a nombre del registro', despuesDeConciliar);

  // Si esa persona ya tenía asistencia en la misma sesión, la fila suelta sobra: se descarta en vez de contar dos veces.
  await registrarAsistencia({ codigo: codigoDe('mesa-3', 'en_linea'), correo: 'otro@example.org', nombre: 'Otra Persona', ahora: EN_SESION });
  const otraSuelta = (await asistentesDeSesion('mesa-3')).find((x) => x.registro_id === null);
  const duplicada = await conciliarAsistencia(otraSuelta!.id, idsAsis['asis.dos@example.org']);
  comprobar(duplicada.ok && duplicada.resultado === 'duplicada_descartada', 'asistencia: ligar a quien ya tenía asistencia en la sesión descarta la duplicada', duplicada);
  comprobar((await asistentesDeSesion('mesa-3')).length === 1, 'asistencia: y no cuenta dos veces');
  const aCancelado = await conciliarAsistencia(suelta!.id, idsAsis['asis.tres@example.org']);
  comprobar(!aCancelado.ok, 'asistencia: no se liga a un registro cancelado', aCancelado);

  const encontrados = await buscarRegistros('asis.uno');
  comprobar(encontrados.length === 1 && encontrados[0].nombre === 'María Fernanda Robles Iturbide', 'asistencia: se busca el registro por correo para conciliar', encontrados);
  comprobar((await buscarRegistros('robles iturbide')).length === 1 && (await buscarRegistros('a')).length === 0, 'asistencia: o por nombre; con una letra no busca');

  const todas = await todasLasAsistencias();
  comprobar(todas.length >= 4 && todas.every((x, i) => i === 0 || todas[i - 1].creada_en <= x.creada_en), 'asistencia: todas, en orden de llegada');

  // Dar de baja un registro no borra la asistencia: la fila sigue diciendo quién fue.
  await consultar('delete from registros where id = $1', [idsAsis['asis.dos@example.org']]);
  const sobrevive = (await asistentesDeSesion('mesa-4')).find((x) => x.id === suelta!.id);
  comprobar(sobrevive !== undefined && sobrevive.registro_id === null && sobrevive.nombre === 'Luis Pérez Gómez',
    'asistencia: la baja de un registro no borra su asistencia', sobrevive);
  comprobar((await eliminarAsistencia(suelta!.id)) === true && (await eliminarAsistencia(suelta!.id)) === false, 'asistencia: quitar un escaneo que no correspondía');

  await consultar('delete from asistencias');
  await consultar('delete from asistencia_codigos');
  await consultar(`delete from registros where correo like 'asis.%@example.org'`);
  ok('limpieza de la asistencia');

  // Limpieza
  await consultar(`delete from registros where correo = 'ana.prueba@example.org'`);
  await consultar(`delete from usuarios_panel where correo = 'prueba@ciess.org'`);
  await consultar(`update configuracion set valor = '300'::jsonb where clave = 'cupos_presenciales'`);
  ok('limpieza');
}

principal().then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => { console.error('ERROR', e); process.exit(1); });
