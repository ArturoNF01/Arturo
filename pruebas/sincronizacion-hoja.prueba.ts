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

const llamadas: {
  append: unknown[]; batchUpdate: unknown[]; batchClear: unknown[];
  /** Cuentas de las dos llamadas que comprueban el libro antes de escribir. */
  estructura: number; encabezados: number;
  /** El orden en que se llamó a cada cosa, que a veces es lo que importa. */
  orden: string[];
} = {
  append: [], batchUpdate: [], batchClear: [], estructura: 0, encabezados: 0, orden: [],
};

/** Lo que la hoja simulada devolverá la próxima vez que se le escriba. */
let fallosPendientes: unknown[] = [];
function quizaFallar() {
  const fallo = fallosPendientes.shift();
  if (fallo) throw fallo;
}

/** Los encabezados que la hoja simulada dice tener. Por omisión, los buenos. */
let encabezadosDeLaHoja: (nombre: string) => string[] = () => [];

vi.mock('googleapis', () => ({
  google: {
    auth: { JWT: class { constructor(_: unknown) {} } },
    sheets: () => ({
      spreadsheets: {
        get: async () => ({
          data: {
            sheets: (llamadas.estructura += 1, [
              'REG_Respuestas', 'PAR_Participantes', 'ALO_Alojamiento',
              'TRA_Traslados', 'PSE_Personificadores_Semblanzas', 'ALI_Restricciones',
            ].map((title, i) => ({
              // La hoja simulada trae cincuenta filas: al rehacerla hay que
              // borrarlas, y para eso hace falta saber cuántas son.
              properties: { title, sheetId: i + 1, gridProperties: { rowCount: 50 } },
            }))),
          },
        }),
        batchUpdate: async (p: unknown) => { llamadas.batchUpdate.push(p); return { data: {} }; },
        values: {
          append: async (p: unknown) => { llamadas.orden.push('append'); quizaFallar(); llamadas.append.push(p); return { data: {} }; },
          batchUpdate: async (p: unknown) => { llamadas.orden.push('encabezados'); llamadas.batchUpdate.push(p); return { data: {} }; },
          batchClear: async (p: unknown) => { llamadas.batchClear.push(p); return { data: {} }; },
          batchGet: async ({ ranges }: { ranges: string[] }) => ({
            data: (llamadas.encabezados += 1, {
              valueRanges: (llamadas.orden.push('leer'), ranges).map((r) => {
                const fila = encabezadosDeLaHoja(r.split('!')[0]);
                return { values: fila.length ? [fila] : [] };
              }),
            }),
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
    llamadas.orden = [];
    fallosPendientes = [];
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
    // La del personificador: quien sube al programa lleva uno en la mesa.
    expect(hojas).toContain('PSE_Personificadores_Semblanzas');
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
    // Ya no en la respuesta completa —esa columna se fue con la sección—,
    // pero sí en la pestaña del personificador, que es de donde se imprime.
    const { sincronizarRegistro } = await import('@/lib/servidor/sheets');
    await sincronizarRegistro(ponente());

    const pse = llamadas.append.find(
      (p) => (p as { range: string }).range.startsWith('PSE_'),
    ) as { requestBody: { values: string[][] } };
    const fila = pse.requestBody.values[0];
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
    llamadas.orden = [];
    fallosPendientes = [];
  });

  beforeEach(async () => {
    // La comprobación de encabezados se recuerda un minuto para no gastar la
    // cuota de Google en cada alta. Entre pruebas hay que olvidarla: si no,
    // la segunda mide lo que vio la primera.
    const { olvidarRevisionDelLibro } = await import('@/lib/servidor/sheets');
    olvidarRevisionDelLibro();
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

  it('revisar el libro sin nada que copiar también detecta las columnas viejas', async () => {
    // El despliegue sincroniza al final. Con la cola vacía —lo normal justo
    // después— no se abría la hoja y se anunciaba que estaba al día, con las
    // columnas de antes dentro. El aviso llegaba semanas más tarde, cuando
    // alguien se registraba y su alta fallaba.
    encabezadosDeLaHoja = (nombre) =>
      nombre === 'REG_Respuestas' ? ['Folio', 'ID', 'Una columna de antes'] : [];

    const { revisarLibro } = await import('@/lib/servidor/sheets');
    await expect(revisarLibro()).rejects.toThrow(/--rehacer/);
    expect(llamadas.append, 'no debe escribir nada').toHaveLength(0);
  });

  it('y con los encabezados correctos no se queja', async () => {
    const { HOJAS } = await import('@/lib/normalizacion');
    encabezadosDeLaHoja = (nombre) => HOJAS[nombre] ?? [];

    const { revisarLibro, olvidarRevisionDelLibro } = await import('@/lib/servidor/sheets');
    olvidarRevisionDelLibro();
    await expect(revisarLibro()).resolves.toBeUndefined();
  });

  it('a una pestaña sin encabezados se le escriben antes de meterle datos', async () => {
    // No es un detalle de orden. Google, al añadir una fila, busca la tabla
    // que empieza en A1; si la primera fila está en blanco no encuentra
    // ninguna y escribe en A1 mismo. El primer registro ocupa entonces la
    // fila de los títulos y los siguientes la van empujando: así es como los
    // encabezados acaban al final de la hoja, debajo de los datos.
    encabezadosDeLaHoja = () => [];
    llamadas.batchUpdate = [];
    const { sincronizarRegistro } = await import('@/lib/servidor/sheets');
    await expect(sincronizarRegistro(ponente())).resolves.toBeUndefined();

    const { HOJAS } = await import('@/lib/normalizacion');
    const escritos = llamadas.batchUpdate
      .flatMap((p) => (p as { requestBody: { data?: { range: string; values: string[][] }[] } }).requestBody.data ?? []);
    const reg = escritos.find((d) => d.range.startsWith('REG_Respuestas'));
    expect(reg?.values[0], 'los encabezados, escritos').toEqual(HOJAS.REG_Respuestas);

    const orden = llamadas.orden.join(' ');
    expect(orden.indexOf('encabezados'), 'primero los encabezados')
      .toBeLessThan(orden.indexOf('append'));
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

/**
 * Google corta a las sesenta llamadas por minuto y por cuenta. Comprobar el
 * libro cuesta dos —su estructura y la primera fila de cada pestaña— y se
 * hacía en cada alta: con el registro abierto al público, una ráfaga de altas
 * agotaba la cuota y la mitad de las filas no llegaba a la hoja en su momento.
 */
describe('una ráfaga de altas no agota la cuota de Google', () => {
  beforeEach(async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'cuenta@ejemplo.iam.gserviceaccount.com';
    process.env.GOOGLE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nx\\n-----END PRIVATE KEY-----\\n';
    process.env.GOOGLE_SHEETS_ID = 'hoja-de-prueba';
    encabezadosDeLaHoja = () => [];
    llamadas.estructura = 0;
    llamadas.encabezados = 0;
    const { olvidarRevisionDelLibro } = await import('@/lib/servidor/sheets');
    olvidarRevisionDelLibro();
  });

  it('veinte registros seguidos comprueban el libro una sola vez', async () => {
    const { sincronizarRegistro } = await import('@/lib/servidor/sheets');
    for (let i = 0; i < 20; i++) await sincronizarRegistro(ponente());

    expect(llamadas.estructura, 'estructura del libro').toBe(1);
    expect(llamadas.encabezados, 'encabezados').toBe(1);
  });

  it('rehacer la hoja obliga a volver a comprobarla', async () => {
    // Si no, se seguirían escribiendo filas contra la forma de antes.
    const { sincronizarRegistro, vaciarHojas } = await import('@/lib/servidor/sheets');
    await sincronizarRegistro(ponente());
    expect(llamadas.estructura).toBe(1);

    await vaciarHojas();
    // Dos: la de vaciar —que necesita saber cuántas filas borrar— y la del
    // alta siguiente, que ya no se fía de lo comprobado antes.
    await sincronizarRegistro(ponente());
    expect(llamadas.estructura, 'tras vaciar, se vuelve a mirar').toBe(3);
  });
});

/**
 * Lo que rompió la hoja el 13 de octubre: rehacerla con cuarenta y dos
 * registros dentro. Cada registro eran dos o tres escrituras —una por
 * pestaña—, Google corta a las sesenta por minuto, y la cuenta sale sola:
 * pasaron veintitrés y los diecinueve restantes murieron con «Quota exceeded
 * for quota metric 'Write requests'». El sistema no perdió nada —quedaron
 * pendientes— pero la hoja se quedó a medias y hubo que volver a empezar.
 */
describe('copiar muchos registros de una vez', () => {
  beforeEach(async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'cuenta@ejemplo.iam.gserviceaccount.com';
    process.env.GOOGLE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nx\\n-----END PRIVATE KEY-----\\n';
    process.env.GOOGLE_SHEETS_ID = 'hoja-de-prueba';
    llamadas.append = [];
    llamadas.batchUpdate = [];
    llamadas.orden = [];
    fallosPendientes = [];
    const { HOJAS } = await import('@/lib/normalizacion');
    encabezadosDeLaHoja = (nombre) => HOJAS[nombre] ?? [];
    const { olvidarRevisionDelLibro } = await import('@/lib/servidor/sheets');
    olvidarRevisionDelLibro();
  });

  it('cuarenta y dos registros son tres escrituras, no noventa', async () => {
    const { sincronizarRegistros } = await import('@/lib/servidor/sheets');
    const muchos = Array.from({ length: 42 }, (_, i) =>
      ponente({ folio: `REG-2026-${i}`, id: `0f5d3f64-4b9c-4f0e-9a2a-7d4b1e2c3a${String(i).padStart(2, '0')}` }),
    );
    await sincronizarRegistros(muchos);

    // Una por pestaña: REG, PAR y PSE. Con el límite en sesenta por minuto,
    // la diferencia entre tres y noventa y seis es que la hoja se escriba.
    expect(llamadas.append).toHaveLength(3);
  });

  it('y las filas van todas, en el orden en que llegaron', async () => {
    const { sincronizarRegistros } = await import('@/lib/servidor/sheets');
    await sincronizarRegistros([
      ponente({ folio: 'REG-A' }),
      ponente({ folio: 'REG-B' }),
      ponente({ folio: 'REG-C' }),
    ]);

    const reg = llamadas.append.find(
      (p) => (p as { range: string }).range.startsWith('REG_Respuestas'),
    ) as { requestBody: { values: string[][] } };
    expect(reg.requestBody.values.map((f) => f[0])).toEqual(['REG-A', 'REG-B', 'REG-C']);
  });

  it('si Google dice que vamos deprisa, espera y vuelve a intentarlo', async () => {
    vi.useFakeTimers();
    try {
      const { sincronizarRegistros } = await import('@/lib/servidor/sheets');
      fallosPendientes = [
        Object.assign(new Error("Quota exceeded for quota metric 'Write requests'"), { code: 429 }),
      ];

      const copia = sincronizarRegistros([ponente({ folio: 'REG-A' }), ponente({ folio: 'REG-B' })]);
      await vi.runAllTimersAsync();
      await expect(copia).resolves.toBeUndefined();

      // El primer intento se perdió; el segundo escribió las mismas filas.
      const reg = llamadas.append.filter(
        (p) => (p as { range: string }).range.startsWith('REG_Respuestas'),
      );
      expect(reg).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('un fallo que no se cura esperando se cuenta enseguida', async () => {
    const { sincronizarRegistros } = await import('@/lib/servidor/sheets');
    fallosPendientes = [new Error('The caller does not have permission')];
    await expect(sincronizarRegistros([ponente()])).rejects.toThrow(/permission/);
  });
});

/**
 * Vaciar la hoja borra las filas, no sólo lo que tienen dentro.
 *
 * Vaciar celdas dejaba cientos de filas en blanco y, con ellas, a Google
 * decidiendo dónde empieza la tabla. Borrándolas no queda nada que
 * interpretar: la fila 1 son los encabezados y la 2 es la primera que se
 * escriba.
 */
describe('rehacer la hoja la deja con una sola fila', () => {
  beforeEach(async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'cuenta@ejemplo.iam.gserviceaccount.com';
    process.env.GOOGLE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nx\\n-----END PRIVATE KEY-----\\n';
    process.env.GOOGLE_SHEETS_ID = 'hoja-de-prueba';
    llamadas.batchUpdate = [];
    llamadas.orden = [];
    fallosPendientes = [];
  });

  it('borra las filas de debajo y deja los encabezados arriba', async () => {
    const { vaciarHojas } = await import('@/lib/servidor/sheets');
    await vaciarHojas();

    const borrados = llamadas.batchUpdate
      .flatMap((p) => (p as { requestBody: { requests?: { deleteDimension?: { range: { startIndex: number; endIndex: number } } }[] } }).requestBody.requests ?? [])
      .filter((r) => r.deleteDimension);
    expect(borrados.length, 'una por pestaña del sistema').toBe(3);
    for (const { deleteDimension } of borrados) {
      expect(deleteDimension!.range.startIndex, 'la fila 1 se respeta').toBe(1);
      expect(deleteDimension!.range.endIndex).toBe(50);
    }

    // Y lo último que se hace es poner los títulos en la fila que quedó.
    expect(llamadas.orden.at(-1)).toBe('encabezados');
  });
});

/**
 * La secuencia que se ejecuta de verdad al reparar la hoja: rehacerla y, acto
 * seguido, dar de alta a alguien. Es donde se vería un fallo que las pruebas
 * por partes no ven —una pestaña que queda sin encabezados, o sin sitio donde
 * escribir— y es justo el momento en que nadie está mirando la consola.
 */
describe('rehacer la hoja y, a continuación, un alta normal', () => {
  beforeEach(async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'cuenta@ejemplo.iam.gserviceaccount.com';
    process.env.GOOGLE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nx\\n-----END PRIVATE KEY-----\\n';
    process.env.GOOGLE_SHEETS_ID = 'hoja-de-prueba';
    llamadas.append = [];
    llamadas.batchUpdate = [];
    llamadas.orden = [];
    fallosPendientes = [];
    const { HOJAS } = await import('@/lib/normalizacion');
    encabezadosDeLaHoja = (nombre) => HOJAS[nombre] ?? [];
    const { olvidarRevisionDelLibro } = await import('@/lib/servidor/sheets');
    olvidarRevisionDelLibro();
  });

  it('la pestaña recién vaciada conserva filas donde escribir', async () => {
    // Borrar las filas la dejaba con una sola —la de los títulos—, y cada
    // escritura pasaba a depender de que Google agrandase la cuadrícula por
    // su cuenta. Se le devuelven en la misma llamada.
    const { vaciarHojas } = await import('@/lib/servidor/sheets');
    await vaciarHojas();

    const pedidas = llamadas.batchUpdate
      .flatMap((p) => (p as { requestBody: { requests?: { appendDimension?: { length: number } }[] } }).requestBody.requests ?? [])
      .filter((r) => r.appendDimension);
    expect(pedidas.length, 'una por pestaña del sistema').toBe(3);
    for (const { appendDimension } of pedidas) expect(appendDimension!.length).toBe(1000);
  });

  it('y el primer registro que llega después entra sin tropiezos', async () => {
    const { sincronizarRegistro, vaciarHojas } = await import('@/lib/servidor/sheets');
    await vaciarHojas();
    llamadas.append = [];
    await expect(sincronizarRegistro(ponente())).resolves.toBeUndefined();
    expect(llamadas.append.length, 'sus tres filas').toBe(3);
  });
});
