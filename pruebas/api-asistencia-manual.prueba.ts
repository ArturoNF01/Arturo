import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * El registro a mano de la asistencia, por el API del panel: quién puede anotar, qué se acepta y cuándo se avisa a la
 * hoja de Google. Lo que se guarda y cómo se identifica a la persona se prueba contra PostgreSQL (`npm run prueba-bd`).
 */
const sesion = vi.hoisted(() => ({ actual: null as null | { id: string; rol: string } }));
const asistencia = vi.hoisted(() => ({
  registrarAsistenciaManual: vi.fn(),
  ultimasManuales: vi.fn(async () => []),
  resumenPorSesion: vi.fn(async () => ({})),
  asistentesDeSesion: vi.fn(async () => []),
  todasLasAsistencias: vi.fn(async () => []),
  estadoDePrueba: vi.fn(async () => ({})),
  activarPrueba: vi.fn(), borrarPrueba: vi.fn(), buscarRegistros: vi.fn(async () => []), cambiarCodigo: vi.fn(),
  conciliarAsistencia: vi.fn(), eliminarAsistencia: vi.fn(),
}));
const hoja = vi.hoisted(() => ({ pedirSincronizacionDeAsistencias: vi.fn() }));

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('next/navigation', () => ({ redirect: () => undefined }));
vi.mock('@/lib/bd/conexion', () => ({ bdConfigurada: () => false, consultar: async () => [], unaFila: async () => null }));
vi.mock('@/lib/servidor/sesion', async (importar) => {
  const real = await importar<typeof import('@/lib/servidor/sesion')>();
  return { ...real, usuarioActual: async () => sesion.actual };
});
vi.mock('@/lib/servidor/asistencia', () => asistencia);
vi.mock('@/lib/servidor/google', () => ({ googleConfigurado: () => false }));
vi.mock('@/lib/servidor/sheets-asistencia', () => ({
  estadoDeLaHoja: () => ({ ultimaVez: null, error: null }),
  sincronizarYAnotar: vi.fn(),
  pedirSincronizacionDeAsistencias: hoja.pedirSincronizacionDeAsistencias,
}));

const { GET, POST } = await import('@/app/api/asistencia/panel/route');
const { GET: exportar } = await import('@/app/api/asistencia/exportar/route');

const post = (cuerpo: unknown) =>
  POST(new NextRequest('http://localhost/api/asistencia/panel', { method: 'POST', body: JSON.stringify(cuerpo), headers: { 'content-type': 'application/json' } }));
const get = (vista: string) => GET(new NextRequest(`http://localhost/api/asistencia/panel?vista=${vista}`));

const VALIDA = { accion: 'registrar_manual', sesion: 'jueves', via: 'presencial', correo: 'ana@example.org' };
const UUID = '3f2b8a52-1c6e-4f0e-9a43-5d7f0f1c2b11';

beforeEach(() => {
  sesion.actual = { id: 'u-1', rol: 'organizador' };
  vi.clearAllMocks();
  asistencia.registrarAsistenciaManual.mockResolvedValue({
    ok: true, estado: 'registrada', id: 'a-1', nombre: 'Ana Pérez', correo: 'ana@example.org', sinRegistro: false, via: 'presencial', sesion: 'jueves',
  });
});

describe('quién puede anotar la asistencia a mano', () => {
  it('sin sesión no se anota nada', async () => {
    sesion.actual = null;
    expect((await post(VALIDA)).status).toBe(403);
    expect(asistencia.registrarAsistenciaManual).not.toHaveBeenCalled();
  });

  it('el lector ve la asistencia pero no la anota ni ve la lista de las anotadas', async () => {
    sesion.actual = { id: 'u-2', rol: 'lector' };
    expect((await post(VALIDA)).status).toBe(403);
    expect(asistencia.registrarAsistenciaManual).not.toHaveBeenCalled();
    expect((await get('manuales')).status).toBe(403);
    expect((await get('resumen')).status).toBe(200);
  });

  it('quien organiza, y por encima, sí', async () => {
    for (const rol of ['organizador', 'superadmin']) {
      sesion.actual = { id: 'u-3', rol };
      expect((await post(VALIDA)).status, rol).toBe(200);
    }
    expect(asistencia.registrarAsistenciaManual).toHaveBeenCalledTimes(2);
  });
});

describe('qué se acepta', () => {
  it('pasa a quien la anota y lo que se pidió, y contesta lo que devuelve el servidor', async () => {
    const respuesta = await post({ ...VALIDA, nombre: 'Ana Pérez' });
    expect(asistencia.registrarAsistenciaManual).toHaveBeenCalledWith({
      sesion: 'jueves', via: 'presencial', correo: 'ana@example.org', nombre: 'Ana Pérez', registroId: undefined, usuarioId: 'u-1',
    });
    expect(await respuesta.json()).toMatchObject({ ok: true, estado: 'registrada', nombre: 'Ana Pérez' });
  });

  it('un registro elegido entre los que se buscaron viaja como registroId', async () => {
    await post({ accion: 'registrar_manual', sesion: 'viernes', via: 'en_linea', registroId: UUID });
    expect(asistencia.registrarAsistenciaManual).toHaveBeenCalledWith(expect.objectContaining({ sesion: 'viernes', via: 'en_linea', registroId: UUID, correo: undefined }));
  });

  it('sólo los tres días del Congreso: ni la sesión de prueba ni una que no existe', async () => {
    for (const malo of ['prueba', 'mesa-4', 'sabado', '', 7, null]) {
      expect((await post({ ...VALIDA, sesion: malo })).status, String(malo)).toBe(422);
    }
    for (const dia of ['miercoles', 'jueves', 'viernes']) expect((await post({ ...VALIDA, sesion: dia })).status, dia).toBe(200);
  });

  it('sólo presencial o en línea, y un registroId que sea un identificador', async () => {
    for (const via of ['telefono', '', 3, undefined]) expect((await post({ ...VALIDA, via })).status, String(via)).toBe(422);
    for (const registroId of ['no-es-uuid', '1', "'; drop table registros; --"]) {
      expect((await post({ accion: 'registrar_manual', sesion: 'jueves', via: 'presencial', registroId })).status, registroId).toBe(422);
    }
    // Nada de lo rechazado llegó al servidor.
    expect(asistencia.registrarAsistenciaManual).not.toHaveBeenCalled();
  });

  it('un correo o un nombre que no son texto no se pasan', async () => {
    await post({ ...VALIDA, correo: { $ne: '' }, nombre: 42 });
    expect(asistencia.registrarAsistenciaManual).toHaveBeenCalledWith(expect.objectContaining({ correo: undefined, nombre: undefined }));
  });
});

describe('qué se contesta y cuándo se avisa a la hoja', () => {
  it('una asistencia nueva se pasa a la hoja de Google; una que ya estaba, no', async () => {
    await post(VALIDA);
    expect(hoja.pedirSincronizacionDeAsistencias).toHaveBeenCalledTimes(1);

    asistencia.registrarAsistenciaManual.mockResolvedValue({ ok: true, estado: 'ya_registrada', id: 'a-1', nombre: 'Ana Pérez', correo: 'ana@example.org', sinRegistro: false, via: 'presencial', sesion: 'jueves' });
    await post(VALIDA);
    expect(hoja.pedirSincronizacionDeAsistencias).toHaveBeenCalledTimes(1);
  });

  it('que el correo no aparezca no es un error: la pantalla pide el nombre', async () => {
    asistencia.registrarAsistenciaManual.mockResolvedValue({ ok: false, motivo: 'no_encontrado' });
    const respuesta = await post(VALIDA);
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ ok: false, motivo: 'no_encontrado' });
    expect(hoja.pedirSincronizacionDeAsistencias).not.toHaveBeenCalled();
  });

  it('un dato inválido o un registro que ya no existe sí es un error', async () => {
    for (const motivo of ['datos_invalidos', 'registro_invalido', 'sesion_invalida']) {
      asistencia.registrarAsistenciaManual.mockResolvedValue({ ok: false, motivo });
      const respuesta = await post(VALIDA);
      expect(respuesta.status, motivo).toBe(422);
      expect((await respuesta.json()).motivo).toBe(motivo);
    }
    expect(hoja.pedirSincronizacionDeAsistencias).not.toHaveBeenCalled();
  });

  it('si la base falla, se dice que no se pudo, sin soltar el detalle', async () => {
    asistencia.registrarAsistenciaManual.mockRejectedValue(new Error('connection refused a 10.0.0.5'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const respuesta = await post(VALIDA);
    expect(respuesta.status).toBe(500);
    expect(JSON.stringify(await respuesta.json())).not.toMatch(/10\.0\.0\.5|connection/);
  });
});

describe('la lista de las anotadas a mano', () => {
  it('quien organiza la ve', async () => {
    asistencia.ultimasManuales.mockResolvedValue([{ id: 'a-1' }] as never);
    const respuesta = await get('manuales');
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ manuales: [{ id: 'a-1' }] });
  });
});

describe('el CSV dice de dónde viene cada asistencia', () => {
  it('lleva una columna «Origen»: «A mano» para las que anotó el comité y «Escaneo» para las demás', async () => {
    sesion.actual = { id: 'u-2', rol: 'lector' }; // el lector descarga el CSV
    const fila = (origen: string, nombre: string) => ({
      id: nombre, sesion: 'jueves', via: 'presencial', nombre, correo: `${nombre.toLowerCase()}@example.org`, perfil: null, folio: null,
      registro_id: null, identificado_por: 'correo', origen, capturado_nombre: null, capturado_correo: null, creada_en: '2026-11-12T16:00:00Z',
    });
    asistencia.todasLasAsistencias.mockResolvedValue([fila('qr', 'Ana'), fila('manual', 'Luis')] as never);
    const respuesta = await exportar(new NextRequest('http://localhost/api/asistencia/exportar'));
    expect(respuesta.status).toBe(200);
    const lineas = (await respuesta.text()).replace(/^\uFEFF/, '').trim().split(/\r?\n/);
    expect(lineas[0]).toMatch(/Identificación.*Origen$/);
    expect(lineas[1]).toMatch(/Ana.*Escaneo$/);
    expect(lineas[2]).toMatch(/Luis.*A mano$/);
  });
});
