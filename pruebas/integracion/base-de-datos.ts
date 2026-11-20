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
import { readFileSync } from 'node:fs';
import { consultar, conActor, unaFila, enSoloLectura, armarInsercion } from '../../src/lib/bd/conexion';
import { cifrarClave, claveCoincide } from '../../src/lib/bd/claves';
import { armarDatosDePantalla, leerAvisoGuardado } from '../../src/lib/servidor/recepcion';

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
    conciliarAsistencia, buscarRegistros, todasLasAsistencias, eliminarAsistencia, leerCodigos,
  } = await import('../../src/lib/servidor/asistencia');

  // Quien sólo puede mirar (el lector) lee los códigos que hay y no crea ninguno.
  comprobar(Object.keys(await leerCodigos()).length === 0 && (await consultar('select 1 from asistencia_codigos')).length === 0,
    'códigos: leerlos sin que existan no crea nada');
  const codigos = await asegurarCodigos();
  comprobar(JSON.stringify(await leerCodigos()) === JSON.stringify(codigos), 'códigos: leerlos devuelve los mismos que creó quien organiza');
  const todosLosCodigos = Object.values(codigos).flatMap((c) => [c.presencial, c.en_linea]);
  comprobar(
    Object.keys(codigos).length === 3 && todosLosCodigos.length === 6,
    'asistencia: hay un código presencial y uno en línea por cada día (tres días, seis códigos)', Object.keys(codigos).length);
  comprobar(new Set(todosLosCodigos).size === todosLosCodigos.length, 'asistencia: ningún código se repite');
  comprobar(JSON.stringify(await asegurarCodigos()) === JSON.stringify(codigos), 'asistencia: repetir no cambia los códigos que ya podían estar impresos');
  // Los códigos de cuando la asistencia era por mesa se quitan: su QR ya no registra nada, y los de ahora no se tocan.
  await consultar(`insert into asistencia_codigos (sesion, via, codigo) values ('mesa-7', 'presencial', 'codigoviejo'), ('prueba', 'presencial', 'codigoprueba')`);
  const trasLimpiar = await asegurarCodigos();
  comprobar(!('mesa-7' in trasLimpiar) && JSON.stringify(trasLimpiar) === JSON.stringify(codigos),
    'asistencia: los códigos de sesiones que ya no existen se quitan y los de ahora no cambian');
  comprobar((await consultar(`select 1 from asistencia_codigos where sesion = 'prueba'`)).length === 1 && (await consultar(`select 1 from asistencia_codigos where sesion = 'mesa-7'`)).length === 0,
    'asistencia: y los de la sesión de prueba se respetan');
  await consultar(`delete from asistencia_codigos where sesion = 'prueba'`);
  const viejo = codigos['jueves'].presencial;
  const nuevoCodigo = await cambiarCodigo('jueves', 'presencial');
  comprobar(
    nuevoCodigo !== null && nuevoCodigo !== viejo && (await resolverCodigo(viejo)) === null &&
    (await resolverCodigo(nuevoCodigo))?.sesion === 'jueves' && (await resolverCodigo(codigos['jueves'].en_linea))?.via === 'en_linea',
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

  const EN_SESION = new Date('2026-11-12T22:00:00Z'); // jueves 12, 16:00 en México: la jornada del jueves está abierta
  const EN_VIERNES = new Date('2026-11-13T20:00:00Z'); // viernes 13, 14:00 en México
  const codigoDe = (sesion: string, via: 'presencial' | 'en_linea') =>
    via === 'presencial' && sesion === 'jueves' ? nuevoCodigo! : codigos[sesion][via];

  const fuera = await registrarAsistencia({ codigo: codigoDe('jueves', 'presencial'), correo: 'asis.uno@example.org', ahora: new Date('2026-11-12T10:00:00Z') });
  comprobar(!fuera.ok && fuera.motivo === 'fuera_de_horario' && fuera.estado === 'antes', 'asistencia: fuera de horario no se registra', fuera);
  comprobar((await consultar('select 1 from asistencias')).length === 0, 'asistencia: y no deja nada guardado');

  const primera = await registrarAsistencia({ codigo: codigoDe('jueves', 'presencial'), correo: ' ASIS.UNO@Example.org ', ahora: EN_SESION });
  comprobar(primera.ok && primera.estado === 'registrada' && !primera.sinRegistro && primera.nombre === 'María' && primera.via === 'presencial',
    'asistencia: el correo de un registro (sin importar mayúsculas ni espacios) registra la asistencia presencial del día', primera);
  const repetida = await registrarAsistencia({ codigo: codigoDe('jueves', 'presencial'), correo: 'asis.uno@example.org', ahora: EN_SESION });
  comprobar(repetida.ok && repetida.estado === 'ya_registrada', 'asistencia: escanear dos veces no duplica', repetida);
  const porLaOtraVia = await registrarAsistencia({ codigo: codigoDe('jueves', 'en_linea'), correo: 'asis.uno@example.org', ahora: EN_SESION });
  comprobar(porLaOtraVia.ok && porLaOtraVia.estado === 'ya_registrada' && porLaOtraVia.via === 'presencial',
    'asistencia: la misma persona por la otra vía no cuenta dos veces y se le dice por cuál quedó', porLaOtraVia);
  const enOtraSesion = await registrarAsistencia({ codigo: codigoDe('viernes', 'en_linea'), correo: 'asis.dos@example.org', ahora: EN_VIERNES });
  comprobar(enOtraSesion.ok && enOtraSesion.via === 'en_linea', 'asistencia: la vía sale del código, no de lo que diga la persona', enOtraSesion);

  const primerPaso = await registrarAsistencia({ codigo: codigoDe('jueves', 'presencial'), correo: 'asis.mal.escrito@example.org', ahora: EN_SESION });
  comprobar(!primerPaso.ok && primerPaso.motivo === 'no_encontrado', 'asistencia: un correo desconocido pide nombre y correo, sin guardar nada todavía', primerPaso);
  comprobar((await resumenPorSesion())['jueves']?.total === 1, 'asistencia: y el primer paso no deja nada guardado');

  const porNombre = await registrarAsistencia({ codigo: codigoDe('jueves', 'presencial'), correo: 'asis.mal.escrito@example.org', nombre: 'robles iturbide, maria fernanda', ahora: EN_SESION });
  comprobar(porNombre.ok && porNombre.estado === 'ya_registrada' && !porNombre.sinRegistro,
    'asistencia: en el segundo paso, un nombre que coincide con un solo registro la identifica (aquí ya tenía su asistencia)', porNombre);

  const sinRegistro = await registrarAsistencia({ codigo: codigoDe('jueves', 'presencial'), correo: 'quien.sea@example.org', nombre: 'Pedro Ramírez', ahora: EN_SESION });
  comprobar(sinRegistro.ok && sinRegistro.estado === 'registrada' && sinRegistro.sinRegistro && sinRegistro.nombre === 'Pedro',
    'asistencia: si ni el correo ni el nombre aparecen, se guarda «sin registro»', sinRegistro);
  const sinRegistroOtraVez = await registrarAsistencia({ codigo: codigoDe('jueves', 'presencial'), correo: 'QUIEN.SEA@example.org', nombre: 'Pedro Ramírez', ahora: EN_SESION });
  comprobar(sinRegistroOtraVez.ok && sinRegistroOtraVez.estado === 'ya_registrada', 'asistencia: la asistencia «sin registro» tampoco se duplica', sinRegistroOtraVez);

  const cancelada = await registrarAsistencia({ codigo: codigoDe('jueves', 'presencial'), correo: 'asis.tres@example.org', nombre: 'Ana Cancelada', ahora: EN_SESION });
  comprobar(cancelada.ok && cancelada.sinRegistro, 'asistencia: un registro cancelado no se reconoce: queda «sin registro»', cancelada);

  const malCorreo = await registrarAsistencia({ codigo: codigoDe('jueves', 'presencial'), correo: 'no-es-un-correo', ahora: EN_SESION });
  comprobar(!malCorreo.ok && malCorreo.motivo === 'datos_invalidos', 'asistencia: un correo que no lo es se rechaza', malCorreo);
  const malCodigo = await registrarAsistencia({ codigo: 'zzzzzzzzzz', correo: 'asis.uno@example.org', ahora: EN_SESION });
  comprobar(!malCodigo.ok && malCodigo.motivo === 'codigo_invalido', 'asistencia: un código que no existe se rechaza', malCodigo);

  const resumen = await resumenPorSesion();
  comprobar(
    resumen['jueves']?.presencial === 3 && resumen['jueves'].sinRegistro === 2 && resumen['viernes']?.en_linea === 1,
    'asistencia: el resumen cuenta por sesión, por vía y «sin registro»', resumen);

  const asistentes = await asistentesDeSesion('jueves');
  comprobar(
    asistentes[0]?.nombre === 'María Fernanda Robles Iturbide' && asistentes[0].identificado_por === 'correo' && asistentes[0].folio !== null,
    'asistencia: la lista de una sesión trae el nombre del registro, no lo escrito', asistentes[0]);

  const suelta = asistentes.find((x) => x.registro_id === null && x.correo === 'quien.sea@example.org');
  const conciliada = await conciliarAsistencia(suelta!.id, idsAsis['asis.dos@example.org']);
  comprobar(conciliada.ok && conciliada.resultado === 'ligada', 'asistencia: el comité puede ligar una «sin registro» a su registro', conciliada);
  const despuesDeConciliar = (await asistentesDeSesion('jueves')).find((x) => x.id === suelta!.id);
  comprobar(despuesDeConciliar?.registro_id === idsAsis['asis.dos@example.org'] && despuesDeConciliar.identificado_por === 'conciliada' && despuesDeConciliar.nombre === 'Luis Pérez Gómez',
    'asistencia: y queda a nombre del registro', despuesDeConciliar);

  // Si esa persona ya tenía asistencia en la misma sesión, la fila suelta sobra: se descarta en vez de contar dos veces.
  await registrarAsistencia({ codigo: codigoDe('viernes', 'en_linea'), correo: 'otro@example.org', nombre: 'Otra Persona', ahora: EN_VIERNES });
  const otraSuelta = (await asistentesDeSesion('viernes')).find((x) => x.registro_id === null);
  const duplicada = await conciliarAsistencia(otraSuelta!.id, idsAsis['asis.dos@example.org']);
  comprobar(duplicada.ok && duplicada.resultado === 'duplicada_descartada', 'asistencia: ligar a quien ya tenía asistencia en la sesión descarta la duplicada', duplicada);
  comprobar((await asistentesDeSesion('viernes')).length === 1, 'asistencia: y no cuenta dos veces');
  const aCancelado = await conciliarAsistencia(suelta!.id, idsAsis['asis.tres@example.org']);
  comprobar(!aCancelado.ok, 'asistencia: no se liga a un registro cancelado', aCancelado);

  const encontrados = await buscarRegistros('asis.uno');
  comprobar(encontrados.length === 1 && encontrados[0].nombre === 'María Fernanda Robles Iturbide', 'asistencia: se busca el registro por correo para conciliar', encontrados);
  comprobar((await buscarRegistros('robles iturbide')).length === 1 && (await buscarRegistros('a')).length === 0, 'asistencia: o por nombre; con una letra no busca');

  const todas = await todasLasAsistencias();
  comprobar(todas.length >= 4 && todas.every((x, i) => i === 0 || todas[i - 1].creada_en <= x.creada_en), 'asistencia: todas, en orden de llegada');

  // Dar de baja un registro no borra la asistencia: la fila sigue diciendo quién fue.
  await consultar('delete from registros where id = $1', [idsAsis['asis.dos@example.org']]);
  const sobrevive = (await asistentesDeSesion('jueves')).find((x) => x.id === suelta!.id);
  comprobar(sobrevive !== undefined && sobrevive.registro_id === null && sobrevive.nombre === 'Luis Pérez Gómez',
    'asistencia: la baja de un registro no borra su asistencia', sobrevive);
  comprobar((await eliminarAsistencia(suelta!.id)) === true && (await eliminarAsistencia(suelta!.id)) === false, 'asistencia: quitar un escaneo que no correspondía');

  // La sesión de prueba y la búsqueda del correo (el nombre que se rellena solo)
  const { activarPrueba, estadoDePrueba, borrarPrueba, buscarPersonaPorCorreo } = await import('../../src/lib/servidor/asistencia');
  const BASE = 'https://sitio.example.org';
  comprobar(!(await estadoDePrueba(BASE)).activa, 'prueba: empieza apagada');
  const prueba = await activarPrueba(BASE);
  comprobar(
    prueba.activa && /^https:\/\/sitio\.example\.org\/a\/[a-z0-9]{10}$/.test(prueba.presencial ?? '') &&
    /^https:\/\/sitio\.example\.org\/a\/[a-z0-9]{10}$/.test(prueba.en_linea ?? '') && prueba.qr?.startsWith('<svg') === true,
    'prueba: al activarla hay QR y dos enlaces', prueba);
  comprobar(JSON.stringify((await activarPrueba(BASE)).presencial) === JSON.stringify(prueba.presencial), 'prueba: activarla otra vez no cambia los códigos');
  comprobar(!('prueba' in (await asegurarCodigos())), 'prueba: sus códigos no se mezclan con los de la agenda');
  comprobar(!('prueba' in (await leerCodigos())), 'códigos: quien sólo mira tampoco ve los de la prueba');

  const codigoDePrueba = prueba.presencial!.split('/a/')[1];
  const DESPUES = new Date('2030-01-01T00:00:00Z'); // una fecha en la que ninguna sesión real está abierta
  const busca = (correo: string, codigo = codigoDePrueba, ahora: Date = DESPUES) => buscarPersonaPorCorreo({ codigo, correo, ahora });

  const encontrada = await busca(' ASIS.UNO@example.org ');
  comprobar(encontrada.ok && encontrada.encontrado && encontrada.nombre === 'María Fernanda Robles Iturbide',
    'búsqueda: el correo de un registro devuelve su nombre completo (sin importar mayúsculas ni espacios)', encontrada);
  const desconocida = await busca('nadie@example.org');
  comprobar(desconocida.ok && !desconocida.encontrado, 'búsqueda: un correo desconocido no devuelve nada', desconocida);
  const canceladaB = await busca('asis.tres@example.org');
  comprobar(canceladaB.ok && !canceladaB.encontrado, 'búsqueda: un registro cancelado no se reconoce', canceladaB);
  const malCorreoB = await busca('no-es-un-correo');
  comprobar(!malCorreoB.ok && malCorreoB.motivo === 'datos_invalidos', 'búsqueda: un correo que no lo es se rechaza', malCorreoB);
  const malCodigoB = await busca('asis.uno@example.org', 'zzzzzzzzzz');
  comprobar(!malCodigoB.ok && malCodigoB.motivo === 'codigo_invalido', 'búsqueda: con un código que no existe no contesta nada', malCodigoB);
  const fueraB = await busca('asis.uno@example.org', codigos['miercoles'].presencial, DESPUES);
  comprobar(!fueraB.ok && fueraB.motivo === 'fuera_de_horario', 'búsqueda: fuera del horario de la sesión tampoco contesta (no sirve para averiguar quién está registrado)', fueraB);
  const antes = (await consultar('select 1 from asistencias')).length;
  await busca('asis.uno@example.org');
  comprobar((await consultar('select 1 from asistencias')).length === antes, 'búsqueda: no escribe nada');

  const deLaPrueba = await registrarAsistencia({ codigo: codigoDePrueba, correo: 'asis.uno@example.org', ahora: DESPUES });
  comprobar(deLaPrueba.ok && deLaPrueba.estado === 'registrada' && deLaPrueba.sesion === 'prueba', 'prueba: se registra a cualquier hora', deLaPrueba);
  const unaDeLaPrueba = (await resumenPorSesion()).prueba;
  comprobar(unaDeLaPrueba?.total === 1 && (await estadoDePrueba(BASE)).total === 1, 'prueba: aparece en el resumen y en su contador', unaDeLaPrueba);

  const delCongreso = (await consultar('select 1 from asistencias where sesion <> $1', ['prueba'])).length;
  const borradas = await borrarPrueba();
  comprobar(borradas.asistencias === 1 && borradas.codigos === 2, 'prueba: borrarla quita sus asistencias y sus dos códigos', borradas);
  comprobar((await consultar('select 1 from asistencias where sesion <> $1', ['prueba'])).length === delCongreso, 'prueba: y no toca ninguna asistencia del Congreso');
  comprobar((await resolverCodigo(codigoDePrueba)) === null && !(await estadoDePrueba(BASE)).activa, 'prueba: su QR deja de funcionar');

  await consultar('delete from asistencias');
  await consultar('delete from asistencia_codigos');
  await consultar(`delete from registros where correo like 'asis.%@example.org'`);
  ok('limpieza de la asistencia');

  // 13. Comunicado automático tras el correo de confirmación
  const {
    comunicadoAutomaticoActivo, enviarComunicadoTrasConfirmacion, estadoDelComunicadoAutomatico, fijarComunicadoAutomatico,
  } = await import('../../src/lib/servidor/comunicado-automatico');

  const configuracionDePrueba = {
    correo_contacto: 'congreso@ciess.org', fecha_limite_registro: '', url_agenda: 'https://ejemplo.org/agenda',
    url_agenda_pt: '', url_agenda_en: '', programa_publicado: true, url_sesion_zoom: '',
  } as never;
  const mandadosAuto: { correo: string; clave: string; idioma: string }[] = [];
  let respuestaDelEnvio: { enviado: boolean; error?: string } | 'revienta' = { enviado: true };
  const enviarDePrueba = (async (datos: { clave: string; registro: Record<string, unknown> }) => {
    await new Promise((seguir) => setTimeout(seguir, 20)); // lo que tarda Resend: deja que se crucen dos llamadas a la vez
    if (respuestaDelEnvio === 'revienta') throw new Error('Se cayó la conexión');
    if (respuestaDelEnvio.enviado) mandadosAuto.push({ correo: String(datos.registro.correo), clave: datos.clave, idioma: String(datos.registro.idioma) });
    return respuestaDelEnvio;
  }) as never;

  const altasAuto: [string, string, string][] = [
    ['auto.uno@example.org', 'confirmado', 'es'],
    ['auto.dos@example.org', 'en_proceso', 'en'],
    ['auto.espera@example.org', 'lista_espera', 'es'],
    ['auto.cancelado@example.org', 'cancelado', 'es'],
    ['auto.ya@example.org', 'confirmado', 'pt'],
    ['auto.falla@example.org', 'confirmado', 'es'],
    ['auto.carrera@example.org', 'confirmado', 'es'],
  ];
  for (const [correo, estado, idioma] of altasAuto) {
    const a = armarInsercion({
      perfil: 'publico_general', grupo: 'externo', modalidad: 'presencial', idioma, nombres: 'Auto', apellidos: correo.split('@')[0],
      correo, institucion: 'CIESS', pais_residencia: 'México', estado, consentimiento_datos: true,
    });
    await consultar(`insert into registros (${a.columnas}) values (${a.marcadores})`, a.valores);
  }
  const registroDe = async (correo: string) => (await unaFila<Record<string, unknown>>('select * from registros where correo = $1', [correo]))!;
  const enviarAuto = async (correo: string) => enviarComunicadoTrasConfirmacion(await registroDe(correo), configuracionDePrueba, { enviar: enviarDePrueba });

  comprobar(await comunicadoAutomaticoActivo(), 'automático: viene encendido (así se pidió)');

  comprobar((await enviarAuto('auto.uno@example.org')) === 'enviado' && mandadosAuto.length === 1 && mandadosAuto[0].clave === 'comunicado',
    'automático: a un registro nuevo se le manda el comunicado', mandadosAuto);
  const cuenta = await unaFila<{ estado: string; audiencia: string; total: number }>(
    `select e.estado, c.audiencia, c.total from envios_campana e join campanas_correo c on c.id = e.campana_id where e.correo = 'auto.uno@example.org'`);
  comprobar(cuenta?.estado === 'enviado' && cuenta.audiencia === 'automatico' && Number(cuenta.total) === 1,
    'automático: queda asentado en la campaña automática', cuenta);
  comprobar((await enviarAuto('auto.uno@example.org')) === 'omitido' && mandadosAuto.length === 1,
    'automático: a la misma persona no se lo manda dos veces (un reintento de acuses, un doble envío)');

  comprobar((await enviarAuto('auto.dos@example.org')) === 'enviado' && mandadosAuto[1].idioma === 'en',
    'automático: sale en el idioma del registro');
  comprobar((await enviarAuto('auto.espera@example.org')) === 'omitido' && (await enviarAuto('auto.cancelado@example.org')) === 'omitido' && mandadosAuto.length === 2,
    'automático: no a quien está en lista de espera ni a quien canceló');

  // Quien ya lo recibió por un envío masivo no lo recibe otra vez.
  const [previa] = await consultar<{ id: string }>(
    `insert into campanas_correo (clave, audiencia, plantilla, creada_por, total) values ('comunicado', 'lista', '{}'::jsonb, $1, 1) returning id`, [usuario!.id]);
  await consultar(
    `insert into envios_campana (campana_id, correo, registro_id, idioma, estado, enviado_en) values ($1, 'auto.ya@example.org', null, 'pt', 'enviado', now())`, [previa.id]);
  comprobar((await enviarAuto('auto.ya@example.org')) === 'omitido' && mandadosAuto.length === 2,
    'automático: no a quien ya lo recibió por un envío masivo');

  // Interruptor
  await fijarComunicadoAutomatico(false, usuario!.id);
  comprobar(!(await comunicadoAutomaticoActivo()) && (await enviarAuto('auto.carrera@example.org')) === 'omitido' && mandadosAuto.length === 2,
    'automático: apagado, no manda nada');
  await fijarComunicadoAutomatico(true, usuario!.id);
  comprobar(await comunicadoAutomaticoActivo(), 'automático: se vuelve a encender');

  // Dos peticiones a la vez para la misma persona: sale una sola vez.
  const carrera = await Promise.all([enviarAuto('auto.carrera@example.org'), enviarAuto('auto.carrera@example.org')]);
  comprobar(carrera.filter((r) => r === 'enviado').length === 1 && mandadosAuto.filter((m) => m.correo === 'auto.carrera@example.org').length === 1,
    'automático: dos peticiones a la vez no lo mandan dos veces', carrera);

  // Un fallo no se pierde: queda como error, y se puede reintentar.
  respuestaDelEnvio = { enviado: false, error: 'rate limit' };
  comprobar((await enviarAuto('auto.falla@example.org')) === 'error', 'automático: si Resend lo rechaza, se dice que falló');
  const errorAsentado = await unaFila<{ estado: string; error: string }>(`select estado, error from envios_campana where correo = 'auto.falla@example.org'`);
  comprobar(errorAsentado?.estado === 'error' && errorAsentado.error === 'rate limit', 'automático: y queda asentado con su causa', errorAsentado);
  respuestaDelEnvio = 'revienta';
  comprobar((await enviarAuto('auto.falla@example.org')) === 'error', 'automático: si la conexión se cae, tampoco revienta el alta');
  const aQuienFalta = await calcularAudiencia({ clave: 'comunicado', audiencia: 'todos' });
  comprobar(aQuienFalta.ok && correosDe(aQuienFalta).includes('auto.falla@example.org'),
    'automático: quien no lo recibió por un error entra en «los que aún no lo han recibido» del envío masivo');
  respuestaDelEnvio = { enviado: true };
  comprobar((await enviarAuto('auto.falla@example.org')) === 'enviado', 'automático: reintentado, sale');

  // Y el envío masivo ya no repite a quien lo recibió solo.
  const despuesAuto = await calcularAudiencia({ clave: 'comunicado', audiencia: 'todos' });
  comprobar(
    despuesAuto.ok && !correosDe(despuesAuto).some((c) => c.startsWith('auto.')) &&
    despuesAuto.excluidos.yaRecibieron >= 5,
    'automático: el envío masivo «a quienes aún no lo han recibido» no repite a quien lo recibió solo', despuesAuto.ok && despuesAuto.excluidos);

  const estadoAuto = await estadoDelComunicadoAutomatico();
  comprobar(estadoAuto.activo && estadoAuto.enviados === 4 && estadoAuto.errores === 0, 'automático: el panel cuenta lo enviado', estadoAuto);
  const historialAuto = (await listarCampanas('comunicado')).find((h) => h.audiencia === 'automatico');
  comprobar(historialAuto?.progreso.enviados === 4 && !historialAuto.faltaPorEnviar, 'automático: aparece en el historial, sin nada pendiente', historialAuto);

  // La campaña automática no estorba a un envío masivo.
  const nuevaMasiva = await crearCampana({ clave: 'comunicado', audiencia: 'lista', lista: 'alguien.mas@example.org', confirmacion: '1', usuarioId: usuario!.id });
  comprobar(nuevaMasiva.ok, 'automático: no impide crear un envío masivo', nuevaMasiva);
  // Y el esquema aguanta repetirse: la campaña automática sigue siendo una sola.
  comprobar(
    Number((await unaFila<{ n: string }>(`select count(*)::text as n from campanas_correo where clave = 'comunicado' and audiencia = 'automatico'`))!.n) === 1,
    'automático: sólo hay una campaña automática');

  await consultar(`delete from campanas_correo where clave = 'comunicado' and (audiencia = 'automatico' or creada_por = $1)`, [usuario!.id]);
  await consultar(`delete from registros where correo like 'auto.%@example.org'`);
  ok('limpieza del comunicado automático');

  // 14. Aforo presencial: la migración lo pone en 100 una vez y después manda el panel
  const migracionSql = readFileSync('basedatos/actualizar-convocatoria.sql', 'utf8');
  const cupo = async () => Number((await unaFila<{ valor: number }>(
    `select valor from configuracion where clave = 'cupos_presenciales'`))!.valor);
  await consultar(`delete from configuracion where clave = 'migracion_cupo_presencial_100'`);
  await consultar(`update configuracion set valor = '120'::jsonb where clave = 'cupos_presenciales'`);
  await consultar(migracionSql);
  comprobar((await cupo()) === 100, 'aforo: la migración lo deja en 100', await cupo());
  comprobar(
    Boolean(await unaFila(`select 1 from configuracion where clave = 'migracion_cupo_presencial_100'`)),
    'aforo: deja su marca de migración aplicada');
  await consultar(`update configuracion set valor = '130'::jsonb where clave = 'cupos_presenciales'`);
  await consultar(migracionSql);
  comprobar((await cupo()) === 130, 'aforo: un segundo despliegue no pisa lo que el panel cambió', await cupo());

  // 14b. El registro se cierra una vez al desplegar (el evento terminó) y después manda el panel
  const registroAbierto = async () => (await unaFila<{ valor: boolean }>(
    `select valor from configuracion where clave = 'registro_abierto'`))!.valor;
  await consultar(`delete from configuracion where clave = 'migracion_registro_cerrado_fin_congreso'`);
  await consultar(`update configuracion set valor = 'true'::jsonb where clave = 'registro_abierto'`);
  await consultar(migracionSql);
  comprobar((await registroAbierto()) === false, 'cierre: la migración deja el registro cerrado', await registroAbierto());
  comprobar(
    Boolean(await unaFila(`select 1 from configuracion where clave = 'migracion_registro_cerrado_fin_congreso'`)),
    'cierre: deja su marca de migración aplicada');
  await consultar(`update configuracion set valor = 'true'::jsonb where clave = 'registro_abierto'`);
  await consultar(migracionSql);
  comprobar((await registroAbierto()) === true, 'cierre: un segundo despliegue no cierra lo que el panel volvió a abrir', await registroAbierto());

  // 15. La pantalla de recepción (/qr): lo que se arma, el aviso del comité y la sala del jueves
  const publicadoAntes = (await unaFila<{ valor: boolean }>(`select valor from configuracion where clave = 'programa_publicado'`))!.valor;
  comprobar(
    Boolean(await unaFila(`select 1 from configuracion where clave = 'aviso_recepcion'`)),
    'recepción: el aviso tiene su fila sembrada en la configuración');
  await consultar(`update configuracion set valor = '{"es":"","en":"","pt":""}'::jsonb where clave = 'aviso_recepcion'`);
  await consultar(`update configuracion set valor = 'true'::jsonb where clave = 'programa_publicado'`);

  const publicada = await armarDatosDePantalla();
  comprobar(publicada !== null, 'recepción: se arma la pantalla', publicada);
  comprobar(Boolean(publicada?.qrAgenda?.startsWith('<svg')), 'recepción: con el programa publicado hay QR de la agenda');
  comprobar(Boolean(publicada?.asistencia?.qr?.startsWith('<svg')), 'recepción: hay QR de asistencia del día (crea los códigos si faltan)');
  comprobar((publicada?.programa?.bloques.length ?? 0) > 5, 'recepción: con el programa publicado lleva la agenda del día');
  comprobar(publicada?.aviso === null, 'recepción: sin aviso guardado no hay aviso en la pantalla', publicada?.aviso);
  comprobar(
    publicada !== null && Date.parse(publicada.ahora) > Date.now() - 60_000 && publicada.urlVideo !== '',
    'recepción: trae la hora del servidor y el video');
  comprobar((await armarDatosDePantalla({ ligero: true }))?.urlVideo === '', 'recepción: en modo ligero no lleva video');

  await consultar(`update configuracion set valor = '{"es":"La mesa 4 inicia tarde.","en":"","pt":""}'::jsonb where clave = 'aviso_recepcion'`);
  const conAviso = await armarDatosDePantalla();
  comprobar(
    conAviso?.aviso?.es === 'La mesa 4 inicia tarde.' && conAviso.aviso.en === conAviso.aviso.es && conAviso.aviso.pt === conAviso.aviso.es,
    'recepción: un aviso sólo en español se enseña en los tres idiomas', conAviso?.aviso);
  comprobar((await leerAvisoGuardado()).en === '', 'recepción: lo guardado conserva los idiomas vacíos, que es lo que edita el panel');

  await consultar(`update configuracion set valor = 'false'::jsonb where clave = 'programa_publicado'`);
  const sinPublicar = await armarDatosDePantalla();
  comprobar(
    sinPublicar?.qrAgenda === null && sinPublicar.programa === null && sinPublicar.asistencia !== null,
    'recepción: sin programa publicado no hay QR de la agenda ni «en vivo», pero el QR de asistencia sigue', sinPublicar);

  // Se deja todo como estaba.
  await consultar(`update configuracion set valor = '${JSON.stringify(publicadoAntes)}'::jsonb where clave = 'programa_publicado'`);
  await consultar(`update configuracion set valor = '{"es":"","en":"","pt":""}'::jsonb where clave = 'aviso_recepcion'`);
  await consultar(`delete from asistencia_codigos`);
  ok('limpieza de la pantalla de recepción');

  // 16. Asistencia a mano desde el panel, para quien no tiene teléfono
  const { registrarAsistenciaManual, ultimasManuales } = await import('../../src/lib/servidor/asistencia');
  const altasManual: [string, string, string, string][] = [
    ['manual.uno@example.org', 'Rosario', 'Vega Prieto', 'confirmado'],
    ['manual.dos@example.org', 'Teodoro', 'Salas Ibarra', 'confirmado'],
    ['manual.tres@example.org', 'Ximena', 'Lara Duarte', 'en_proceso'],
    ['manual.homonimo.a@example.org', 'Juan', 'Pérez Soto', 'confirmado'],
    ['manual.homonimo.b@example.org', 'Juan', 'Pérez Soto', 'confirmado'],
    ['manual.cancelado@example.org', 'Carla', 'Baja Definitiva', 'cancelado'],
  ];
  const idsManual: Record<string, string> = {};
  for (const [correo, nombres, apellidos, estado] of altasManual) {
    const a = armarInsercion({
      perfil: 'publico_general', grupo: 'externo', modalidad: 'presencial', idioma: 'es', nombres, apellidos,
      correo, institucion: 'CIESS', pais_residencia: 'México', estado, consentimiento_datos: true,
    });
    idsManual[correo] = (await unaFila<{ id: string }>(`insert into registros (${a.columnas}) values (${a.marcadores}) returning id`, a.valores))!.id;
  }
  const filaDe = (sesion: string, correo: string) => unaFila<{
    via: string; origen: string; identificado_por: string; registrada_por: string | null; registro_id: string | null;
    capturado_nombre: string | null; capturado_correo: string | null; nombre: string;
  }>(`select via, origen, identificado_por, registrada_por, registro_id, capturado_nombre, capturado_correo, nombre
        from asistencias where sesion = $1 and correo = $2`, [sesion, correo]);
  const cuantas = async () => Number((await unaFila<{ n: string }>('select count(*)::text as n from asistencias'))!.n);

  const base0 = await cuantas();
  const m1 = await registrarAsistenciaManual({ sesion: 'jueves', via: 'presencial', correo: '  MANUAL.UNO@Example.org ', usuarioId: usuario!.id });
  comprobar(
    m1.ok && m1.estado === 'registrada' && !m1.sinRegistro && m1.nombre === 'Rosario Vega Prieto' && m1.correo === 'manual.uno@example.org',
    'manual: el correo de un registro (sin importar mayúsculas ni espacios) anota su asistencia, con su nombre completo', m1);
  const f1 = await filaDe('jueves', 'manual.uno@example.org');
  comprobar(
    f1?.origen === 'manual' && f1.registrada_por === usuario!.id && f1.identificado_por === 'correo' && f1.via === 'presencial' && f1.registro_id === idsManual['manual.uno@example.org'],
    'manual: queda dicho que fue a mano, quién la anotó y que se la identificó por su correo', f1);

  const m1b = await registrarAsistenciaManual({ sesion: 'jueves', via: 'presencial', correo: 'manual.uno@example.org', usuarioId: usuario!.id });
  comprobar(m1b.ok && m1b.estado === 'ya_registrada' && m1b.id === (m1.ok ? m1.id : null) && (await cuantas()) === base0 + 1,
    'manual: anotar dos veces a la misma persona el mismo día no duplica', m1b);
  const m1c = await registrarAsistenciaManual({ sesion: 'jueves', via: 'en_linea', correo: 'manual.uno@example.org', usuarioId: usuario!.id });
  comprobar(m1c.ok && m1c.estado === 'ya_registrada' && m1c.via === 'presencial', 'manual: por la otra modalidad tampoco cuenta dos veces, y dice por cuál quedó', m1c);
  const m1d = await registrarAsistenciaManual({ sesion: 'viernes', via: 'presencial', correo: 'manual.uno@example.org', usuarioId: usuario!.id });
  comprobar(m1d.ok && m1d.estado === 'registrada', 'manual: otro día sí es otra asistencia', m1d);

  // Se anota aunque el horario del código ya haya cerrado: quien la anota tiene a la persona enfrente.
  const m2 = await registrarAsistenciaManual({ sesion: 'miercoles', via: 'en_linea', correo: 'manual.dos@example.org', usuarioId: usuario!.id });
  comprobar(m2.ok && m2.estado === 'registrada' && m2.via === 'en_linea', 'manual: no depende del horario del código, y respeta la modalidad pedida', m2);

  // Lo que ya escaneó la persona no se pisa.
  const { asegurarCodigos: crearCodigos } = await import('../../src/lib/servidor/asistencia');
  const codigosManual = await crearCodigos();
  await registrarAsistencia({ codigo: codigosManual['jueves'].en_linea, correo: 'manual.dos@example.org', ahora: EN_SESION });
  const m2b = await registrarAsistenciaManual({ sesion: 'jueves', via: 'presencial', correo: 'manual.dos@example.org', usuarioId: usuario!.id });
  const f2 = await filaDe('jueves', 'manual.dos@example.org');
  comprobar(
    m2b.ok && m2b.estado === 'ya_registrada' && m2b.via === 'en_linea' && f2?.origen === 'qr' && f2.registrada_por === null,
    'manual: si la persona ya había escaneado ese día, no se duplica ni se cambia cómo quedó', m2b);
  const f2qr = await filaDe('jueves', 'manual.dos@example.org');
  comprobar(f2qr?.origen === 'qr', 'manual: y el escaneo normal sigue quedando como «qr», sin quién');

  // Elegido entre los registros que se buscaron
  const m3 = await registrarAsistenciaManual({ sesion: 'jueves', via: 'presencial', registroId: idsManual['manual.tres@example.org'], usuarioId: usuario!.id });
  const f3 = await filaDe('jueves', 'manual.tres@example.org');
  comprobar(m3.ok && m3.estado === 'registrada' && f3?.identificado_por === 'conciliada' && f3.origen === 'manual',
    'manual: un registro elegido a mano queda como «conciliada» y «manual»', f3);
  const m3b = await registrarAsistenciaManual({ sesion: 'viernes', via: 'presencial', registroId: idsManual['manual.tres@example.org'], correo: 'MANUAL.TRES@example.org', usuarioId: usuario!.id });
  const f3b = await filaDe('viernes', 'manual.tres@example.org');
  comprobar(m3b.ok && f3b?.identificado_por === 'correo' && f3b.capturado_correo === 'manual.tres@example.org',
    'manual: si además se tecleó su correo y coincide, se identifica por el correo y se guarda lo tecleado', f3b);
  const mMalo = await registrarAsistenciaManual({ sesion: 'viernes', via: 'presencial', registroId: idsManual['manual.dos@example.org'], correo: 'esto no es un correo', usuarioId: usuario!.id });
  const fMalo = await filaDe('viernes', 'manual.dos@example.org');
  comprobar(mMalo.ok && fMalo?.capturado_correo === null, 'manual: un correo mal escrito junto a un registro elegido se ignora', fMalo);

  // El correo no aparece
  const antesDeNoEncontrado = await cuantas();
  const m4 = await registrarAsistenciaManual({ sesion: 'jueves', via: 'presencial', correo: 'nadie.asi@example.org', usuarioId: usuario!.id });
  comprobar(!m4.ok && m4.motivo === 'no_encontrado' && (await cuantas()) === antesDeNoEncontrado,
    'manual: un correo que no está en los registros pide el nombre y no guarda nada todavía', m4);
  const m5 = await registrarAsistenciaManual({ sesion: 'jueves', via: 'presencial', correo: 'Nadie.Asi@example.org', nombre: '  Pedro   Camacho Rueda ', usuarioId: usuario!.id });
  const f5 = await filaDe('jueves', 'nadie.asi@example.org');
  comprobar(
    m5.ok && m5.estado === 'registrada' && m5.sinRegistro && m5.nombre === 'Pedro Camacho Rueda' &&
    f5?.registro_id === null && f5.identificado_por === 'ninguno' && f5.origen === 'manual' && f5.capturado_nombre === 'Pedro Camacho Rueda',
    'manual: con el nombre, queda «sin registro» y lo escrito, para que el comité la concilie', f5);
  const m5b = await registrarAsistenciaManual({ sesion: 'jueves', via: 'presencial', correo: 'nadie.asi@example.org', nombre: 'Pedro Camacho Rueda', usuarioId: usuario!.id });
  comprobar(m5b.ok && m5b.estado === 'ya_registrada', 'manual: la «sin registro» tampoco se duplica', m5b);
  const m6 = await registrarAsistenciaManual({ sesion: 'jueves', via: 'presencial', correo: 'otro.correo@example.org', nombre: 'Teodoro Salas Ibarra', usuarioId: usuario!.id });
  comprobar(m6.ok && m6.estado === 'ya_registrada' && !m6.sinRegistro,
    'manual: si el correo no aparece pero el nombre es de un solo registro, se la identifica por el nombre (aquí ya tenía su asistencia)', m6);
  const m7 = await registrarAsistenciaManual({ sesion: 'miercoles', via: 'presencial', correo: 'otro.mas@example.org', nombre: 'Ximena Lara Duarte', usuarioId: usuario!.id });
  const f7 = await filaDe('miercoles', 'manual.tres@example.org');
  comprobar(m7.ok && m7.estado === 'registrada' && !m7.sinRegistro && f7?.identificado_por === 'nombre', 'manual: un nombre que coincide con un solo registro la identifica', m7);
  const m8 = await registrarAsistenciaManual({ sesion: 'miercoles', via: 'presencial', correo: 'homonimo@example.org', nombre: 'Juan Pérez Soto', usuarioId: usuario!.id });
  comprobar(m8.ok && m8.sinRegistro, 'manual: dos registros con el mismo nombre no se pueden distinguir: queda «sin registro», no se le atribuye a uno al azar', m8);

  // Lo que se rechaza
  const baseRechazos = await cuantas();
  const rechazos = await Promise.all([
    registrarAsistenciaManual({ sesion: 'prueba', via: 'presencial', correo: 'manual.uno@example.org', usuarioId: usuario!.id }),
    registrarAsistenciaManual({ sesion: 'mesa-4', via: 'presencial', correo: 'manual.uno@example.org', usuarioId: usuario!.id }),
    registrarAsistenciaManual({ sesion: 'jueves', via: 'presencial', correo: 'no-es-un-correo', usuarioId: usuario!.id }),
    registrarAsistenciaManual({ sesion: 'jueves', via: 'presencial', correo: '', usuarioId: usuario!.id }),
    registrarAsistenciaManual({ sesion: 'jueves', via: 'presencial', registroId: '00000000-0000-4000-8000-000000000000', usuarioId: usuario!.id }),
    registrarAsistenciaManual({ sesion: 'jueves', via: 'presencial', registroId: idsManual['manual.cancelado@example.org'], usuarioId: usuario!.id }),
    registrarAsistenciaManual({ sesion: 'jueves', via: 'presencial', correo: 'manual.cancelado@example.org', usuarioId: usuario!.id }),
  ]);
  comprobar(
    rechazos.map((r) => (r.ok ? 'ok' : r.motivo)).join(',') === 'sesion_invalida,sesion_invalida,datos_invalidos,datos_invalidos,registro_invalido,registro_invalido,no_encontrado' &&
    (await cuantas()) === baseRechazos,
    'manual: no se anota en la sesión de prueba ni en una que no existe, ni con un correo inválido o un registro inexistente o cancelado', rechazos);

  // Lo que ve el panel
  const ultimas = await ultimasManuales();
  comprobar(
    ultimas.length >= 8 && ultimas.every((x) => x.registrada_por === 'Prueba') &&
    ultimas.every((x, i) => i === 0 || ultimas[i - 1].creada_en >= x.creada_en) &&
    !ultimas.some((x) => x.correo === 'manual.dos@example.org' && x.sesion === 'jueves'),
    'manual: la lista de las últimas anotadas a mano trae quién las anotó, las más recientes primero, y no mezcla los escaneos', ultimas.length);
  comprobar((await ultimasManuales(3)).length === 3, 'manual: la lista se puede acotar');
  const delJueves = await asistentesDeSesion('jueves');
  comprobar(
    delJueves.find((x) => x.correo === 'manual.uno@example.org')?.origen === 'manual' && delJueves.find((x) => x.correo === 'manual.dos@example.org')?.origen === 'qr',
    'manual: la lista de asistentes de un día dice de cuáles es a mano');
  const resumenManual = await resumenPorSesion();
  comprobar((resumenManual['miercoles']?.en_linea ?? 0) >= 1 && (resumenManual['jueves']?.presencial ?? 0) >= 3,
    'manual: cuentan igual que un escaneo en el resumen de cada día', resumenManual);

  // Deshacer una equivocación
  const idUltima = ultimas[0].id;
  comprobar((await eliminarAsistencia(idUltima)) === true && !(await ultimasManuales(50)).some((x) => x.id === idUltima),
    'manual: una anotada por equivocación se quita');

  await consultar(`delete from asistencias where origen = 'manual' or correo like 'manual.%'`);
  await consultar(`delete from registros where correo like 'manual.%@example.org'`);
  await consultar(`delete from asistencia_codigos`);
  ok('limpieza de la asistencia a mano');

  // 17. La pestaña «Asistencia por persona» de la hoja: lo que sale de la base, con «Ponencia» tras el correo y la casilla «Con registro»
  const { COLUMNA_CON_REGISTRO, COLUMNA_DE_PONENCIA, ENCABEZADOS_PERSONAS, filasDePersonas } = await import('../../src/lib/asistencia');
  // Las columnas por su título, no por su número: si se reordenan, la prueba sigue diciendo lo mismo.
  const COLUMNA_DEL_PERFIL = ENCABEZADOS_PERSONAS.indexOf('Perfil');
  const COLUMNA_DEL_TOTAL = ENCABEZADOS_PERSONAS.indexOf('Total');
  const { nombreDePerfil } = await import('../../src/lib/normalizacion');
  const { ponenciasDeLaPersona, ponenciasParaLaHoja } = await import('../../src/lib/ponentes');
  const { posiblesRepetidos, resumenDePonentes } = await import('../../src/lib/asistencia');
  const { ponentesRegistrados } = await import('../../src/lib/servidor/asistencia');
  const altasHoja: [string, string, string, string][] = [
    ['hoja.completa@example.org', 'Silvana', 'Costa Arbulú', 'confirmado'],
    ['hoja.espera@example.org', 'Teresa', 'Lista Espera', 'lista_espera'],
    ['hoja.baja@example.org', 'Bernardo', 'Dado De Baja', 'confirmado'],
    // Quien presentó dos ponencias del programa (con los dos apellidos, como los escribe quien se registra).
    ['hoja.ponente@example.org', 'Nuria', 'Ape', 'confirmado'],
    ['hoja.ponente2@example.org', 'Sebastián', 'Grillo Pérez', 'confirmado'],
    // Ponentes que no registraron asistencia (no era un requisito para ellos), uno de ellos con el registro cancelado.
    ['hoja.ponente3@example.org', 'Teresa', 'Sin Asistencia', 'confirmado'],
    ['hoja.ponente4@example.org', 'Carmen', 'Cancelada Ponente', 'cancelado'],
    // Dos registros con el mismo nombre: quien escanee con ese nombre y otro correo no se puede ligar a ninguno.
    ['hoja.ponente5@example.org', 'Nombre', 'Repetido Ponente', 'confirmado'],
    ['hoja.ponente6@example.org', 'Nombre', 'Repetido Ponente', 'confirmado'],
  ];
  for (const [correo, nombres, apellidos, estado] of altasHoja) {
    const a = armarInsercion({
      perfil: correo.startsWith('hoja.ponente') ? 'ponente' : 'publico_general', grupo: 'externo', modalidad: 'presencial', idioma: 'es', nombres, apellidos,
      correo, institucion: 'CIESS', pais_residencia: 'México', estado, consentimiento_datos: true,
    });
    await consultar(`insert into registros (${a.columnas}) values (${a.marcadores})`, a.valores);
  }
  for (const dia of ['miercoles', 'jueves', 'viernes']) {
    await registrarAsistenciaManual({ sesion: dia, via: 'presencial', correo: 'hoja.completa@example.org', usuarioId: usuario!.id });
  }
  await registrarAsistenciaManual({ sesion: 'jueves', via: 'en_linea', correo: 'hoja.espera@example.org', usuarioId: usuario!.id });
  await registrarAsistenciaManual({ sesion: 'jueves', via: 'presencial', correo: 'hoja.baja@example.org', usuarioId: usuario!.id });
  await registrarAsistenciaManual({ sesion: 'viernes', via: 'presencial', correo: 'hoja.sin@example.org', nombre: 'Pedro Sin Registro', usuarioId: usuario!.id });
  await registrarAsistenciaManual({ sesion: 'viernes', via: 'presencial', correo: 'hoja.ponente@example.org', usuarioId: usuario!.id });
  await registrarAsistenciaManual({ sesion: 'jueves', via: 'en_linea', correo: 'hoja.ponente2@example.org', usuarioId: usuario!.id });
  await registrarAsistenciaManual({ sesion: 'jueves', via: 'presencial', correo: 'hoja.typo@example.org', nombre: 'Nombre Repetido Ponente', usuarioId: usuario!.id });
  // Su registro se da de baja después de haber asistido: la asistencia sigue ligada, pero ya no vale.
  await consultar(`update registros set estado = 'cancelado' where correo = 'hoja.baja@example.org'`);

  const deLaBase = await todasLasAsistencias();
  comprobar(
    deLaBase.find((x) => x.correo === 'hoja.completa@example.org')?.estado_registro === 'confirmado' &&
    deLaBase.find((x) => x.correo === 'hoja.baja@example.org')?.estado_registro === 'cancelado' &&
    deLaBase.find((x) => x.correo === 'hoja.sin@example.org')?.estado_registro === null,
    'hoja por persona: cada asistencia trae el estado del registro al que está ligada (nada si está «sin registro»)');
  const ponentesBase = await ponentesRegistrados();
  const filasHoja = filasDePersonas(deLaBase, nombreDePerfil, ponenciasParaLaHoja, ponentesBase);
  const filaHoja = (correo: string) => filasHoja.find((f) => f[2] === correo);
  comprobar(filasHoja.every((f) => f.length === ENCABEZADOS_PERSONAS.length), 'hoja por persona: cada fila trae una celda por título');
  comprobar(
    JSON.stringify(filaHoja('hoja.completa@example.org')?.slice(1)) ===
      JSON.stringify(['Silvana Costa Arbulú', 'hoja.completa@example.org', '', 'Público general', 1, 1, 1, 3, true]),
    'hoja por persona: quien asistió los tres días sale en una fila, con 1 por día, total 3 y la casilla marcada', filaHoja('hoja.completa@example.org'));
  comprobar(filaHoja('hoja.espera@example.org')?.[COLUMNA_CON_REGISTRO] === true && filaHoja('hoja.espera@example.org')?.[COLUMNA_DEL_TOTAL] === 1,
    'hoja por persona: un registro en lista de espera cuenta como registro', filaHoja('hoja.espera@example.org'));
  comprobar(filaHoja('hoja.baja@example.org')?.[COLUMNA_CON_REGISTRO] === false,
    'hoja por persona: un registro cancelado después de asistir deja la casilla sin marcar', filaHoja('hoja.baja@example.org'));
  comprobar(
    JSON.stringify(filaHoja('hoja.sin@example.org')?.slice(1)) === JSON.stringify(['Pedro Sin Registro', 'hoja.sin@example.org', '', '', 0, 0, 1, 1, false]),
    'hoja por persona: quien asistió sin registro sale con la casilla sin marcar y sin perfil', filaHoja('hoja.sin@example.org'));
  comprobar(filasHoja.map((f) => f[0]).every((n, i) => n === i + 1), 'hoja por persona: el N.º va seguido');
  const filaPonente = filaHoja('hoja.ponente@example.org');
  comprobar(
    filaPonente?.[COLUMNA_DEL_PERFIL] === 'Ponente' && ponenciasDeLaPersona('Nuria Ape').length === 2 &&
    filaPonente[COLUMNA_DE_PONENCIA] === ponenciasParaLaHoja('Nuria Ape') && String(filaPonente[COLUMNA_DE_PONENCIA]).includes(' | '),
    'hoja por persona: quien presentó dos ponencias del programa las lleva las dos, en una celda, junto al correo', filaPonente?.[COLUMNA_DE_PONENCIA]);
  comprobar(ENCABEZADOS_PERSONAS[COLUMNA_DE_PONENCIA - 1] === 'Correo' && ENCABEZADOS_PERSONAS[COLUMNA_CON_REGISTRO] === 'Con registro',
    'hoja por persona: «Ponencia» va justo después de «Correo» y «Con registro» es la casilla de la derecha');
  comprobar(
    filaHoja('hoja.ponente2@example.org')?.[COLUMNA_DE_PONENCIA] === 'Modelado markoviano de aportes previsionales con estados enriquecidos.',
    'hoja por persona: se reconoce al ponente aunque se haya registrado con los dos apellidos y con acento', filaHoja('hoja.ponente2@example.org'));
  comprobar(filasHoja.filter((f) => f[2] !== 'hoja.ponente@example.org' && f[2] !== 'hoja.ponente2@example.org').every((f) => f[COLUMNA_DE_PONENCIA] === ''),
    'hoja por persona: quien no presentó ponencia no lleva nada en esa columna');

  // Los ponentes: todos los registros de ponente, una vez cada uno, tengan o no asistencia
  comprobar(ponentesBase.length >= 6 && ponentesBase.every((r) => r.perfil === 'ponente'),
    'ponentes: la consulta trae los registros con perfil de ponente', ponentesBase.length);
  comprobar(ponentesBase.every((r) => filasHoja.filter((f) => f[2] === r.correo).length === 1),
    'ponentes: cada registro de ponente sale una sola vez en la hoja, haya asistido o no');
  comprobar(filasHoja.filter((f) => f[COLUMNA_DEL_PERFIL] === 'Ponente').length === ponentesBase.length,
    'ponentes: las filas con perfil «Ponente» son tantas como los registros de ponente', filasHoja.filter((f) => f[COLUMNA_DEL_PERFIL] === 'Ponente').length);
  const filaSin = filaHoja('hoja.ponente3@example.org');
  comprobar(
    JSON.stringify(filaSin?.slice(1)) === JSON.stringify(['Teresa Sin Asistencia', 'hoja.ponente3@example.org', '', 'Ponente', 0, 0, 0, 0, true]),
    'ponentes: quien no registró asistencia sale con cero días y la casilla de registro marcada', filaSin);
  comprobar(filaHoja('hoja.ponente4@example.org')?.[COLUMNA_CON_REGISTRO] === false,
    'ponentes: un ponente con el registro cancelado sale, con la casilla sin marcar', filaHoja('hoja.ponente4@example.org'));
  const ultimoQueAsistio = Math.max(...filasHoja.filter((f) => Number(f[COLUMNA_DEL_TOTAL]) > 0).map((f) => Number(f[0])));
  comprobar(ponentesBase.filter((r) => !filasHoja.some((f) => f[2] === r.correo && Number(f[COLUMNA_DEL_TOTAL]) > 0))
    .every((r) => Number(filaHoja(r.correo)![0]) > ultimoQueAsistio),
    'ponentes: los que no registraron asistencia van detrás de todos los que sí');
  const resumenPonentes = resumenDePonentes(deLaBase, ponentesBase);
  comprobar(resumenPonentes.total === ponentesBase.length && resumenPonentes.sinAsistencia === ponentesBase.length - 2,
    'ponentes: el resumen dice cuántos hay y cuántos no registraron asistencia (aquí sólo dos asistieron)', resumenPonentes);
  const repetidos = posiblesRepetidos(deLaBase, ponentesBase);
  comprobar(
    repetidos.length === 1 && repetidos[0].filas.length === 3 &&
    repetidos[0].filas.filter((f) => f.perfil === 'ponente').length === 2 && repetidos[0].filas.filter((f) => f.sinRegistro).length === 1,
    'ponentes: el cotejo avisa de quien escaneó «sin registro» con el nombre de dos ponentes, con las tres filas', repetidos);

  await consultar(`delete from asistencias where correo like 'hoja.%'`);
  await consultar(`delete from registros where correo like 'hoja.%@example.org'`);
  ok('limpieza de la hoja por persona');

  // 18. El cotejo de los ponentes con la agenda: se leen los registros y se pasa a ponente a quien se registró como público general
  const { cotejarPonentes } = await import('../../src/lib/cotejo-ponentes');
  const { aplicarCambiosDePerfil, leerRegistrosParaCotejo } = await import('../../src/lib/servidor/cotejo-ponentes');
  const { MESAS } = await import('../../src/lib/programa');
  const altasCotejo: [string, string, string, string, string][] = [
    ['cot.exacto@example.org', 'Soledad', 'Hormazábal', 'publico_general', 'confirmado'],
    ['cot.parcial@example.org', 'Sebastián', 'Grillo Pérez', 'publico_general', 'confirmado'], // con un apellido más que la agenda
    ['cot.ponente@example.org', 'Pedro', 'Pizarro', 'ponente', 'confirmado'],
    ['cot.moderador@example.org', 'Nuria', 'Ape', 'moderador', 'confirmado'],
    ['cot.cancelado@example.org', 'Bruno', 'Bagnarelli', 'publico_general', 'cancelado'],
    ['cot.dup.a@example.org', 'Camila', 'Machado', 'ponente', 'confirmado'],
    ['cot.dup.b@example.org', 'Camila', 'Machado', 'publico_general', 'confirmado'], // la misma persona, registrada dos veces
    ['cot.corto@example.org', 'María', 'López', 'publico_general', 'confirmado'], // un nombre corto que cabe en el de una autora
  ];
  for (const [correo, nombres, apellidos, perfil, estado] of altasCotejo) {
    const a = armarInsercion({
      perfil, grupo: 'externo', modalidad: 'presencial', idioma: 'es', nombres, apellidos, correo,
      institucion: 'CIESS', pais_residencia: 'México', estado, consentimiento_datos: true,
    });
    await consultar(`insert into registros (${a.columnas}) values (${a.marcadores})`, a.valores);
  }
  const perfilDe = async (correo: string) => (await unaFila<{ perfil: string }>('select perfil from registros where correo = $1', [correo]))?.perfil;
  const delRegistro = await leerRegistrosParaCotejo();
  comprobar(altasCotejo.every(([correo]) => delRegistro.some((r) => r.correo === correo)) && delRegistro.every((r) => r.nombre === r.nombre.trim()),
    'cotejo: la consulta trae todos los registros, con el nombre completo y el estado');
  const cotejo = cotejarPonentes(MESAS, delRegistro);
  const suyos = cotejo.cambios.filter((c) => c.registro.correo.startsWith('cot.'));
  comprobar(suyos.map((c) => c.registro.correo).sort().join(',') === 'cot.exacto@example.org,cot.parcial@example.org',
    'cotejo: sólo pasan a ponente quienes se registraron como público general y se reconocen con claridad', suyos.map((c) => c.registro.correo));
  const filaCot = (autor: string) => cotejo.filas.find((f) => f.autor === autor);
  comprobar(
    filaCot('Pedro Pizarro')?.resultado === 'ya_ponente' && filaCot('Nuria Ape')?.resultado === 'otro_perfil' &&
    filaCot('Bruno Bagnarelli')?.resultado === 'cancelado' && filaCot('Camila Machado')?.resultado === 'ya_ponente' &&
    Boolean(filaCot('Camila Machado')?.otros.some((o) => o.correo === 'cot.dup.b@example.org')) &&
    filaCot('María Luisa Mussot López')?.resultado === 'sin_registro',
    'cotejo: ya ponente, otro perfil, cancelado, duplicado de la misma persona y nombre corto sin confundir');

  const aplicados = await aplicarCambiosDePerfil(suyos);
  comprobar(aplicados.length === 2 && aplicados.every((a) => !a.omitido),
    'cotejo: se aplican los dos cambios', aplicados);
  comprobar(
    (await perfilDe('cot.exacto@example.org')) === 'ponente' && (await perfilDe('cot.parcial@example.org')) === 'ponente' &&
    (await perfilDe('cot.moderador@example.org')) === 'moderador' && (await perfilDe('cot.cancelado@example.org')) === 'publico_general' &&
    (await perfilDe('cot.dup.b@example.org')) === 'publico_general' && (await perfilDe('cot.corto@example.org')) === 'publico_general',
    'cotejo: sólo cambia el perfil de esos dos; lo dudoso, lo cancelado y lo de otro perfil se queda como estaba');
  const rastro = await unaFila<{ origen: string; antes: string; despues: string; campos: string[] }>(
    `select origen, datos_previos->>'perfil' as antes, datos_nuevos->>'perfil' as despues, campos
       from auditoria
      where tabla = 'registros' and accion = 'UPDATE'
        and registro_id = (select id::text from registros where correo = 'cot.exacto@example.org')
      order by ocurrido_en desc limit 1`);
  comprobar(rastro?.origen === 'sistema' && rastro.antes === 'publico_general' && rastro.despues === 'ponente' && rastro.campos.includes('perfil'),
    'cotejo: la auditoría asienta el cambio como del sistema, con el perfil de antes y el de después', rastro);

  const cotejoDespues = cotejarPonentes(MESAS, await leerRegistrosParaCotejo());
  comprobar(cotejoDespues.cambios.filter((c) => c.registro.correo.startsWith('cot.')).length === 0 &&
    cotejoDespues.filas.find((f) => f.autor === 'Soledad Hormazábal')?.resultado === 'ya_ponente',
    'cotejo: repetirlo no cambia nada más: ya son ponentes');
  comprobar((await aplicarCambiosDePerfil(suyos)).every((a) => Boolean(a.omitido)),
    'cotejo: un cambio que ya se hizo no se vuelve a aplicar');

  // Un cambio viejo no pisa lo que alguien haya hecho mientras tanto
  await consultar(`update registros set perfil = 'conferencista' where correo = 'cot.corto@example.org'`);
  const [obsoleto] = await aplicarCambiosDePerfil([{
    registro: delRegistro.find((r) => r.correo === 'cot.corto@example.org')!, autor: 'María Luisa Mussot López',
  }]);
  comprobar(Boolean(obsoleto.omitido) && (await perfilDe('cot.corto@example.org')) === 'conferencista',
    'cotejo: si el registro ya no es de público general cuando se aplica, se deja como esté', obsoleto);

  await consultar(`delete from registros where correo like 'cot.%@example.org'`);
  ok('limpieza del cotejo de ponentes');

  // 19. La revisión de repetidos de «Asistencia por persona»: quién sale más de una vez, con el mismo nombre o el mismo correo
  const { leerRevisionDeRepetidos } = await import('../../src/lib/servidor/repetidos');
  const altaDeRepetido = async (correo: string, nombres: string, apellidos: string, estado = 'confirmado') => {
    const a = armarInsercion({
      perfil: 'publico_general', grupo: 'externo', modalidad: 'presencial', idioma: 'es', nombres, apellidos,
      correo, institucion: 'CIESS', pais_residencia: 'México', estado, consentimiento_datos: true,
    });
    await consultar(`insert into registros (${a.columnas}) values (${a.marcadores})`, a.valores);
  };
  const asiste = (sesion: string, correo: string, nombre?: string) =>
    registrarAsistenciaManual({ sesion, via: 'presencial', correo, ...(nombre ? { nombre } : {}), usuarioId: usuario!.id });

  // Una persona registrada dos veces con correos distintos: son dos registros vigentes (dos constancias).
  await altaDeRepetido('rep.a1@example.org', 'Rosa', 'Repetida Nombre');
  await altaDeRepetido('rep.a2@example.org', 'Rosa', 'Repetida Nombre');
  await asiste('jueves', 'rep.a1@example.org');
  await asiste('viernes', 'rep.a2@example.org');
  // El mismo correo: la base sólo lo permite si el primer registro se canceló (índice parcial de registros vigentes). Se registró,
  // asistió, canceló y volvió a registrarse con otro apellido.
  await altaDeRepetido('rep.b@example.org', 'Sara', 'Correo Repetido');
  await asiste('miercoles', 'rep.b@example.org');
  await consultar(`update registros set estado = 'cancelado' where correo = 'rep.b@example.org'`);
  await altaDeRepetido('rep.b@example.org', 'Sara', 'Correo Repetido Soto');
  await asiste('jueves', 'rep.b@example.org');
  comprobar((await consultar(`select 1 from registros where correo = 'rep.b@example.org'`)).length === 2,
    'repetidos: la base deja dos registros con el mismo correo si el primero está cancelado');
  // Escaneó con un correo y después se registró con otro: la asistencia queda «sin registro» y sus días, repartidos.
  await asiste('jueves', 'rep.c.otro@example.org', 'Tania Repartida Dias');
  await altaDeRepetido('rep.c@example.org', 'Tania', 'Repartida Dias');
  await asiste('miercoles', 'rep.c@example.org');
  // Alguien que no se repite.
  await altaDeRepetido('rep.d@example.org', 'Ulises', 'Unico Sin Repetir');
  await asiste('jueves', 'rep.d@example.org');

  const revision = await leerRevisionDeRepetidos();
  const casosPropios = revision.casos.filter((c) => c.filas.some((f) => f.correo.startsWith('rep.')));
  const casoDe = (correo: string) => casosPropios.find((c) => c.filas.some((f) => f.correo === correo));
  comprobar(casosPropios.length === 3, 'repetidos: tres casos —la persona registrada dos veces, el correo repetido y los días repartidos— y no el que no se repite', casosPropios.length);
  const casoA = casoDe('rep.a1@example.org');
  comprobar(casoA?.riesgo === 'dos_constancias' && casoA.motivos.join() === 'nombre' && casoA.filas.length === 2 && casoA.filas.every((f) => f.conRegistro),
    'repetidos: dos registros vigentes con el mismo nombre dan dos constancias', casoA);
  const casoB = casoDe('rep.b@example.org');
  comprobar(
    casoB?.motivos.join() === 'correo' && casoB.riesgo === 'dias_repartidos' && casoB.filas.filter((f) => f.conRegistro).length === 1 &&
    casoB.filas.some((f) => !f.conRegistro && f.ligada && f.accion.startsWith('Registro cancelado')),
    'repetidos: el mismo correo en un registro cancelado y en el vigente se junta; el cancelado no recibe constancia', casoB);
  const casoC = casoDe('rep.c@example.org');
  comprobar(
    casoC?.riesgo === 'dias_repartidos' && casoC.filas.length === 2 && casoC.filas.some((f) => !f.ligada && f.correo === 'rep.c.otro@example.org'),
    'repetidos: una asistencia sin registro con el nombre de alguien registrado reparte sus días', casoC);
  comprobar(!casoDe('rep.d@example.org'), 'repetidos: quien no se repite no sale');
  comprobar(
    revision.casos.every((c, i) => c.numero === i + 1) &&
    revision.casos.map((c) => ['dos_constancias', 'dias_repartidos', 'sin_registro', 'sin_riesgo'].indexOf(c.riesgo)).every((v, i, a) => i === 0 || a[i - 1] <= v),
    'repetidos: los casos van numerados y de más a menos urgente');
  // Es lo que lee la hoja: el N.º de cada fila es el de «Asistencia por persona».
  const { todasLasAsistencias: asistenciasDeAhora } = await import('../../src/lib/servidor/asistencia');
  const hojaDeAhora = filasDePersonas(await asistenciasDeAhora(), nombreDePerfil, ponenciasParaLaHoja, await ponentesRegistrados());
  comprobar(
    casosPropios.every((c) => c.filas.every((f) => hojaDeAhora[f.numero - 1]?.[2] === f.correo)),
    'repetidos: el N.º de cada fila es el de la pestaña «Asistencia por persona»');

  await consultar(`delete from asistencias where correo like 'rep.%' or registro_id in (select id from registros where correo like 'rep.%@example.org')`);
  await consultar(`delete from registros where correo like 'rep.%@example.org'`);
  ok('limpieza de la revisión de repetidos');

  // 20. La limpieza: ligar las asistencias sueltas que repiten a alguien registrado y pasar a altas y bajas los nombres en mayúsculas
  const { planearFusiones, planearNombresDeRegistros, planearNombresDeSueltas } = await import('../../src/lib/limpieza');
  const limpieza = await import('../../src/lib/servidor/limpieza');
  const { revisarRepetidos } = await import('../../src/lib/repetidos');
  // Escaneó dos días con el correo de otra persona y sin estar registrado; después se registró (con el nombre todo en mayúsculas) y
  // asistió el jueves con su correo: el jueves de la suelta es un duplicado, el miércoles es un día que no tenía.
  await asiste('miercoles', 'kbarrios.lim@example.org', 'CARLOS CHAVERA BIANCHI');
  await asiste('jueves', 'kbarrios.lim@example.org', 'CARLOS CHAVERA BIANCHI');
  await altaDeRepetido('lim.carlos@example.org', 'CARLOS', 'CHAVERA BIANCHI');
  await asiste('jueves', 'lim.carlos@example.org');
  await asiste('viernes', 'lim.suelto@example.org', 'PEDRO SUELTO LIMPIO'); // alguien sin registro, sin repetir, con el nombre en mayúsculas
  const idCarlos = (await unaFila<{ id: string }>(`select id from registros where correo = 'lim.carlos@example.org'`))!.id;

  const asistenciasLim = await asistenciasDeAhora();
  const planLim = planearFusiones(revisarRepetidos(asistenciasLim, await ponentesRegistrados()), asistenciasLim);
  const fusionCarlos = planLim.fusiones.find((f) => f.destino.registroId === idCarlos);
  comprobar(fusionCarlos?.sueltas.length === 1 && fusionCarlos.sueltas[0].asistencias.length === 2 && fusionCarlos.sueltas[0].fila.correo === 'kbarrios.lim@example.org',
    'limpieza: la suelta que repite a alguien registrado se liga a él, con sus dos asistencias', fusionCarlos);
  const hecha = await limpieza.aplicarFusion(fusionCarlos!);
  comprobar(hecha.ligadas === 1 && hecha.descartadas === 1 && hecha.fallidas.length === 0,
    'limpieza: el miércoles (un día que no tenía) se liga y el jueves (que ya tenía) se descarta por repetido', hecha);
  const dias = await consultar<{ sesion: string }>(`select sesion from asistencias where registro_id = $1 order by sesion`, [idCarlos]);
  comprobar(dias.map((d) => d.sesion).join() === 'jueves,miercoles', 'limpieza: su registro queda con los dos días, sin repetir', dias);
  comprobar((await consultar(`select 1 from asistencias where correo = 'kbarrios.lim@example.org' and registro_id is null`)).length === 0,
    'limpieza: ya no queda ninguna asistencia suelta con ese correo');

  const cambiosLim = planearNombresDeRegistros(await limpieza.leerRegistrosConNombre()).filter((c) => c.id === idCarlos);
  comprobar(cambiosLim.length === 1 && cambiosLim[0].despues.nombres === 'Carlos' && cambiosLim[0].despues.apellidos === 'Chavera Bianchi',
    'limpieza: el nombre todo en mayúsculas se pasa a altas y bajas', cambiosLim);
  const hechos = await limpieza.aplicarNombresDeRegistros(cambiosLim);
  const quedo = await unaFila<{ nombres: string; apellidos: string }>('select nombres, apellidos from registros where id = $1', [idCarlos]);
  comprobar(!hechos[0].omitido && quedo?.nombres === 'Carlos' && quedo.apellidos === 'Chavera Bianchi', 'limpieza: el registro quedó con su nombre en altas y bajas', quedo);
  const rastroLim = await unaFila<{ origen: string; antes: string; despues: string }>(
    `select origen, datos_previos->>'nombres' as antes, datos_nuevos->>'nombres' as despues from auditoria
      where tabla = 'registros' and accion = 'UPDATE' and registro_id = $1 order by ocurrido_en desc limit 1`, [idCarlos]);
  comprobar(rastroLim?.origen === 'sistema' && rastroLim.antes === 'CARLOS' && rastroLim.despues === 'Carlos',
    'limpieza: la auditoría asienta el cambio como del sistema, con el nombre de antes', rastroLim);
  // Lo que alguien editó entre el cálculo y el cambio no se pisa.
  await consultar(`update registros set nombres = 'CARLOS ALBERTO' where id = $1`, [idCarlos]);
  const enMedio = await limpieza.aplicarNombresDeRegistros(cambiosLim);
  comprobar(Boolean(enMedio[0].omitido) && (await unaFila<{ nombres: string }>('select nombres from registros where id = $1', [idCarlos]))?.nombres === 'CARLOS ALBERTO',
    'limpieza: si lo editaron mientras tanto, se deja como está');

  const cambiosSueltas = planearNombresDeSueltas(await limpieza.leerSueltasConNombre()).filter((c) => c.correo === 'lim.suelto@example.org');
  comprobar(cambiosSueltas.length === 1 && (await limpieza.aplicarNombresDeSueltas(cambiosSueltas)) === 1 &&
    (await unaFila<{ nombre: string }>(`select nombre from asistencias where correo = 'lim.suelto@example.org'`))?.nombre === 'Pedro Suelto Limpio',
    'limpieza: también el nombre de una asistencia sin registro');

  await consultar(`delete from asistencias where correo like '%.lim@example.org' or correo like 'lim.%' or registro_id = $1`, [idCarlos]);
  await consultar(`delete from registros where correo like 'lim.%@example.org'`);
  ok('limpieza de la limpieza de repetidos');

  // 21. Eliminar las filas «sin registro»: sus asistencias, con una copia en CSV antes; nunca un registro ni una asistencia ligada
  const { filasSinRegistro } = await import('../../src/lib/sin-registro');
  const { eliminarAsistenciasSinRegistro, respaldarAsistencias } = await import('../../src/lib/servidor/sin-registro');
  const { conciliarAsistencia: ligarAsistencia } = await import('../../src/lib/servidor/asistencia');
  const { mkdtemp, readFile, stat, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  await altaDeRepetido('sin.ana@example.org', 'Ana', 'Registrada Sin');
  await asiste('jueves', 'sin.ana@example.org');
  await altaDeRepetido('sin.baja@example.org', 'Berta', 'Dada De Baja');
  await asiste('jueves', 'sin.baja@example.org');
  await consultar(`update registros set estado = 'cancelado' where correo = 'sin.baja@example.org'`);
  await asiste('miercoles', 'sin.suelto@example.org', 'Pedro Suelto Uno');
  await asiste('jueves', 'sin.suelto@example.org', 'Pedro Suelto Uno');
  await asiste('viernes', 'sin.otro@example.org', 'Otro Suelto Dos');
  const registrosAntes = Number((await unaFila<{ n: string }>('select count(*)::text as n from registros'))!.n);

  const filasSueltas = filasSinRegistro(await asistenciasDeAhora(), await ponentesRegistrados());
  const suyas = filasSueltas.filas.filter((f) => f.correo.startsWith('sin.'));
  comprobar(suyas.length === 2 && suyas.map((f) => f.asistencias.length).sort().join() === '1,2',
    'sin registro: sólo las filas de quien escaneó sin registro, con todas sus asistencias', suyas);
  comprobar(filasSueltas.conRegistroCancelado >= 1 && !suyas.some((f) => f.correo === 'sin.baja@example.org' || f.correo === 'sin.ana@example.org'),
    'sin registro: ni la persona registrada ni la del registro cancelado son «sin registro»');
  const ids = suyas.flatMap((f) => f.asistencias);

  // La copia primero, con permiso sólo para su dueño
  const carpeta = await mkdtemp(join(tmpdir(), 'respaldo-sin-registro-'));
  const ruta = await respaldarAsistencias(ids, join(carpeta, 'copias'));
  const csv = await readFile(ruta, 'utf8');
  comprobar(csv.startsWith('\uFEFFid,sesion,via,origen,identificado_por,nombre,correo') && csv.split('\r\n').filter(Boolean).length === 1 + ids.length &&
    csv.includes('sin.suelto@example.org') && csv.includes('Otro Suelto Dos') && !csv.includes('sin.ana@example.org'),
    'sin registro: la copia lleva un renglón por asistencia que se borrará, con todas sus columnas, y nada más');
  comprobar(((await stat(ruta)).mode & 0o777) === 0o600 && ((await stat(join(carpeta, 'copias'))).mode & 0o777) === 0o700,
    'sin registro: la copia y su carpeta sólo las lee su dueño');

  // Una de las asistencias se liga a su registro entre la vista previa y el borrado: ya es de alguien y se queda
  const idAna = (await unaFila<{ id: string }>(`select id from registros where correo = 'sin.ana@example.org'`))!.id;
  const idLigada = suyas.find((f) => f.correo === 'sin.suelto@example.org')!.asistencias[0];
  comprobar((await ligarAsistencia(idLigada, idAna)).ok, 'sin registro: una asistencia se liga mientras tanto');
  const sinRegistroBorradas = await eliminarAsistenciasSinRegistro(ids);
  comprobar(sinRegistroBorradas === ids.length - 1, 'sin registro: se borran las que siguen sin registro, y no la que se ligó', sinRegistroBorradas);
  comprobar((await consultar(`select 1 from asistencias where correo in ('sin.suelto@example.org', 'sin.otro@example.org') and registro_id is null`)).length === 0,
    'sin registro: no queda ninguna asistencia suelta de esas personas');
  comprobar(Number((await unaFila<{ n: string }>('select count(*)::text as n from asistencias where registro_id = $1', [idAna]))!.n) === 2,
    'sin registro: la asistencia ligada se queda, con la que ya tenía');
  comprobar(Number((await unaFila<{ n: string }>(`select count(*)::text as n from asistencias a join registros r on r.id = a.registro_id where r.correo = 'sin.baja@example.org'`))!.n) === 1,
    'sin registro: la asistencia de un registro cancelado no se toca');
  comprobar(Number((await unaFila<{ n: string }>('select count(*)::text as n from registros'))!.n) === registrosAntes,
    'sin registro: no se borró ningún registro');
  const vacia = await filasSinRegistro(await asistenciasDeAhora(), await ponentesRegistrados());
  comprobar(vacia.filas.filter((f) => f.correo.startsWith('sin.')).length === 0, 'sin registro: la pestaña ya no tiene esas filas');
  comprobar((await eliminarAsistenciasSinRegistro(ids)) === 0, 'sin registro: repetirlo no borra nada más');

  await rm(carpeta, { recursive: true, force: true });
  await consultar(`delete from asistencias where correo like 'sin.%' or registro_id in (select id from registros where correo like 'sin.%@example.org')`);
  await consultar(`delete from registros where correo like 'sin.%@example.org'`);
  ok('limpieza de las filas sin registro');

  // 22. Juntar los registros de una misma persona: los días del que sobra pasan al que queda y él se cancela, en silencio
  const { planearDuplicados } = await import('../../src/lib/duplicados');
  const { fusionarRegistros } = await import('../../src/lib/servidor/duplicados');
  await altaDeRepetido('dup.uno@example.org', 'Jose', 'Duplicado Prueba');
  await altaDeRepetido('dup.dos@example.org', 'Jose', 'Duplicado Prueba');
  // El primero asistió miércoles y jueves; el segundo, jueves (el mismo día, repetido) y viernes (uno que el primero no tenía)
  await asiste('miercoles', 'dup.uno@example.org');
  await asiste('jueves', 'dup.uno@example.org');
  await asiste('jueves', 'dup.dos@example.org');
  await asiste('viernes', 'dup.dos@example.org');
  const idUno = (await unaFila<{ id: string }>(`select id from registros where correo = 'dup.uno@example.org'`))!.id;
  const idDos = (await unaFila<{ id: string }>(`select id from registros where correo = 'dup.dos@example.org'`))!.id;
  const antesDeCancelar = Number((await unaFila<{ n: string }>('select count(*)::text as n from registros'))!.n);

  const asistenciasDup = await asistenciasDeAhora();
  const revisionDup = revisarRepetidos(asistenciasDup, await ponentesRegistrados());
  // Los dos llevan dos días: los datos no los distinguen, y no se escoge solo.
  comprobar(planearDuplicados(revisionDup).sinResolver.some((c) => c.filas.some((f) => f.correo === 'dup.uno@example.org')),
    'duplicados: con los mismos días y el mismo perfil, no se escoge solo');
  const casoDup = planearDuplicados(revisionDup, ['dup.uno@example.org']).resueltos.find((c) => c.queda.correo === 'dup.uno@example.org');
  comprobar(casoDup?.cancelar.length === 1 && casoDup.cancelar[0].correo === 'dup.dos@example.org',
    'duplicados: con --mantener queda el que se pide y el otro se cancela', casoDup);

  const fusion = await fusionarRegistros(idUno, idDos);
  comprobar(!fusion.omitido && fusion.movidas === 1 && fusion.descartadas === 1,
    'duplicados: el viernes (que no tenía) pasa al que queda y el jueves (que ya tenía) se descarta', fusion);
  const diasUno = await consultar<{ sesion: string }>('select sesion from asistencias where registro_id = $1 order by sesion', [idUno]);
  comprobar(diasUno.map((d) => d.sesion).join() === 'jueves,miercoles,viernes', 'duplicados: el registro que queda tiene los tres días, sin repetir', diasUno);
  comprobar((await consultar('select 1 from asistencias where registro_id = $1', [idDos])).length === 0,
    'duplicados: el que se cancela ya no lleva ninguna asistencia');
  const cancelado = await unaFila<{ estado: string; nombres: string }>('select estado::text as estado, nombres from registros where id = $1', [idDos]);
  comprobar(cancelado?.estado === 'cancelado' && cancelado.nombres === 'Jose', 'duplicados: el que sobra queda cancelado, con sus datos intactos', cancelado);
  comprobar(Number((await unaFila<{ n: string }>('select count(*)::text as n from registros'))!.n) === antesDeCancelar, 'duplicados: no se borró ningún registro');
  const rastroDup = await unaFila<{ origen: string; antes: string; despues: string }>(
    `select origen, datos_previos->>'estado' as antes, datos_nuevos->>'estado' as despues from auditoria
      where tabla = 'registros' and accion = 'UPDATE' and registro_id = $1 order by ocurrido_en desc limit 1`, [idDos]);
  comprobar(rastroDup?.origen === 'sistema' && rastroDup.antes !== 'cancelado' && rastroDup.despues === 'cancelado',
    'duplicados: la auditoría asienta la cancelación como del sistema, con el estado de antes', rastroDup);
  const otraVez = await fusionarRegistros(idUno, idDos);
  comprobar(Boolean(otraVez.omitido) && otraVez.movidas === 0, 'duplicados: repetirlo no hace nada: el que sobra ya no es vigente', otraVez);
  const sinMasCasos = planearDuplicados(revisarRepetidos(await asistenciasDeAhora(), await ponentesRegistrados()));
  comprobar(!sinMasCasos.resueltos.some((c) => c.queda.correo === 'dup.uno@example.org'), 'duplicados: ya no sale como dos constancias');

  await consultar(`delete from asistencias where correo like 'dup.%' or registro_id in (select id from registros where correo like 'dup.%@example.org')`);
  await consultar(`delete from registros where correo like 'dup.%@example.org'`);
  ok('limpieza de los registros duplicados');

  // 23. El envío de constancias: cada persona, una vez, con SU enlace, en su idioma
  const { calcularConstancias, crearCampanaDeConstancias } = await import('../../src/lib/servidor/constancias');
  const plantillasConstancia = await consultar<{ idioma: string }>(`select idioma from plantillas_correo where clave = 'constancia' and activa order by idioma`);
  comprobar(plantillasConstancia.map((p) => p.idioma).sort().join() === 'en,es,pt', 'constancias: la plantilla del correo existe en español, inglés y portugués');
  const altaConstancia = async (correo: string, nombres: string, apellidos: string, idioma: string) => {
    const a = armarInsercion({
      perfil: 'publico_general', grupo: 'externo', modalidad: 'presencial', idioma, nombres, apellidos,
      correo, institucion: 'CIESS', pais_residencia: 'México', estado: 'confirmado', consentimiento_datos: true,
    });
    await consultar(`insert into registros (${a.columnas}) values (${a.marcadores})`, a.valores);
  };
  await altaConstancia('con.ana@example.org', 'Ana', 'Constancia Uno', 'es');
  await altaConstancia('con.eva@example.org', 'Eva', 'Constancia Dos', 'en');
  await altaConstancia('con.luis@example.org', 'Luis', 'Constancia Tres', 'pt');

  const titulosCon = ['N.º', 'Nombre', 'Correo', 'Ponencia', 'Perfil', 'Total', 'Con registro', 'Constancia'];
  const celdaCon = (texto: string, enlace?: string) => ({ texto, enlace: enlace ?? null });
  const filaCon = (n: number, nombre: string, correo: string, registro: string, constancia: ReturnType<typeof celdaCon>) =>
    [String(n), nombre, correo, '', 'Público general', '1', registro].map((x) => celdaCon(x)).concat([constancia]);
  const tablaCon = (enlaceAna: string) => [
    titulosCon.map((x) => celdaCon(x)),
    filaCon(1, 'Ana Constancia Uno', 'con.ana@example.org', 'TRUE', celdaCon('Constancia de Ana', enlaceAna)),
    filaCon(2, 'Eva Constancia Dos', 'con.eva@example.org', 'TRUE', celdaCon('https://constancias.example.org/eva.pdf')),
    filaCon(3, 'Luis Constancia Tres', 'con.luis@example.org', 'TRUE', celdaCon('')), // sin constancia todavía
    filaCon(4, 'Sin Registro Vigente', 'con.nadie@example.org', 'FALSE', celdaCon('https://constancias.example.org/nadie.pdf')),
  ];
  const enlaceDeAna = 'https://drive.google.com/file/d/IDANA1/view?usp=sharing';

  const calculo = await calcularConstancias(tablaCon(enlaceDeAna));
  comprobar(calculo.destinatarios.map((d) => `${d.correo}:${d.idioma}`).join() === 'con.ana@example.org:es,con.eva@example.org:en',
    'constancias: a quien tiene registro y enlace, en el idioma de su registro', calculo.destinatarios);
  comprobar(calculo.excluidos.sinConstancia === 1 && calculo.excluidos.sinRegistro === 1 && calculo.faltan[0]?.nombre === 'Luis Constancia Tres',
    'constancias: sin enlace queda fuera y sale en la lista de quienes faltan; sin registro vigente, también fuera', calculo.excluidos);
  comprobar(calculo.destinatarios[0].datos.enlace === 'https://drive.google.com/uc?export=download&id=IDANA1',
    'constancias: el enlace de Drive se convierte en descarga directa');

  const mala = await crearCampanaDeConstancias({ confirmacion: '99', usuarioId: usuario!.id, tabla: tablaCon(enlaceDeAna) });
  comprobar(!mala.ok && mala.codigo === 'cifra', 'constancias: con una cifra que no coincide no se crea el envío', mala);
  const creada = await crearCampanaDeConstancias({ confirmacion: '2', usuarioId: usuario!.id, tabla: tablaCon(enlaceDeAna) });
  comprobar(creada.ok && creada.total === 2, 'constancias: con la cifra correcta se crea el envío', creada);
  const idCampana = creada.ok ? creada.id : '';
  const guardados = await consultar<{ correo: string; datos: { enlace: string; nombre: string } }>(
    'select correo, datos from envios_campana where campana_id = $1 order by correo', [idCampana]);
  comprobar(guardados.length === 2 && guardados[0].datos.enlace === 'https://drive.google.com/uc?export=download&id=IDANA1' &&
    guardados[1].datos.nombre === 'Eva Constancia Dos', 'constancias: cada fila del envío guarda su enlace y su nombre', guardados);
  const camp = await unaFila<{ clave: string; audiencia: string }>('select clave, audiencia from campanas_correo where id = $1', [idCampana]);
  comprobar(camp?.clave === 'constancia' && camp.audiencia === 'constancias', 'constancias: el envío queda como de constancias');
  const segundoEnvio = await crearCampanaDeConstancias({ confirmacion: '2', usuarioId: usuario!.id, tabla: tablaCon(enlaceDeAna) });
  comprobar(!segundoEnvio.ok && segundoEnvio.codigo === 'en_curso', 'constancias: mientras haya un envío sin terminar no se crea otro', segundoEnvio);

  // El correo de cada una lleva SU enlace y nadie más lo ve
  const filasEnvio = await repositorioPg.reclamar(idCampana, 10);
  const listos = await armarDeLaCampana(idCampana, filasEnvio);
  const deAna = listos.find((c) => c.to === 'con.ana@example.org')!;
  const deEva = listos.find((c) => c.to === 'con.eva@example.org')!;
  comprobar(deAna.html.includes('uc?export=download&amp;id=IDANA1') && !deAna.html.includes('eva.pdf') && deAna.html.includes('Ana Constancia Uno') && deAna.html.includes('Descargar constancia'),
    'constancias: el correo de Ana lleva su botón, su nombre y sólo su enlace, en español', deAna.html.slice(0, 200));
  comprobar(deEva.html.includes('https://constancias.example.org/eva.pdf') && !deEva.html.includes('IDANA1') && deEva.html.includes('Download certificate'),
    'constancias: el de Eva, el suyo y en inglés');
  comprobar(deAna.subject.startsWith('Su constancia de participación') && deEva.subject.startsWith('Your certificate of participation'),
    'constancias: el asunto sale de la plantilla de cada idioma');

  // Se manda (con un enviador de mentira) y nadie recibe dos veces lo mismo
  await repositorioPg.devolverAPendientes(idCampana, filasEnvio.map((f) => f.correo));
  const enviados: string[] = [];
  const r = await procesarTanda({
    repo: repositorioPg, campanaId: idCampana, armar: (filas) => armarDeLaCampana(idCampana, filas),
    enviador: {
      lote: async (correos) => { enviados.push(...correos.map((c) => c.to)); return { error: null }; },
      uno: async (correo) => { enviados.push(correo.to); return { error: null }; },
    },
  });
  comprobar(r.progreso.enviados === 2 && r.progreso.pendientes === 0 && enviados.length === 2, 'constancias: la tanda sale y las dos quedan como enviadas', r.progreso);
  const trasEnviar = await calcularConstancias(tablaCon(enlaceDeAna));
  comprobar(trasEnviar.destinatarios.length === 0 && trasEnviar.excluidos.yaRecibieron === 2,
    'constancias: repetir no alcanza a quien ya la recibió', trasEnviar.excluidos);
  const corregida = await calcularConstancias(tablaCon('https://drive.google.com/file/d/IDANA2/view'));
  comprobar(corregida.destinatarios.length === 1 && corregida.enlaceNuevo === 1 && corregida.destinatarios[0].correo === 'con.ana@example.org',
    'constancias: si el enlace de una persona cambia (se corrigió su constancia) vuelve a tocarle, y sólo a ella', corregida.destinatarios);
  const sinCuarto = await crearCampanaDeConstancias({ confirmacion: '0', usuarioId: usuario!.id, tabla: tablaCon(enlaceDeAna) });
  comprobar(!sinCuarto.ok && sinCuarto.codigo === 'invalido', 'constancias: sin nadie a quien enviar no se crea nada', sinCuarto);

  // 23b. Por separado: público general, ponentes y una lista de correos (que se comprueban contra la hoja)
  const { calcularPorGrupo, verificarListaDeConstancias } = await import('../../src/lib/servidor/constancias');
  const filaGrupo = (n: number, nombre: string, correo: string, perfil: string, constancia: ReturnType<typeof celdaCon>) =>
    [String(n), nombre, correo, '', perfil, '1', 'TRUE'].map((x) => celdaCon(x)).concat([constancia]);
  const tablaGrupos = [
    titulosCon.map((x) => celdaCon(x)),
    filaGrupo(1, 'Ana Constancia Uno', 'con.ana@example.org', 'Público general', celdaCon('Constancia de Ana', enlaceDeAna)), // ya la recibió
    filaGrupo(2, 'Eva Constancia Dos', 'con.eva@example.org', 'Ponente', celdaCon('https://constancias.example.org/eva.pdf')), // ya la recibió
    filaGrupo(3, 'Luis Constancia Tres', 'con.luis@example.org', 'Ponente', celdaCon('https://constancias.example.org/luis.pdf')),
    filaGrupo(4, 'Maria Publico', 'con.maria@example.org', 'Público general', celdaCon('https://constancias.example.org/maria.pdf')),
    filaGrupo(5, 'Pedro Ponente', 'con.pedro@example.org', 'Ponente', celdaCon('https://constancias.example.org/pedro.pdf')),
    filaGrupo(6, 'Sofia Sin Enlace', 'con.sofia@example.org', 'Ponente', celdaCon('')),
  ];
  const porGrupo = await calcularPorGrupo(tablaGrupos);
  comprobar(porGrupo.grupos.publico_general.destinatarios.map((d) => d.correo).join() === 'con.maria@example.org' &&
    porGrupo.grupos.ponente.destinatarios.map((d) => d.correo).join() === 'con.luis@example.org,con.pedro@example.org',
    'constancias por grupo: cada grupo sólo ve a los suyos (y lo ya enviado no se repite)', porGrupo.grupos);
  comprobar(porGrupo.grupos.ponente.faltan.map((f) => f.nombre).join() === 'Sofia Sin Enlace' && porGrupo.grupos.publico_general.faltan.length === 0,
    'constancias por grupo: quien no tiene enlace sale en la lista de su grupo');

  const malaPonentes = await crearCampanaDeConstancias({ confirmacion: '3', usuarioId: usuario!.id, tabla: tablaGrupos, alcance: { tipo: 'grupo', grupo: 'ponente' } });
  comprobar(!malaPonentes.ok && malaPonentes.codigo === 'cifra', 'constancias por grupo: la cifra que se confirma es la del grupo', malaPonentes);
  const deLosPonentes = await crearCampanaDeConstancias({ confirmacion: '2', usuarioId: usuario!.id, tabla: tablaGrupos, alcance: { tipo: 'grupo', grupo: 'ponente' } });
  comprobar(deLosPonentes.ok && deLosPonentes.total === 2, 'constancias por grupo: se crea el envío de los ponentes', deLosPonentes);
  const alcancePonentes = await consultar<{ correo: string; alcance: string }>(
    `select correo, datos->>'alcance' as alcance from envios_campana where campana_id = $1 order by correo`, [deLosPonentes.ok ? deLosPonentes.id : '']);
  comprobar(alcancePonentes.map((x) => `${x.correo}:${x.alcance}`).join() === 'con.luis@example.org:ponente,con.pedro@example.org:ponente',
    'constancias por grupo: cada fila del envío guarda a qué grupo salió', alcancePonentes);
  await consultar('delete from campanas_correo where id = $1', [deLosPonentes.ok ? deLosPonentes.id : '']);

  const correosDeLista = ['con.luis@example.org', 'con.ana@example.org', 'con.sofia@example.org', 'con.nadie@example.org', 'esto no es un correo'];
  const verificada = await verificarListaDeConstancias({ correos: correosDeLista, tabla: tablaGrupos });
  comprobar(verificada.verificacion.map((v) => v.estado).join() === 'enviar,yaRecibio,sinConstancia,noEstaEnLaHoja,correoInvalido',
    'constancias por lista: cada correo dice si le toca su constancia y, si no, por qué', verificada.verificacion);
  const reenviada = await verificarListaDeConstancias({ correos: correosDeLista, reenviar: true, tabla: tablaGrupos });
  comprobar(reenviada.destinatarios.map((d) => d.correo).join() === 'con.luis@example.org,con.ana@example.org' && reenviada.reenvios === 1,
    'constancias por lista: con «reenviar» también la recibe quien ya la tenía, y se cuenta aparte', reenviada);
  const listaMala = await crearCampanaDeConstancias({ confirmacion: '2', usuarioId: usuario!.id, tabla: tablaGrupos, alcance: { tipo: 'lista', correos: correosDeLista, reenviar: false } });
  comprobar(!listaMala.ok && listaMala.codigo === 'cifra', 'constancias por lista: el envío vuelve a comprobar la lista contra la hoja (sólo le toca a una persona)', listaMala);
  const deLaLista = await crearCampanaDeConstancias({ confirmacion: '1', usuarioId: usuario!.id, tabla: tablaGrupos, alcance: { tipo: 'lista', correos: correosDeLista, reenviar: false } });
  comprobar(deLaLista.ok && deLaLista.total === 1, 'constancias por lista: sólo sale a quien le toca', deLaLista);
  const deLista = await consultar<{ correo: string; alcance: string; enlace: string }>(
    `select correo, datos->>'alcance' as alcance, datos->>'enlace' as enlace from envios_campana where campana_id = $1`, [deLaLista.ok ? deLaLista.id : '']);
  comprobar(deLista.length === 1 && deLista[0].correo === 'con.luis@example.org' && deLista[0].alcance === 'lista' && deLista[0].enlace === 'https://constancias.example.org/luis.pdf',
    'constancias por lista: con su propio enlace y marcado como de lista', deLista);
  await consultar('delete from campanas_correo where id = $1', [deLaLista.ok ? deLaLista.id : '']);
  const listaVacia = await crearCampanaDeConstancias({ confirmacion: '0', usuarioId: usuario!.id, tabla: tablaGrupos, alcance: { tipo: 'lista', correos: ['con.nadie@example.org'], reenviar: false } });
  comprobar(!listaVacia.ok && listaVacia.codigo === 'invalido', 'constancias por lista: si a nadie le toca no se crea nada', listaVacia);

  // 23c. La pestaña congelada: la fila nace sembrada y el interruptor funciona y se audita
  const { hojaCongelada, ponerHojaCongelada, exigirHojaLibre } = await import('../../src/lib/servidor/hoja-congelada');
  comprobar(Boolean(await unaFila(`select 1 from configuracion where clave = 'hoja_personas_congelada'`)), 'hoja congelada: la fila del interruptor está sembrada');
  await ponerHojaCongelada(false, null);
  comprobar((await hojaCongelada()) === false, 'hoja congelada: se descongela');
  let rechazo = '';
  try { await exigirHojaLibre(); } catch { rechazo = 'no debía rechazar'; }
  comprobar(rechazo === '', 'hoja congelada: libre, los guiones que cambian la base siguen');
  await ponerHojaCongelada(true, null);
  comprobar((await hojaCongelada()) === true, 'hoja congelada: se congela');
  let mensajeDeRechazo = '';
  try { await exigirHojaLibre(); } catch (e) { mensajeDeRechazo = e instanceof Error ? e.message : String(e); }
  comprobar(/congelada/.test(mensajeDeRechazo), 'hoja congelada: congelada, los guiones que cambian la base se niegan y dicen por qué', mensajeDeRechazo);
  const auditadas = await consultar<{ origen: string }>(
    `select origen from auditoria where tabla = 'configuracion' and datos_nuevos->>'clave' = 'hoja_personas_congelada' order by ocurrido_en desc limit 1`);
  comprobar(auditadas[0]?.origen === 'sistema', 'hoja congelada: el cambio queda en la auditoría', auditadas);

  await consultar('delete from campanas_correo where id = $1', [idCampana]);
  await consultar(`delete from registros where correo like 'con.%@example.org'`);
  ok('limpieza del envío de constancias');

  // Limpieza
  await consultar(`delete from registros where correo = 'ana.prueba@example.org'`);
  await consultar(`delete from usuarios_panel where correo = 'prueba@ciess.org'`);
  await consultar(`update configuracion set valor = '300'::jsonb where clave = 'cupos_presenciales'`);
  ok('limpieza');
}

principal().then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => { console.error('ERROR', e); process.exit(1); });
