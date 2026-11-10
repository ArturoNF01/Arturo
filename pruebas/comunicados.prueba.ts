import { describe, expect, it, vi } from 'vitest';
import {
  AUDIENCIAS, PLANTILLAS_MASIVAS, TAMANO_TANDA, clasificarErrorDeEnvio, confirmacionValida,
  correspondeComunicadoAutomatico, elegirDestinatarios, esPlantillaMasiva, faltaPorEnviar, porcentajeAtendido, tandasDe,
  type Progreso, type RegistroParaEnvio,
} from '@/lib/comunicados';

vi.mock('@/lib/bd/conexion', () => ({
  consultar: async () => [],
  enTransaccion: async () => undefined,
  unaFila: async () => null,
}));
vi.mock('@/lib/servidor/contenido', () => ({ leerEjes: async () => ({ filas: [] }) }));

const { llaveDeLote, procesarTanda } = await import('@/lib/servidor/comunicados');
type Repositorio = import('@/lib/servidor/comunicados').Repositorio;
type Enviador = import('@/lib/servidor/comunicados').Enviador;
type FilaDeEnvio = import('@/lib/servidor/comunicados').FilaDeEnvio;
type CorreoListo = import('@/lib/servidor/comunicados').CorreoListo;

/**
 * El envío masivo de un comunicado.
 *
 * Mandar un correo a cientos de personas no se deshace, así que aquí se prueba lo que más
 * duele si falla: que nadie reciba dos veces el mismo correo, que un corte (límite de Resend,
 * una dirección mala, la red) no pierda ni repita a nadie, y que lo que no salió siga pendiente
 * para continuar. Nada de esto envía un solo correo: el repositorio y el enviador son dobles.
 */

// ---------------------------------------------------------------------------
// La lógica pura
// ---------------------------------------------------------------------------

describe('qué plantillas se mandan en masa', () => {
  it('sólo el comunicado: los acuses son de un registro y no se mandan a todos', () => {
    expect([...PLANTILLAS_MASIVAS]).toEqual(['comunicado']);
    expect(esPlantillaMasiva('comunicado')).toBe(true);
    for (const otra of ['confirmacion_registro', 'edicion_registro', 'lista_espera', 'recordatorio', 'registro_cancelado', '']) {
      expect(esPlantillaMasiva(otra), otra).toBe(false);
    }
  });

  it('las audiencias son todos, ponentes y una lista', () => {
    expect([...AUDIENCIAS]).toEqual(['todos', 'ponentes', 'lista']);
  });
});

describe('cómo se clasifica lo que contesta Resend', () => {
  it('distingue la cuota del plan del límite de velocidad, aunque los dos lleguen como 429', () => {
    expect(clasificarErrorDeEnvio({ name: 'daily_quota_exceeded', message: 'x', statusCode: 429 })).toBe('cuota');
    expect(clasificarErrorDeEnvio({ name: 'monthly_quota_exceeded', message: 'x', statusCode: 429 })).toBe('cuota');
    expect(clasificarErrorDeEnvio({ name: 'x', message: 'You have reached your daily sending quota', statusCode: 429 })).toBe('cuota');
    expect(clasificarErrorDeEnvio({ name: 'rate_limit_exceeded', message: 'Too many requests', statusCode: 429 })).toBe('limite');
    expect(clasificarErrorDeEnvio({ message: 'Too many requests. You can only make 2 requests per second.' })).toBe('limite');
  });

  it('una dirección o un campo rechazado es de la persona, no del servicio', () => {
    expect(clasificarErrorDeEnvio({ name: 'validation_error', message: 'Invalid `to` field' })).toBe('direccion');
    expect(clasificarErrorDeEnvio({ name: 'invalid_parameter', message: 'x' })).toBe('direccion');
    expect(clasificarErrorDeEnvio({ message: 'x', statusCode: 422 })).toBe('direccion');
  });

  it('una falla del servicio o de la red se puede reintentar', () => {
    expect(clasificarErrorDeEnvio({ name: 'application_error', message: 'x' })).toBe('transitorio');
    expect(clasificarErrorDeEnvio({ name: 'internal_server_error', message: 'x' })).toBe('transitorio');
    expect(clasificarErrorDeEnvio({ message: 'fetch failed' })).toBe('transitorio');
    expect(clasificarErrorDeEnvio({ message: 'x', statusCode: 503 })).toBe('transitorio');
  });

  it('una llave inválida o un remitente rechazado no es nada de lo anterior', () => {
    expect(clasificarErrorDeEnvio({ name: 'invalid_api_Key', message: 'API key is invalid' })).toBe('otro');
    expect(clasificarErrorDeEnvio({ name: 'missing_api_key', message: 'x' })).toBe('otro');
    expect(clasificarErrorDeEnvio(null)).toBe('otro');
  });
});

describe('el avance y la confirmación', () => {
  const p = (extra: Partial<Progreso> = {}): Progreso => ({ total: 100, enviados: 0, errores: 0, pendientes: 100, enviando: 0, ...extra });

  it('el porcentaje cuenta lo enviado y lo fallido, sin pasarse de 100', () => {
    expect(porcentajeAtendido(p())).toBe(0);
    expect(porcentajeAtendido(p({ enviados: 40, errores: 10, pendientes: 50 }))).toBe(50);
    expect(porcentajeAtendido(p({ enviados: 100, pendientes: 0 }))).toBe(100);
    expect(porcentajeAtendido(p({ total: 0, pendientes: 0 }))).toBe(100);
  });

  it('falta por enviar mientras haya pendientes o personas «enviando» sin confirmar', () => {
    expect(faltaPorEnviar(p())).toBe(true);
    expect(faltaPorEnviar(p({ pendientes: 0, enviando: 3 }))).toBe(true);
    expect(faltaPorEnviar(p({ enviados: 95, errores: 5, pendientes: 0 }))).toBe(false);
  });

  it('para confirmar hay que escribir la cifra exacta, y no vale con cero', () => {
    expect(confirmacionValida('380', 380)).toBe(true);
    expect(confirmacionValida(' 380 ', 380)).toBe(true);
    expect(confirmacionValida(380, 380)).toBe(true);
    expect(confirmacionValida('379', 380)).toBe(false);
    expect(confirmacionValida('', 380)).toBe(false);
    expect(confirmacionValida(undefined, 380)).toBe(false);
    expect(confirmacionValida('0', 0)).toBe(false);
    expect(confirmacionValida('si', 380)).toBe(false);
  });

  it('las tandas parten la lista sin perder ni repetir a nadie', () => {
    const lista = Array.from({ length: 120 }, (_, i) => i);
    const tandas = tandasDe(lista, TAMANO_TANDA);
    expect(tandas.map((t) => t.length)).toEqual([50, 50, 20]);
    expect(tandas.flat()).toEqual(lista);
    expect(tandasDe([], 50)).toEqual([]);
  });
});

describe('a quién le toca el comunicado automático', () => {
  it('a quien está vigente y tiene correo', () => {
    expect(correspondeComunicadoAutomatico('confirmado', 'ana@ejemplo.org')).toBe(true);
    expect(correspondeComunicadoAutomatico('en_proceso', 'ana@ejemplo.org')).toBe(true);
  });

  it('no a quien está en lista de espera ni a quien canceló, igual que en el envío masivo', () => {
    expect(correspondeComunicadoAutomatico('lista_espera', 'ana@ejemplo.org')).toBe(false);
    expect(correspondeComunicadoAutomatico('cancelado', 'ana@ejemplo.org')).toBe(false);
    expect(correspondeComunicadoAutomatico(undefined, 'ana@ejemplo.org')).toBe(false);
  });

  it('ni a quien no tiene correo', () => {
    expect(correspondeComunicadoAutomatico('confirmado', '')).toBe(false);
    expect(correspondeComunicadoAutomatico('confirmado', '   ')).toBe(false);
    expect(correspondeComunicadoAutomatico('confirmado', null)).toBe(false);
  });
});

describe('a quiénes llega un envío', () => {
  const r = (id: string, correo: string | null, extra: Partial<RegistroParaEnvio> = {}): RegistroParaEnvio => ({
    id, correo, idioma: 'es', estado: 'confirmado', perfil: 'publico_general', ...extra,
  });
  const registros = [
    r('1', 'ana@ejemplo.org'),
    r('2', 'luis@ejemplo.org', { idioma: 'en', perfil: 'ponente' }),
    r('3', 'maria@ejemplo.org', { idioma: 'pt', estado: 'en_proceso', perfil: 'ponente' }),
    r('4', 'cancelada@ejemplo.org', { estado: 'cancelado' }),
    r('5', 'espera@ejemplo.org', { estado: 'lista_espera' }),
    r('6', null),
    r('7', '   '),
    r('8', 'ANA@Ejemplo.org'), // la misma dirección con otras mayúsculas
    r('9', 'raro@ejemplo.org', { idioma: 'fr' }),
  ];
  const ninguno = new Set<string>();

  it('a todos: quien tiene registro vigente y correo, sin cancelados ni lista de espera', () => {
    const s = elegirDestinatarios({ audiencia: 'todos', registros, yaRecibieron: ninguno });
    expect(s.destinatarios.map((d) => d.correo)).toEqual([
      'ana@ejemplo.org', 'luis@ejemplo.org', 'maria@ejemplo.org', 'raro@ejemplo.org',
    ]);
    expect(s.excluidos).toMatchObject({ cancelados: 1, listaEspera: 1, sinCorreo: 2, yaRecibieron: 0 });
  });

  it('cada persona en su idioma, y un idioma desconocido cae en español', () => {
    const s = elegirDestinatarios({ audiencia: 'todos', registros, yaRecibieron: ninguno });
    const idioma = Object.fromEntries(s.destinatarios.map((d) => [d.correo, d.idioma]));
    expect(idioma).toMatchObject({ 'ana@ejemplo.org': 'es', 'luis@ejemplo.org': 'en', 'maria@ejemplo.org': 'pt', 'raro@ejemplo.org': 'es' });
    expect(s.porIdioma).toEqual({ es: 2, en: 1, pt: 1 });
  });

  it('quien se registró en un idioma que no tenemos lo recibe en español, aunque se esté viendo otra plantilla', () => {
    // El idioma de la pantalla vale para las direcciones de la lista que no son de nadie; no para quien está registrada.
    const s = elegirDestinatarios({ audiencia: 'todos', registros, yaRecibieron: ninguno, idiomaPorOmision: 'pt' });
    expect(s.destinatarios.find((d) => d.correo === 'raro@ejemplo.org')?.idioma).toBe('es');
    expect(s.destinatarios.find((d) => d.correo === 'ana@ejemplo.org')?.idioma).toBe('es');
  });

  it('por etapas: sólo quienes se registraron en un idioma, y el resto se cuenta aparte', () => {
    const solo = (soloIdioma: 'es' | 'en' | 'pt') =>
      elegirDestinatarios({ audiencia: 'todos', registros, yaRecibieron: ninguno, soloIdioma });
    expect(solo('en').destinatarios.map((d) => d.correo)).toEqual(['luis@ejemplo.org']);
    expect(solo('pt').destinatarios.map((d) => d.correo)).toEqual(['maria@ejemplo.org']);
    // El idioma desconocido cuenta como español.
    expect(solo('es').destinatarios.map((d) => d.correo)).toEqual(['ana@ejemplo.org', 'raro@ejemplo.org']);
    expect(solo('en').excluidos.otroIdioma).toBe(3);
    expect(solo('en').porIdioma).toEqual({ es: 0, en: 1, pt: 0 });
  });

  it('las etapas se completan sin repetir a nadie: lo ya enviado en una no vuelve en la siguiente', () => {
    const primera = elegirDestinatarios({ audiencia: 'todos', registros, yaRecibieron: ninguno, soloIdioma: 'es' });
    const enviados = new Set(primera.destinatarios.map((d) => d.correo));
    const resto = elegirDestinatarios({ audiencia: 'todos', registros, yaRecibieron: enviados });
    expect(resto.destinatarios.map((d) => d.correo)).toEqual(['luis@ejemplo.org', 'maria@ejemplo.org']);
    expect([...enviados].some((c) => resto.destinatarios.some((d) => d.correo === c))).toBe(false);
  });

  it('el filtro por idioma no aplica a una lista escrita a mano: es una orden expresa', () => {
    const s = elegirDestinatarios({
      audiencia: 'lista', registros, yaRecibieron: ninguno, soloIdioma: 'en', lista: ['ana@ejemplo.org', 'luis@ejemplo.org'],
    });
    expect(s.destinatarios.map((d) => d.correo)).toEqual(['ana@ejemplo.org', 'luis@ejemplo.org']);
    expect(s.excluidos.otroIdioma).toBe(0);
  });

  it('en una lista, quien está registrada recibe su idioma y las demás el de la pantalla', () => {
    const s = elegirDestinatarios({
      audiencia: 'lista', registros, yaRecibieron: ninguno, idiomaPorOmision: 'en', lista: ['maria@ejemplo.org', 'nueva@otro.org'],
    });
    expect(s.destinatarios.map((d) => d.idioma)).toEqual(['pt', 'en']);
  });

  it('una misma dirección cuenta una vez, sin distinguir mayúsculas', () => {
    const s = elegirDestinatarios({ audiencia: 'todos', registros, yaRecibieron: ninguno });
    expect(s.destinatarios.filter((d) => d.correo === 'ana@ejemplo.org')).toHaveLength(1);
  });

  it('con la lista de espera incluida, también les llega', () => {
    const s = elegirDestinatarios({ audiencia: 'todos', registros, yaRecibieron: ninguno, incluirListaEspera: true });
    expect(s.destinatarios.map((d) => d.correo)).toContain('espera@ejemplo.org');
    expect(s.excluidos.listaEspera).toBe(0);
  });

  it('nunca a quien ya lo recibió: repetir el envío sólo alcanza a quien falta', () => {
    const s = elegirDestinatarios({
      audiencia: 'todos', registros, yaRecibieron: new Set(['ana@ejemplo.org', 'luis@ejemplo.org']),
    });
    expect(s.destinatarios.map((d) => d.correo)).toEqual(['maria@ejemplo.org', 'raro@ejemplo.org']);
    expect(s.excluidos.yaRecibieron).toBe(2);
  });

  it('a ponentes: sólo ese perfil, con el mismo resto de reglas', () => {
    const s = elegirDestinatarios({ audiencia: 'ponentes', registros, yaRecibieron: ninguno });
    expect(s.destinatarios.map((d) => d.correo)).toEqual(['luis@ejemplo.org', 'maria@ejemplo.org']);
    expect(s.excluidos.noPonentes).toBeGreaterThan(0);
  });

  it('a una lista: las direcciones escritas, estén registradas o no, en el idioma que corresponda', () => {
    const s = elegirDestinatarios({
      audiencia: 'lista', registros, yaRecibieron: ninguno, idiomaPorOmision: 'pt',
      lista: ['Luis@Ejemplo.org', 'nueva@otro.org', 'luis@ejemplo.org', 'cancelada@ejemplo.org'],
    });
    expect(s.destinatarios).toEqual([
      { correo: 'luis@ejemplo.org', registro_id: '2', idioma: 'en' },
      { correo: 'nueva@otro.org', registro_id: null, idioma: 'pt' }, // no registrada: el idioma elegido
      { correo: 'cancelada@ejemplo.org', registro_id: '4', idioma: 'es' }, // lo escribió expresamente
    ]);
  });

  it('en una lista no se filtra a quien ya lo recibió —es una orden expresa—, sólo se avisa', () => {
    const s = elegirDestinatarios({
      audiencia: 'lista', registros, yaRecibieron: new Set(['luis@ejemplo.org']), lista: ['luis@ejemplo.org', 'ana@ejemplo.org'],
    });
    expect(s.destinatarios).toHaveLength(2);
    expect(s.repetidosEnLista).toBe(1);
  });

  it('una base sin registros no da a nadie, ni revienta', () => {
    expect(elegirDestinatarios({ audiencia: 'todos', registros: [], yaRecibieron: ninguno }).destinatarios).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// La orquestación, con repositorio y enviador de mentira
// ---------------------------------------------------------------------------

type Estado = 'pendiente' | 'enviando' | 'enviado' | 'error';

/** Un repositorio en memoria que se porta como la tabla: reclamar marca «enviando», y sólo lo pendiente se reclama. */
function repositorioDeMemoria(correos: string[]) {
  const filas = new Map<string, { estado: Estado; error: string | null; fila: FilaDeEnvio }>(
    correos.map((c) => [c, { estado: 'pendiente', error: null, fila: { correo: c, registro_id: null, idioma: 'es' } }]),
  );
  let cerrada = false;
  const cuenta = (e: Estado) => [...filas.values()].filter((f) => f.estado === e).length;
  const repo: Repositorio = {
    async reclamar(_campana, n) {
      const tomadas = [...filas.values()].filter((f) => f.estado === 'pendiente').sort((a, b) => a.fila.correo.localeCompare(b.fila.correo)).slice(0, n);
      for (const t of tomadas) t.estado = 'enviando';
      return tomadas.map((t) => t.fila);
    },
    async marcarEnviados(_c, lista) { for (const c of lista) filas.get(c)!.estado = 'enviado'; },
    async marcarError(_c, correo, error) { Object.assign(filas.get(correo)!, { estado: 'error', error }); },
    async devolverAPendientes(_c, lista) {
      for (const c of lista) if (filas.get(c)!.estado === 'enviando') filas.get(c)!.estado = 'pendiente';
    },
    async progreso() {
      return { total: filas.size, enviados: cuenta('enviado'), errores: cuenta('error'), pendientes: cuenta('pendiente'), enviando: cuenta('enviando') };
    },
    async cerrarSiTermino() { if (cuenta('pendiente') + cuenta('enviando') === 0) cerrada = true; },
  };
  return { repo, filas, estaCerrada: () => cerrada, estados: () => Object.fromEntries([...filas].map(([c, f]) => [c, f.estado])) };
}

/** Un enviador que apunta lo que se le pide y contesta según un guion. */
function enviadorDeMentira(guion: {
  lote?: (correos: CorreoListo[], llave: string, vez: number) => { name?: string; message: string; statusCode?: number } | null;
  uno?: (correo: CorreoListo, llave: string) => { name?: string; message: string; statusCode?: number } | null;
} = {}) {
  const enviados: string[] = [];
  const llaves: string[] = [];
  let vez = 0;
  const enviador: Enviador = {
    async lote(correos, llave) {
      vez += 1;
      llaves.push(llave);
      const error = guion.lote?.(correos, llave, vez) ?? null;
      if (!error) enviados.push(...correos.map((c) => c.to));
      return { error };
    },
    async uno(correo, llave) {
      llaves.push(llave);
      const error = guion.uno?.(correo, llave) ?? null;
      if (!error) enviados.push(correo.to);
      return { error };
    },
  };
  return { enviador, enviados, llaves };
}

const armarTodo = async (filas: FilaDeEnvio[]): Promise<CorreoListo[]> =>
  filas.map((f) => ({ to: f.correo, subject: 'Asunto', html: '<p>Hola</p>' }));

const correos = (n: number) => Array.from({ length: n }, (_, i) => `persona${String(i).padStart(3, '0')}@ejemplo.org`);

describe('el envío por tandas', () => {
  it('manda a todos, una sola vez a cada uno, y cierra la campaña', async () => {
    const mem = repositorioDeMemoria(correos(120));
    const env = enviadorDeMentira();

    let resultado = await procesarTanda({ repo: mem.repo, enviador: env.enviador, armar: armarTodo, campanaId: 'c1' });
    const tandas = [resultado.progreso.enviados];
    while (resultado.progreso.pendientes > 0) {
      resultado = await procesarTanda({ repo: mem.repo, enviador: env.enviador, armar: armarTodo, campanaId: 'c1' });
      tandas.push(resultado.progreso.enviados);
    }

    expect(tandas).toEqual([50, 100, 120]);
    expect(env.enviados).toHaveLength(120);
    expect(new Set(env.enviados).size, 'nadie dos veces').toBe(120);
    expect(mem.estaCerrada()).toBe(true);
  });

  it('una pasada más, ya terminado, no manda nada', async () => {
    const mem = repositorioDeMemoria(correos(7));
    const env = enviadorDeMentira();
    await procesarTanda({ repo: mem.repo, enviador: env.enviador, armar: armarTodo, campanaId: 'c1' });
    const antes = env.enviados.length;

    const r = await procesarTanda({ repo: mem.repo, enviador: env.enviador, armar: armarTodo, campanaId: 'c1' });

    expect(env.enviados).toHaveLength(antes);
    expect(r.progreso).toMatchObject({ enviados: 7, pendientes: 0 });
  });

  it('dos pantallas abiertas a la vez no se pisan: cada persona sale una vez', async () => {
    const mem = repositorioDeMemoria(correos(90));
    const env = enviadorDeMentira();
    const una = () => procesarTanda({ repo: mem.repo, enviador: env.enviador, armar: armarTodo, campanaId: 'c1' });

    await Promise.all([una(), una(), una()]);
    while ((await mem.repo.progreso('c1')).pendientes > 0) await Promise.all([una(), una()]);

    expect(env.enviados).toHaveLength(90);
    expect(new Set(env.enviados).size).toBe(90);
  });

  it('con el límite de velocidad no se pierde a nadie: todo vuelve a pendiente y se avisa', async () => {
    const mem = repositorioDeMemoria(correos(10));
    const env = enviadorDeMentira({ lote: () => ({ name: 'rate_limit_exceeded', message: 'Too many requests', statusCode: 429 }) });

    const r = await procesarTanda({ repo: mem.repo, enviador: env.enviador, armar: armarTodo, campanaId: 'c1' });

    expect(r.detenido).toBe('limite');
    expect(r.progreso).toMatchObject({ enviados: 0, errores: 0, pendientes: 10, enviando: 0 });
    expect(env.enviados).toHaveLength(0);
  });

  it('y al reintentar sale completo, con la misma llave de idempotencia', async () => {
    const mem = repositorioDeMemoria(correos(10));
    const env = enviadorDeMentira({ lote: (_c, _l, vez) => (vez === 1 ? { name: 'rate_limit_exceeded', message: 'x', statusCode: 429 } : null) });

    await procesarTanda({ repo: mem.repo, enviador: env.enviador, armar: armarTodo, campanaId: 'c1' });
    const r = await procesarTanda({ repo: mem.repo, enviador: env.enviador, armar: armarTodo, campanaId: 'c1' });

    expect(r.progreso).toMatchObject({ enviados: 10, pendientes: 0 });
    expect(env.llaves).toHaveLength(2);
    // Mismo grupo de personas, misma llave: si el primer intento sí había salido, Resend no lo repite.
    expect(env.llaves[0]).toBe(env.llaves[1]);
  });

  it('al acabarse la cuota del plan se detiene y lo que falta queda pendiente para otro día', async () => {
    const mem = repositorioDeMemoria(correos(120));
    const env = enviadorDeMentira({ lote: (_c, _l, vez) => (vez === 2 ? { name: 'daily_quota_exceeded', message: 'daily quota', statusCode: 429 } : null) });

    await procesarTanda({ repo: mem.repo, enviador: env.enviador, armar: armarTodo, campanaId: 'c1' });
    const r = await procesarTanda({ repo: mem.repo, enviador: env.enviador, armar: armarTodo, campanaId: 'c1' });

    expect(r.detenido).toBe('cuota');
    expect(r.progreso).toMatchObject({ enviados: 50, errores: 0, pendientes: 70, enviando: 0 });
    expect(mem.estaCerrada()).toBe(false);
  });

  it('una dirección mala tumba el lote, y se reintenta de a una: sólo ella queda con error', async () => {
    const lista = correos(5);
    const mem = repositorioDeMemoria(lista);
    const pausas: number[] = [];
    const env = enviadorDeMentira({
      lote: () => ({ name: 'validation_error', message: 'Invalid `to` field', statusCode: 422 }),
      uno: (c) => (c.to === lista[2] ? { name: 'validation_error', message: 'Invalid address', statusCode: 422 } : null),
    });

    const r = await procesarTanda({
      repo: mem.repo, enviador: env.enviador, armar: armarTodo, campanaId: 'c1',
      esperar: async (ms) => { pausas.push(ms); },
    });

    expect(r.progreso).toMatchObject({ enviados: 4, errores: 1, pendientes: 0, enviando: 0 });
    expect(mem.estados()[lista[2]]).toBe('error');
    expect(mem.filas.get(lista[2])!.error).toMatch(/Invalid address/);
    expect(env.enviados.sort()).toEqual(lista.filter((c) => c !== lista[2]).sort());
    expect(pausas.length, 'respeta el ritmo de Resend entre envíos sueltos').toBe(4);
    expect(mem.estaCerrada()).toBe(true);
  });

  it('si en pleno envío suelto se acaba la cuota, lo ya enviado se asienta y el resto queda pendiente', async () => {
    const lista = correos(6);
    const mem = repositorioDeMemoria(lista);
    let sueltos = 0;
    const env = enviadorDeMentira({
      lote: () => ({ name: 'validation_error', message: 'x', statusCode: 422 }),
      uno: () => (++sueltos === 4 ? { name: 'daily_quota_exceeded', message: 'quota', statusCode: 429 } : null),
    });

    const r = await procesarTanda({ repo: mem.repo, enviador: env.enviador, armar: armarTodo, campanaId: 'c1' });

    expect(r.detenido).toBe('cuota');
    expect(r.progreso).toMatchObject({ enviados: 3, errores: 0, pendientes: 3, enviando: 0 });
  });

  it('una falla del servicio no marca a nadie como fallido: es de Resend, no de las personas', async () => {
    const mem = repositorioDeMemoria(correos(4));
    const env = enviadorDeMentira({ lote: () => ({ name: 'application_error', message: 'Resend se cayó', statusCode: 500 }) });

    const r = await procesarTanda({ repo: mem.repo, enviador: env.enviador, armar: armarTodo, campanaId: 'c1' });

    expect(r.detenido).toBe('transitorio');
    expect(r.progreso).toMatchObject({ errores: 0, pendientes: 4 });
  });

  it('una llave de Resend inválida detiene el envío sin marcar errores a nadie', async () => {
    const mem = repositorioDeMemoria(correos(4));
    const env = enviadorDeMentira({ lote: () => ({ name: 'invalid_api_Key', message: 'API key is invalid', statusCode: 403 }) });

    const r = await procesarTanda({ repo: mem.repo, enviador: env.enviador, armar: armarTodo, campanaId: 'c1' });

    expect(r.detenido).toBe('otro');
    expect(r.mensaje).toMatch(/API key/);
    expect(r.progreso).toMatchObject({ errores: 0, pendientes: 4 });
  });

  it('si no se puede ni armar el correo, no sale nada y nadie queda marcado', async () => {
    const mem = repositorioDeMemoria(correos(4));
    const env = enviadorDeMentira();

    const r = await procesarTanda({
      repo: mem.repo, enviador: env.enviador, campanaId: 'c1',
      armar: async () => { throw new Error('Falta la plantilla'); },
    });

    expect(r.detenido).toBe('otro');
    expect(r.mensaje).toBe('Falta la plantilla');
    expect(env.enviados).toHaveLength(0);
    expect(r.progreso).toMatchObject({ errores: 0, pendientes: 4 });
  });

  it('la llave de idempotencia depende de a quiénes va, no del orden, y no se repite entre campañas', () => {
    const a = llaveDeLote('camp-1', ['b@x.org', 'a@x.org']);
    expect(a).toBe(llaveDeLote('camp-1', ['a@x.org', 'b@x.org']));
    expect(a).not.toBe(llaveDeLote('camp-2', ['a@x.org', 'b@x.org']));
    expect(a).not.toBe(llaveDeLote('camp-1', ['a@x.org', 'c@x.org']));
    expect(a.length).toBeLessThanOrEqual(256); // el tope de Resend
  });
});
