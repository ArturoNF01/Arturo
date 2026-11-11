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

  // Limpieza
  await consultar(`delete from registros where correo = 'ana.prueba@example.org'`);
  await consultar(`delete from usuarios_panel where correo = 'prueba@ciess.org'`);
  await consultar(`update configuracion set valor = '300'::jsonb where clave = 'cupos_presenciales'`);
  ok('limpieza');
}

principal().then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => { console.error('ERROR', e); process.exit(1); });
