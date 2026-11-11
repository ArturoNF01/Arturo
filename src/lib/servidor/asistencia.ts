import 'server-only';
import { randomInt } from 'node:crypto';
import QRCode from 'qrcode';
import { consultar, unaFila } from '@/lib/bd/conexion';
import {
  ALFABETO_DE_CODIGOS, CLAVE_DE_PRUEBA, LARGO_DE_CODIGO, SESIONES_DE_ASISTENCIA, VIAS,
  correoValido, decidirIdentidad, esCodigoPosible, esSesionDeLaAgenda, estadoDeVentana, nombreDePila, sesionPorClave, ventanaDe,
  type OrigenDeAsistencia, type RespuestaDeAsistencia, type RespuestaDeBusqueda, type RespuestaManual, type SesionDeAsistencia,
  type ViaAsistencia,
} from '@/lib/asistencia';

/**
 * La asistencia a las sesiones: los códigos de los QR y de los enlaces del chat, y el registro de quién
 * asistió. Las reglas que se pueden probar sin base de datos viven en `@/lib/asistencia`.
 *
 * Escanear nunca debe fallar por un problema de otro sitio: aquí sólo interviene la base de datos. Lo
 * que se copia a la hoja de Google se hace aparte y por lotes (`sheets-asistencia.ts`), porque cien
 * personas escaneando a la vez no pueden convertirse en cien escrituras a Google.
 */

// ---------------------------------------------------------------------------
// Códigos
// ---------------------------------------------------------------------------

export type CodigosPorSesion = Record<string, Record<ViaAsistencia, string>>;

function codigoNuevo(): string {
  let codigo = '';
  for (let i = 0; i < LARGO_DE_CODIGO; i++) codigo += ALFABETO_DE_CODIGOS[randomInt(ALFABETO_DE_CODIGOS.length)];
  return codigo;
}

/** El error de «ya existe» de PostgreSQL: el código nuevo chocó con otro. Casi imposible, pero se reintenta. */
const esChoque = (error: unknown) => (error as { code?: string } | null)?.code === '23505';

async function insertarCodigo(sesion: string, via: ViaAsistencia): Promise<void> {
  for (let intento = 0; intento < 5; intento++) {
    try {
      await consultar(
        'insert into asistencia_codigos (sesion, via, codigo) values ($1, $2, $3) on conflict (sesion, via) do nothing',
        [sesion, via, codigoNuevo()],
      );
      return;
    } catch (error) {
      if (!esChoque(error)) throw error;
    }
  }
  throw new Error('No se pudo generar un código único.');
}

/**
 * Todos los códigos, creando los que falten. Es repetible: no cambia los que ya existen, que ya pueden
 * estar impresos.
 */
export async function asegurarCodigos(): Promise<CodigosPorSesion> {
  // Los códigos de sesiones que ya no existen —cuando la asistencia era por mesa— se quitan: su QR ya no registra
  // nada (la sesión no está en la agenda) y no tiene caso que sigan en la lista. La sesión de prueba no se toca.
  await consultar(
    'delete from asistencia_codigos where sesion <> $1 and sesion <> all($2::text[])',
    [CLAVE_DE_PRUEBA, SESIONES_DE_ASISTENCIA.map((s) => s.clave)],
  );
  const existentes = await consultar<{ sesion: string; via: ViaAsistencia; codigo: string }>(
    'select sesion, via, codigo from asistencia_codigos',
  );
  const tiene = new Set(existentes.map((c) => `${c.sesion}|${c.via}`));
  for (const sesion of SESIONES_DE_ASISTENCIA) {
    for (const via of VIAS) {
      if (!tiene.has(`${sesion.clave}|${via}`)) await insertarCodigo(sesion.clave, via);
    }
  }

  const todos = await consultar<{ sesion: string; via: ViaAsistencia; codigo: string }>(
    'select sesion, via, codigo from asistencia_codigos',
  );
  const salida: CodigosPorSesion = {};
  for (const c of todos) {
    // Los de la sesión de prueba van aparte (`estadoDePrueba`): no son de la agenda ni se imprimen.
    if (c.sesion === CLAVE_DE_PRUEBA) continue;
    (salida[c.sesion] ??= {} as Record<ViaAsistencia, string>)[c.via] = c.codigo;
  }
  return salida;
}

/**
 * Los códigos que ya existen, sin crear ninguno: lo que ve quien sólo puede mirar. Si nadie que organice ha
 * abierto todavía la pantalla, no hay códigos y se devuelve vacío (crearlos es de `asegurarCodigos`).
 */
export async function leerCodigos(): Promise<CodigosPorSesion> {
  const todos = await consultar<{ sesion: string; via: ViaAsistencia; codigo: string }>(
    'select sesion, via, codigo from asistencia_codigos where sesion <> $1',
    [CLAVE_DE_PRUEBA],
  );
  const salida: CodigosPorSesion = {};
  for (const c of todos) (salida[c.sesion] ??= {} as Record<ViaAsistencia, string>)[c.via] = c.codigo;
  return salida;
}

/** Cambia el código de una sesión y vía —por si se filtró—. El anterior deja de funcionar al instante. */
export async function cambiarCodigo(sesion: string, via: ViaAsistencia): Promise<string | null> {
  if (!sesionPorClave(sesion)) return null;
  for (let intento = 0; intento < 5; intento++) {
    try {
      const codigo = codigoNuevo();
      await consultar(
        `insert into asistencia_codigos (sesion, via, codigo) values ($1, $2, $3)
         on conflict (sesion, via) do update set codigo = excluded.codigo, creado_en = now()`,
        [sesion, via, codigo],
      );
      return codigo;
    } catch (error) {
      if (!esChoque(error)) throw error;
    }
  }
  return null;
}

/** De qué sesión y vía es un código, si es de una sesión que sigue en la agenda. */
export async function resolverCodigo(codigo: string): Promise<{ sesion: string; via: ViaAsistencia } | null> {
  if (!esCodigoPosible(codigo)) return null;
  const fila = await unaFila<{ sesion: string; via: ViaAsistencia }>(
    'select sesion, via from asistencia_codigos where codigo = $1',
    [codigo],
  );
  return fila && sesionPorClave(fila.sesion) ? fila : null;
}

// ---------------------------------------------------------------------------
// Registrar la asistencia
// ---------------------------------------------------------------------------

interface RegistroVigente {
  id: string;
  nombres: string;
  apellidos: string;
  correo: string;
}

async function registroVigentePorCorreo(correo: string): Promise<RegistroVigente | null> {
  return unaFila<RegistroVigente>(
    `select id, nombres, apellidos, correo from registros
      where lower(correo) = $1 and estado <> 'cancelado'
      limit 1`,
    [correo],
  );
}

export interface PeticionDeAsistencia {
  codigo: string;
  correo: string;
  /** Sólo en el segundo paso: lo que tecleó como su nombre. */
  nombre?: string;
  ahora?: Date;
}

type FalloDeCodigo =
  | { ok: false; motivo: 'codigo_invalido' }
  | { ok: false; motivo: 'fuera_de_horario'; estado: 'antes' | 'cerrada'; abre: string; cierra: string };

/** El código, resuelto a su sesión y vía, y comprobado que esté dentro de su horario. */
async function validarCodigo(
  codigoCrudo: unknown, ahora: Date,
): Promise<{ ok: true; sesion: SesionDeAsistencia; via: ViaAsistencia } | FalloDeCodigo> {
  const codigo = await resolverCodigo(String(codigoCrudo ?? '').trim().toLowerCase());
  const sesion = codigo ? sesionPorClave(codigo.sesion) : undefined;
  if (!codigo || !sesion) return { ok: false, motivo: 'codigo_invalido' };

  const estado = estadoDeVentana(sesion, ahora);
  if (estado !== 'abierta') {
    const { abre, cierra } = ventanaDe(sesion);
    return { ok: false, motivo: 'fuera_de_horario', estado, abre: abre.toISOString(), cierra: cierra.toISOString() };
  }
  return { ok: true, sesion, via: codigo.via };
}

/**
 * Busca el registro de un correo para rellenar el nombre completo en la pantalla, antes de registrar la
 * asistencia: quien escanea ve que es su registro y toca el botón. No escribe nada.
 *
 * Sólo contesta con un código vigente y dentro de su horario —quien no está en la sesión no puede usarla para
 * averiguar quién está registrado— y devuelve únicamente el nombre, nada más del registro.
 */
export async function buscarPersonaPorCorreo(
  p: { codigo: string; correo: string; ahora?: Date },
): Promise<RespuestaDeBusqueda> {
  const valido = await validarCodigo(p.codigo, p.ahora ?? new Date());
  if (!valido.ok) return valido;

  const correo = String(p.correo ?? '').trim().toLowerCase();
  if (!correoValido(correo) || correo.length > 200) return { ok: false, motivo: 'datos_invalidos' };

  const registro = await registroVigentePorCorreo(correo);
  return registro
    ? { ok: true, encontrado: true, nombre: `${registro.nombres} ${registro.apellidos}`.replace(/\s+/g, ' ').trim() }
    : { ok: true, encontrado: false };
}

/** Lo que hace falta para anotar una asistencia, venga de un escaneo o de una captura a mano. */
interface Captura {
  sesion: string;
  via: ViaAsistencia;
  /** En minúsculas y ya comprobado; vacío si se eligió el registro a mano. */
  correo: string;
  nombre: string;
  /** Un registro elegido a mano en el panel, en lugar de buscarlo por el correo. */
  registroId?: string;
  origen: OrigenDeAsistencia;
  /** Quién del comité la anotó, si es a mano. */
  registradaPor?: string;
}

type Capturada =
  | {
      ok: true; estado: 'registrada' | 'ya_registrada'; id: string | null; registro: RegistroVigente | null;
      /** Lo que se tecleó como nombre. */
      nombreEscrito: string; nombreGuardado: string; correoGuardado: string; via: ViaAsistencia;
    }
  | { ok: false; motivo: 'no_encontrado' | 'registro_invalido' };

/**
 * La parte que comparten el QR y el registro a mano: identificar a la persona (ver `decidirIdentidad`) y anotar su
 * asistencia. Una sola, para que las dos puertas apliquen las mismas reglas: una asistencia por persona y por día, sin
 * importar la vía ni por dónde llegó, y a quien no se halla se le guarda «sin registro» para que el comité lo concilie.
 */
async function capturarAsistencia(c: Captura): Promise<Capturada> {
  let registro: RegistroVigente | null = null;
  let identificadoPor: 'correo' | 'nombre' | 'conciliada' | 'ninguno' = 'ninguno';

  if (c.registroId) {
    // Elegido a mano entre los registros: no hay nada que adivinar.
    registro = await unaFila<RegistroVigente>(
      `select id, nombres, apellidos, correo from registros where id = $1 and estado <> 'cancelado'`,
      [c.registroId],
    );
    if (!registro) return { ok: false, motivo: 'registro_invalido' };
    // Si además se escribió su correo y es el mismo, se lo identificó por el correo; si no, fue a mano entre los registros.
    identificadoPor = c.correo && c.correo === registro.correo.toLowerCase() ? 'correo' : 'conciliada';
  } else {
    const porCorreo = await registroVigentePorCorreo(c.correo);
    // Sólo hace falta mirar por nombre cuando el correo no apareció y ya se pidió el nombre.
    const candidatos = !porCorreo && c.nombre
      ? await consultar<{ id: string; nombres: string; apellidos: string }>(
          `select id, nombres, apellidos from registros where estado <> 'cancelado'`,
        )
      : [];

    const decision = decidirIdentidad({
      registroPorCorreo: porCorreo?.id ?? null,
      nombre: c.nombre,
      candidatosPorNombre: candidatos,
    });
    if (decision.accion === 'pedir_datos') return { ok: false, motivo: 'no_encontrado' };

    if (decision.accion === 'registrar') {
      registro = porCorreo?.id === decision.registroId
        ? porCorreo
        : await unaFila<RegistroVigente>('select id, nombres, apellidos, correo from registros where id = $1', [decision.registroId]);
      if (registro) identificadoPor = decision.por;
    }
  }

  const nombreGuardado = registro ? `${registro.nombres} ${registro.apellidos}`.trim() : c.nombre;
  const correoGuardado = registro ? registro.correo.toLowerCase() : c.correo;

  const insertada = await consultar<{ id: string }>(
    `insert into asistencias (sesion, via, registro_id, identificado_por, nombre, correo, capturado_nombre, capturado_correo, origen, registrada_por)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     on conflict do nothing
     returning id`,
    [
      c.sesion, c.via, registro?.id ?? null, identificadoPor,
      nombreGuardado, correoGuardado, c.nombre || null, c.correo || null, c.origen, c.registradaPor ?? null,
    ],
  );
  const base = { ok: true as const, registro, nombreEscrito: c.nombre, nombreGuardado, correoGuardado };
  if (insertada.length > 0) return { ...base, estado: 'registrada', id: insertada[0].id, via: c.via };

  // Ya estaba: se dice por qué vía quedó, que puede no ser la que se pidió ahora.
  const previa = await unaFila<{ id: string; via: ViaAsistencia }>(
    registro
      ? 'select id, via from asistencias where sesion = $1 and registro_id = $2'
      : 'select id, via from asistencias where sesion = $1 and correo = $2 and registro_id is null',
    [c.sesion, registro ? registro.id : correoGuardado],
  );
  return { ...base, estado: 'ya_registrada', id: previa?.id ?? null, via: previa?.via ?? c.via };
}

/**
 * Registra la asistencia de quien escaneó, en dos pasos (ver `decidirIdentidad`).
 *
 * Escanear dos veces no duplica: se contesta que ya estaba registrada. Y la vía —presencial o en
 * línea— sale del código que se usó, no de lo que diga la persona.
 */
export async function registrarAsistencia(p: PeticionDeAsistencia): Promise<RespuestaDeAsistencia> {
  const valido = await validarCodigo(p.codigo, p.ahora ?? new Date());
  if (!valido.ok) return valido;

  const correo = String(p.correo ?? '').trim().toLowerCase();
  const nombre = String(p.nombre ?? '').replace(/\s+/g, ' ').trim();
  if (!correoValido(correo) || correo.length > 200 || nombre.length > 200) {
    return { ok: false, motivo: 'datos_invalidos' };
  }

  const r = await capturarAsistencia({ sesion: valido.sesion.clave, via: valido.via, correo, nombre, origen: 'qr' });
  if (!r.ok) return { ok: false, motivo: r.motivo === 'no_encontrado' ? 'no_encontrado' : 'error' };

  const saludo = nombreDePila(r.registro ? r.registro.nombres : r.nombreEscrito);
  return { ok: true, estado: r.estado, sinRegistro: !r.registro, nombre: saludo, via: r.via, sesion: valido.sesion.clave };
}

export interface PeticionManual {
  /** Un día de la agenda ('miercoles', 'jueves', 'viernes'). */
  sesion: string;
  via: ViaAsistencia;
  /** El correo con el que se registró la persona. */
  correo?: string;
  /** Sólo si el correo no apareció: lo que dice la persona que es su nombre. */
  nombre?: string;
  /** Un registro elegido a mano entre los que se buscaron, en lugar del correo. */
  registroId?: string;
  /** Quien del comité la anota. */
  usuarioId: string;
}

/**
 * Anota a mano la asistencia de quien no tiene teléfono —o no pudo escanear—, desde el panel. Es lo mismo que un escaneo,
 * con las mismas reglas (`capturarAsistencia`), salvo dos cosas:
 *
 *  - No depende del horario del código. Quien la anota es del comité y tiene a la persona enfrente; un horario que cerró hace
 *    diez minutos no debe dejar a nadie sin su asistencia. (Sí tiene que ser uno de los días de la agenda.)
 *  - Queda dicho que fue a mano y quién la anotó, para que se pueda revisar y deshacer.
 */
export async function registrarAsistenciaManual(p: PeticionManual): Promise<RespuestaManual> {
  if (!esSesionDeLaAgenda(p.sesion)) return { ok: false, motivo: 'sesion_invalida' };

  const correo = String(p.correo ?? '').trim().toLowerCase();
  const nombre = String(p.nombre ?? '').replace(/\s+/g, ' ').trim();
  if (nombre.length > 200 || correo.length > 200 || (!p.registroId && !correoValido(correo))) {
    return { ok: false, motivo: 'datos_invalidos' };
  }

  const r = await capturarAsistencia({
    sesion: p.sesion, via: p.via, nombre, registroId: p.registroId, origen: 'manual', registradaPor: p.usuarioId,
    // Con un registro elegido, el correo sólo cuenta si está bien escrito: es lo que se guarda como «lo que se tecleó».
    correo: p.registroId && !correoValido(correo) ? '' : correo,
  });
  if (!r.ok) return { ok: false, motivo: r.motivo };
  return {
    ok: true, estado: r.estado, id: r.id, nombre: r.nombreGuardado, correo: r.correoGuardado,
    sinRegistro: !r.registro, via: r.via, sesion: p.sesion,
  };
}

// ---------------------------------------------------------------------------
// Lo que ve el panel
// ---------------------------------------------------------------------------

export interface ResumenDeSesion {
  presencial: number;
  en_linea: number;
  /** Cuántas de las asistencias de la sesión no están ligadas a un registro. */
  sinRegistro: number;
  total: number;
}

/** Cuántas asistencias hay por sesión. Las sesiones sin ninguna no aparecen: es un cero. */
export async function resumenPorSesion(): Promise<Record<string, ResumenDeSesion>> {
  const filas = await consultar<{ sesion: string; presencial: string; en_linea: string; sin_registro: string; total: string }>(
    `select sesion,
            count(*) filter (where via = 'presencial')::text as presencial,
            count(*) filter (where via = 'en_linea')::text   as en_linea,
            count(*) filter (where registro_id is null)::text as sin_registro,
            count(*)::text as total
       from asistencias
      group by sesion`,
  );
  const salida: Record<string, ResumenDeSesion> = {};
  for (const f of filas) {
    salida[f.sesion] = {
      presencial: Number(f.presencial), en_linea: Number(f.en_linea),
      sinRegistro: Number(f.sin_registro), total: Number(f.total),
    };
  }
  return salida;
}

export interface Asistente {
  id: string;
  sesion: string;
  via: ViaAsistencia;
  /** Si es de un registro, el nombre y el correo vigentes de éste; si no, lo que quedó guardado. */
  nombre: string;
  correo: string;
  perfil: string | null;
  folio: string | null;
  registro_id: string | null;
  identificado_por: 'correo' | 'nombre' | 'conciliada' | 'ninguno';
  /** Escaneó la persona (`qr`) o la anotó alguien del comité desde el panel (`manual`). */
  origen: OrigenDeAsistencia;
  capturado_nombre: string | null;
  capturado_correo: string | null;
  creada_en: string;
}

const COLUMNAS_DE_ASISTENTE = `
  a.id, a.sesion, a.via, a.registro_id, a.identificado_por, a.origen, a.capturado_nombre, a.capturado_correo,
  a.creada_en::text as creada_en,
  coalesce(nullif(btrim(r.nombres || ' ' || r.apellidos), ''), a.nombre) as nombre,
  coalesce(r.correo, a.correo) as correo,
  r.perfil, r.folio`;

/** Quién asistió a una sesión, en el orden en que escaneó. */
export async function asistentesDeSesion(sesion: string): Promise<Asistente[]> {
  return consultar<Asistente>(
    `select ${COLUMNAS_DE_ASISTENTE}
       from asistencias a left join registros r on r.id = a.registro_id
      where a.sesion = $1
      order by a.creada_en, a.id`,
    [sesion],
  );
}

export interface AsistenciaManual {
  id: string;
  sesion: string;
  via: ViaAsistencia;
  nombre: string;
  correo: string;
  /** No se halló su registro: quedó «sin registro», por conciliar. */
  sin_registro: boolean;
  creada_en: string;
  /** Quién del comité la anotó (su nombre, o su correo si no tiene nombre). */
  registrada_por: string | null;
}

/** Las últimas asistencias anotadas a mano, las más recientes primero: lo que se revisa —y se deshace— tras anotar. */
export async function ultimasManuales(limite = 15): Promise<AsistenciaManual[]> {
  return consultar<AsistenciaManual>(
    `select a.id, a.sesion, a.via, a.creada_en::text as creada_en,
            coalesce(nullif(btrim(r.nombres || ' ' || r.apellidos), ''), a.nombre) as nombre,
            coalesce(r.correo, a.correo) as correo,
            (a.registro_id is null) as sin_registro,
            coalesce(nullif(btrim(u.nombre), ''), u.correo) as registrada_por
       from asistencias a
       left join registros r on r.id = a.registro_id
       left join usuarios_panel u on u.id = a.registrada_por
      where a.origen = 'manual'
      order by a.creada_en desc, a.id
      limit $1`,
    [Math.max(1, Math.min(50, Math.trunc(limite)))],
  );
}

/** Todas las asistencias, en orden de llegada: de aquí salen la vista por persona, el CSV y la hoja. */
export async function todasLasAsistencias(): Promise<Asistente[]> {
  return consultar<Asistente>(
    `select ${COLUMNAS_DE_ASISTENTE}
       from asistencias a left join registros r on r.id = a.registro_id
      order by a.creada_en, a.id`,
  );
}

export interface RegistroCoincidente {
  id: string;
  folio: string;
  nombre: string;
  correo: string;
  perfil: string;
}

/** Registros que se parecen a lo que se escribió: para ligar una asistencia «sin registro» a su dueño. */
export async function buscarRegistros(texto: string): Promise<RegistroCoincidente[]> {
  const q = texto.trim();
  if (q.length < 2) return [];
  const patron = `%${q.toLowerCase().replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  return consultar<RegistroCoincidente>(
    `select id, folio, btrim(nombres || ' ' || apellidos) as nombre, correo, perfil
       from registros
      where estado <> 'cancelado'
        and (lower(correo) like $1 or lower(nombres || ' ' || apellidos) like $1
             or lower(apellidos || ' ' || nombres) like $1 or lower(folio) like $1)
      order by apellidos, nombres
      limit 8`,
    [patron],
  );
}

export type ResultadoDeConciliacion =
  | { ok: true; resultado: 'ligada' | 'duplicada_descartada' }
  | { ok: false; mensaje: string };

/**
 * Liga una asistencia «sin registro» a un registro, a mano. Si esa persona ya tenía asistencia en la
 * misma sesión (escaneó bien después de haber quedado sin registro), la fila suelta se descarta: era
 * la misma asistencia y no debe contar dos veces.
 */
export async function conciliarAsistencia(asistenciaId: string, registroId: string): Promise<ResultadoDeConciliacion> {
  const registro = await unaFila<RegistroVigente>(
    `select id, nombres, apellidos, correo from registros where id = $1 and estado <> 'cancelado'`,
    [registroId],
  );
  if (!registro) return { ok: false, mensaje: 'Ese registro no existe o está cancelado.' };

  const ligadas = await consultar<{ id: string }>(
    `update asistencias a
        set registro_id = $2, identificado_por = 'conciliada',
            nombre = $3, correo = $4
      where a.id = $1 and a.registro_id is null
        and not exists (select 1 from asistencias b where b.sesion = a.sesion and b.registro_id = $2)
      returning a.id`,
    [asistenciaId, registro.id, `${registro.nombres} ${registro.apellidos}`.trim(), registro.correo.toLowerCase()],
  );
  if (ligadas.length > 0) return { ok: true, resultado: 'ligada' };

  const descartadas = await consultar<{ id: string }>(
    `delete from asistencias a
      where a.id = $1 and a.registro_id is null
        and exists (select 1 from asistencias b where b.sesion = a.sesion and b.registro_id = $2)
      returning a.id`,
    [asistenciaId, registro.id],
  );
  if (descartadas.length > 0) return { ok: true, resultado: 'duplicada_descartada' };
  return { ok: false, mensaje: 'Esa asistencia ya no está pendiente de conciliar.' };
}

/** Quita una asistencia (un escaneo que no correspondía). Es lo único que se borra de aquí, y nunca toca un registro. */
export async function eliminarAsistencia(id: string): Promise<boolean> {
  const filas = await consultar<{ id: string }>('delete from asistencias where id = $1 returning id', [id]);
  return filas.length > 0;
}

// ---------------------------------------------------------------------------
// La sesión de prueba
// ---------------------------------------------------------------------------

export interface EstadoDePrueba {
  activa: boolean;
  /** Los enlaces completos, si está activa. */
  presencial: string | null;
  en_linea: string | null;
  /** El QR del enlace presencial, como SVG, si está activa. */
  qr: string | null;
  /** Cuántas asistencias de prueba hay guardadas. */
  total: number;
}

/**
 * Cómo está la sesión de prueba: si tiene códigos, cuáles son y cuántas asistencias de prueba hay.
 * `base` es la dirección del sitio, para armar los enlaces.
 */
export async function estadoDePrueba(base: string): Promise<EstadoDePrueba> {
  const [codigos, cuenta] = await Promise.all([
    consultar<{ via: ViaAsistencia; codigo: string }>('select via, codigo from asistencia_codigos where sesion = $1', [CLAVE_DE_PRUEBA]),
    unaFila<{ total: string }>('select count(*)::text as total from asistencias where sesion = $1', [CLAVE_DE_PRUEBA]),
  ]);
  const de = (via: ViaAsistencia) => codigos.find((c) => c.via === via)?.codigo;
  const presencial = de('presencial');
  const enLinea = de('en_linea');
  const enlace = (codigo: string | undefined) => (codigo ? `${base.replace(/\/+$/, '')}/a/${codigo}` : null);
  const url = enlace(presencial);
  return {
    activa: Boolean(presencial && enLinea),
    presencial: url,
    en_linea: enlace(enLinea),
    qr: url ? await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }) : null,
    total: Number(cuenta?.total ?? 0),
  };
}

/** Crea los códigos de la sesión de prueba (si no existen) y devuelve cómo queda. */
export async function activarPrueba(base: string): Promise<EstadoDePrueba> {
  for (const via of VIAS) {
    const hay = await unaFila('select 1 from asistencia_codigos where sesion = $1 and via = $2', [CLAVE_DE_PRUEBA, via]);
    if (!hay) await insertarCodigo(CLAVE_DE_PRUEBA, via);
  }
  return estadoDePrueba(base);
}

/**
 * Quita la prueba: sus asistencias y sus códigos (el QR de prueba deja de funcionar). Sólo toca la sesión de
 * prueba: ninguna asistencia ni registro del Congreso.
 */
export async function borrarPrueba(): Promise<{ asistencias: number; codigos: number }> {
  const asistencias = await consultar<{ id: string }>('delete from asistencias where sesion = $1 returning id', [CLAVE_DE_PRUEBA]);
  const codigos = await consultar<{ codigo: string }>('delete from asistencia_codigos where sesion = $1 returning codigo', [CLAVE_DE_PRUEBA]);
  return { asistencias: asistencias.length, codigos: codigos.length };
}
