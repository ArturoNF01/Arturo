import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * El camino completo de un registro hasta Google Sheets, con la API de Google
 * sustituida por un doble que apunta lo que se le pide.
 *
 * Existe porque el fallo que motivó esta prueba no se veía por ninguna parte:
 * un registro se daba de alta, la respuesta al participante salía bien, y la
 * fila nunca llegaba a la hoja. El error quedaba guardado en una columna de la
 * base que nadie mira. Aquí se ejercita de verdad: se arman las filas, se
 * blindan las celdas y se llama a la API.
 */

const llamadas: { append: unknown[]; batchUpdate: unknown[]; batchClear: unknown[] } = {
  append: [], batchUpdate: [], batchClear: [],
};

/** Los encabezados que la hoja simulada dice tener. Por omisión, los buenos. */
let encabezadosDeLaHoja: (nombre: string) => string[] = () => [];

vi.mock('googleapis', () => ({
  google: {
    auth: { JWT: class { constructor(_: unknown) {} } },
    sheets: () => ({
      spreadsheets: {
        get: async () => ({
          data: {
            sheets: [
              'REG_Respuestas', 'PAR_Participantes', 'ALO_Alojamiento',
              'TRA_Traslados', 'PSE_Personificadores_Semblanzas', 'ALI_Restricciones',
            ].map((title) => ({ properties: { title, sheetId: 1 } })),
          },
        }),
        batchUpdate: async (p: unknown) => { llamadas.batchUpdate.push(p); return { data: {} }; },
        values: {
          append: async (p: unknown) => { llamadas.append.push(p); return { data: {} }; },
          batchUpdate: async (p: unknown) => { llamadas.batchUpdate.push(p); return { data: {} }; },
          batchClear: async (p: unknown) => { llamadas.batchClear.push(p); return { data: {} }; },
          batchGet: async ({ ranges }: { ranges: string[] }) => ({
            data: {
              valueRanges: ranges.map((r) => {
                const fila = encabezadosDeLaHoja(r.split('!')[0]);
                return { values: fila.length ? [fila] : [] };
              }),
            },
          }),
          get: async () => ({ data: { values: [] } }),
        },
      },
    }),
    drive: () => ({ files: {} }),
  },
}));

// El contenido sale de la base; aquí se sirve fijo para no necesitarla.
vi.mock('@/lib/servidor/contenido', () => ({
  leerEjes: async () => ({ filas: [{ clave: 'pensiones', nombre: { es: 'Pensiones' } }] }),
  leerDatosCongreso: async () => ({ limite_semblanza_palabras: 60 }),
}));

/** Un registro de ponente como el que guarda la base tras el alta. */
function ponente(extra: Record<string, unknown> = {}) {
  return {
    id: '0f5d3f64-4b9c-4f0e-9a2a-7d4b1e2c3a55',
    folio: 'REG-20260916-AB12',
    creado_en: '2026-09-16T18:00:00.000Z',
    perfil: 'ponente',
    modalidad: 'presencial',
    idioma: 'es',
    apellidos: 'Ruiz Montaño',
    nombres: 'Ana',
    correo: 'ana@ejemplo.org',
    telefono_whatsapp: '+52 55 1234 5678',
    institucion: 'UNAM',
    cargo: 'Investigadora',
    procedencia: 'nacional',
    pais_residencia: 'México',
    entidad_federativa: 'Jalisco',
    ciudad_residencia: 'Guadalajara',
    titulo_ponencia: 'Cobertura y pensiones',
    semblanza_url: 'https://drive.google.com/file/d/sem123/view',
    autoriza_grabacion: true,
    requerimientos_tecnicos: ['proyeccion'],
    placa_vehiculo: 'ABC-123-X',
    modelo_vehiculo: 'Nissan Versa',
    color_vehiculo: 'Gris',
    regimen_alimentario: 'Vegetariano',
    condicion_alimentaria: true,
    condicion_alimentaria_detalle: 'Alergia a mariscos',
    requiere_alojamiento: false,
    requiere_traslado: 'no',
    consentimiento_datos: true,
    estado: 'en_proceso',
    ...extra,
  };
}

describe('un registro llega a la hoja', () => {
  beforeEach(async () => {
    llamadas.append = [];
    llamadas.batchUpdate = [];
    llamadas.batchClear = [];
    const { HOJAS } = await import('@/lib/normalizacion');
    encabezadosDeLaHoja = (nombre) => HOJAS[nombre] ?? [];
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'cuenta@ejemplo.iam.gserviceaccount.com';
    process.env.GOOGLE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nx\\n-----END PRIVATE KEY-----\\n';
    process.env.GOOGLE_SHEETS_ID = 'hoja-de-prueba';
  });

  it('un ponente presencial escribe sus filas sin reventar', async () => {
    const { sincronizarRegistro } = await import('@/lib/servidor/sheets');
    await expect(sincronizarRegistro(ponente())).resolves.toBeUndefined();

    const hojas = llamadas.append.map((p) => (p as { range: string }).range.split('!')[0]);
    expect(hojas).toContain('REG_Respuestas');
    expect(hojas).toContain('PAR_Participantes');
    expect(hojas).toContain('ALI_Restricciones');
  });

  it('los seis perfiles y las dos modalidades pasan sin excepción', async () => {
    // Doce combinaciones: si alguna revienta, ese registro se pierde en
    // silencio, que es exactamente lo que pasó.
    const { sincronizarRegistro } = await import('@/lib/servidor/sheets');
    const { PERFILES } = await import('@/lib/perfiles');

    for (const perfil of PERFILES) {
      for (const modalidad of ['presencial', 'en_linea'] as const) {
        await expect(
          sincronizarRegistro(ponente({ perfil: perfil.clave, modalidad })),
          `${perfil.clave} · ${modalidad}`,
        ).resolves.toBeUndefined();
      }
    }
  });

  it('aguanta un registro con todo vacío, que es como llega el mínimo', async () => {
    const { sincronizarRegistro } = await import('@/lib/servidor/sheets');
    await expect(
      sincronizarRegistro({ id: 'x', folio: 'REG-1', perfil: 'publico_general' }),
    ).resolves.toBeUndefined();
  });

  it('la semblanza viaja como enlace de descarga, no como dirección', async () => {
    const { sincronizarRegistro } = await import('@/lib/servidor/sheets');
    await sincronizarRegistro(ponente());

    const reg = llamadas.append.find(
      (p) => (p as { range: string }).range.startsWith('REG_Respuestas'),
    ) as { requestBody: { values: string[][] } };
    const fila = reg.requestBody.values[0];
    expect(fila).toContain('=HYPERLINK("https://drive.google.com/file/d/sem123/view";"Descargar")');
  });

  it('el teléfono no se va como fórmula', async () => {
    const { sincronizarRegistro } = await import('@/lib/servidor/sheets');
    await sincronizarRegistro(ponente());

    const reg = llamadas.append.find(
      (p) => (p as { range: string }).range.startsWith('REG_Respuestas'),
    ) as { requestBody: { values: string[][] } };
    expect(reg.requestBody.values[0]).toContain("'+52 55 1234 5678");
  });

  it('sin configuración lo dice en vez de fallar callando', async () => {
    delete process.env.GOOGLE_SHEETS_ID;
    const { sincronizarRegistro } = await import('@/lib/servidor/sheets');
    await expect(sincronizarRegistro(ponente())).rejects.toThrow(/no está configurado/i);
  });
});


describe('una hoja con las columnas de antes', () => {
  beforeEach(() => {
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'cuenta@ejemplo.iam.gserviceaccount.com';
    process.env.GOOGLE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nx\\n-----END PRIVATE KEY-----\\n';
    process.env.GOOGLE_SHEETS_ID = 'hoja-de-prueba';
    llamadas.append = [];
  });

  it('se para en vez de escribir las filas desplazadas', async () => {
    // Es lo que pasa tras cambiar el formulario sin rehacer la hoja: el
    // teléfono acabaría bajo «Cargo» y nadie lo notaría en meses.
    encabezadosDeLaHoja = (nombre) =>
      nombre === 'REG_Respuestas' ? ['Folio', 'ID', 'Una columna de antes'] : [];

    const { sincronizarRegistro } = await import('@/lib/servidor/sheets');
    await expect(sincronizarRegistro(ponente())).rejects.toThrow(/--rehacer/);
    expect(llamadas.append, 'no debe escribir nada').toHaveLength(0);
  });

  it('una pestaña vacía no se toma por desfasada: se le escriben los encabezados', async () => {
    encabezadosDeLaHoja = () => [];
    const { sincronizarRegistro } = await import('@/lib/servidor/sheets');
    await expect(sincronizarRegistro(ponente())).resolves.toBeUndefined();
  });

  it('«--rehacer» reescribe los encabezados, que es a lo que viene', async () => {
    encabezadosDeLaHoja = () => ['Una columna de antes'];
    const { vaciarHojas } = await import('@/lib/servidor/sheets');
    await vaciarHojas();

    const escritos = llamadas.batchUpdate.at(-1) as {
      requestBody: { data: { range: string; values: string[][] }[] };
    };
    const { HOJAS } = await import('@/lib/normalizacion');
    const reg = escritos.requestBody.data.find((d) => d.range.startsWith('REG_Respuestas'));
    expect(reg?.values[0]).toEqual(HOJAS.REG_Respuestas);
  });
});
