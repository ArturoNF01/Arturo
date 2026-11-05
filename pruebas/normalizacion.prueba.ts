import { describe, expect, it } from 'vitest';
import {
  CLAVE_DE_FILA, COLORES_MODALIDAD, COLOCAR_DESPUES_DE, HOJAS, HOJA_LISTA, PESTANAS_ESPEJO,
  contarPalabras, filaDeLista, filasDeRegistro, rangoDe,
} from '@/lib/normalizacion';

/** Registro mínimo con los valores canónicos que guarda el formulario. */
function registro(extra: Record<string, unknown> = {}) {
  return {
    id: '11111111-2222-3333-4444-555555555555',
    folio: 'REG-20260401-AB12',
    creado_en: '2026-04-01T15:30:00.000Z',
    perfil: 'ponente',
    grupo: 'externo',
    modalidad: 'presencial',
    idioma: 'es',
    apellidos: 'Ruiz Montaño',
    nombres: 'Ana',
    correo: 'ana@ejemplo.org',
    institucion: 'Universidad Nacional',
    cargo: 'Investigadora',
    procedencia: 'internacional',
    pais_residencia: 'Brasil',
    estado: 'en_proceso',
    consentimiento_datos: true,
    ...extra,
  };
}

describe('contarPalabras', () => {
  it('cuenta palabras colapsando espacios y saltos de línea', () => {
    expect(contarPalabras('  uno   dos\ntres  ')).toBe(3);
  });

  it('devuelve cero para texto vacío o ausente', () => {
    expect(contarPalabras('')).toBe(0);
    expect(contarPalabras(null)).toBe(0);
    expect(contarPalabras('   ')).toBe(0);
  });
});

describe('las pestañas del libro', () => {
  it('son las cuatro que el formulario puede llenar', () => {
    // Fueron seis. ALO, TRA y ALI salieron con el hospedaje, la recepción en
    // el aeropuerto y el régimen alimentario: sin esos campos no había de
    // dónde sacar una fila, y una pestaña que nunca se escribe se lee como
    // un sistema averiado. «Resumen Registro» es la lista para leer de un
    // vistazo, y va en segundo lugar, detrás de REG_Respuestas.
    expect(Object.keys(HOJAS)).toEqual([
      'REG_Respuestas', 'Resumen Registro', 'PAR_Participantes', 'PSE_Personificadores_Semblanzas',
    ]);
  });

  it('ninguna conserva una columna que el formulario ya no pregunta', () => {
    const retiradas = [
      'Entidad', 'Ciudad', 'Nacionalidad', 'ORCID', 'Coautoría',
      'Documentación solicitada', 'Nombre en pasaporte', 'Boleto de vuelo',
      'Requiere alojamiento',
      'Requiere traslado', 'Medio de arribo', 'Terminal de origen',
      'Hora de llegada', 'Aerolínea de llegada', 'Vuelo de llegada',
      'Hora de salida', 'Aerolínea de salida', 'Vuelo de salida',
      'Observaciones de traslado', 'Régimen alimentario', 'Restricción alimentaria',
      'Contacto de emergencia', 'Requiere factura', 'Comentarios', 'Placa',
    ];
    for (const [hoja, columnas] of Object.entries(HOJAS)) {
      for (const columna of retiradas) {
        expect(columnas, `${hoja} · ${columna}`).not.toContain(columna);
      }
    }
  });
});

/** La celda de una columna, buscada por su título. */
function celda(fila: (string | number)[], hoja: keyof typeof HOJAS | string, columna: string) {
  const i = HOJAS[hoja].indexOf(columna);
  if (i < 0) throw new Error(`${hoja} no tiene la columna «${columna}»`);
  return fila[i];
}

describe('filasDeRegistro', () => {
  it('siempre produce la respuesta completa y la fila de participantes', () => {
    const filas = filasDeRegistro(registro({ perfil: 'publico_general' }));
    expect(Object.keys(filas).sort()).toEqual(
      ['PAR_Participantes', 'REG_Respuestas', 'Resumen Registro'],
    );
  });

  it('lleva el folio en la columna B de todas las pestañas, sea cual sea su título', () => {
    // De ahí se parte para volver a escribir la fila de un registro editado.
    // El título cambia de pestaña a pestaña —«Folio» en una, «ID» en las
    // otras—, pero el sitio es siempre el mismo, y es el sitio lo que busca
    // `resincronizarRegistro`.
    const filas = filasDeRegistro(registro({ numero_en_hoja: 7 }));
    for (const [hoja, valores] of Object.entries(filas)) {
      for (const fila of valores) {
        // La lista de registrados no lleva folio —sólo sus cinco columnas—:
        // ahí la fila se encuentra por el número de la columna A.
        if (CLAVE_DE_FILA[hoja].por === 'numero') expect(fila[0], hoja).toBe(7);
        else expect(fila[1], hoja).toBe('REG-20260401-AB12');
      }
    }
  });

  it('toda pestaña dice por dónde se encuentra la fila de un registro', () => {
    for (const hoja of Object.keys(HOJAS)) expect(CLAVE_DE_FILA[hoja], hoja).toBeDefined();
  });

  it('y delante de él, el número de orden, que es por donde se cuenta la hoja', () => {
    const filas = filasDeRegistro(registro({ numero_en_hoja: 52 }));
    for (const [hoja, valores] of Object.entries(filas)) {
      for (const fila of valores) {
        // Como número, no como texto: la hoja tiene que poder ordenarlo.
        expect(fila[0], hoja).toBe(52);
        expect(HOJAS[hoja][0], hoja).toBe('N.º');
      }
    }
  });

  it('sin número, la celda queda vacía en vez de con un cero o un NaN', () => {
    const [fila] = filasDeRegistro(registro()).REG_Respuestas;
    expect(fila[0]).toBe('');
  });

  it('cada fila tiene tantas celdas como encabezados declara su pestaña', () => {
    // Una columna de más o de menos corre todo lo demás y nadie lo nota
    // hasta que alguien lee la hoja meses después.
    for (const [hoja, valores] of Object.entries(filasDeRegistro(registro()))) {
      for (const fila of valores) {
        expect(fila.length, hoja).toBe(HOJAS[hoja].length);
      }
    }
  });

  it('una ficha vieja, con datos que ya no se piden, sigue cuadrando', () => {
    // El libro se lee durante meses: un registro hecho antes del recorte
    // trae vuelos, hotel y régimen alimentario. No se escriben, pero tampoco
    // pueden descuadrar la fila.
    const filas = filasDeRegistro(registro({
      perfil: 'conferencista',
      requiere_alojamiento: true,
      requiere_traslado: 'llegada_y_salida',
      medio_arribo: 'aereo',
      hora_llegada: '14:20',
      regimen_alimentario: 'Vegano',
      orcid: '0000-0002-1825-0097',
    }));
    for (const [hoja, valores] of Object.entries(filas)) {
      for (const fila of valores) {
        expect(fila.length, hoja).toBe(HOJAS[hoja].length);
      }
    }
  });

  it('el libro se lleva en español: perfil y procedencia van traducidos', () => {
    const [fila] = filasDeRegistro(registro()).REG_Respuestas;
    expect(celda(fila, 'REG_Respuestas', 'Perfil')).toBe('Ponente');
    expect(celda(fila, 'REG_Respuestas', 'Procedencia')).toMatch(/^Internacional/);
  });

  it('escribe las fechas de llegada y salida, que es lo que queda del viaje', () => {
    const filas = filasDeRegistro(registro({
      perfil: 'publico_general',
      ciudad_origen: 'Lima',
      fecha_llegada: '2026-11-10',
      fecha_salida: '2026-11-13',
    }));
    const reg = HOJAS.REG_Respuestas;
    const [completa] = filas.REG_Respuestas;
    expect(completa[reg.indexOf('Ciudad de origen')]).toBe('Lima');
    expect(completa[reg.indexOf('Fecha de llegada')]).toBe('2026-11-10');
    expect(completa[reg.indexOf('Fecha de salida')]).toBe('2026-11-13');

    const par = HOJAS.PAR_Participantes;
    const [participante] = filas.PAR_Participantes;
    expect(participante[par.indexOf('Llegada')]).toBe('2026-11-10');
    expect(participante[par.indexOf('Salida')]).toBe('2026-11-13');
  });

  it('escribe quién necesita hospedaje, que es para lo que se pregunta', () => {
    // El comité tiene que poder sacar de la hoja la lista a la que mandar la
    // información del hotel. Si no sale aquí, hay que entrar al panel ficha
    // por ficha.
    const reg = HOJAS.REG_Respuestas;
    const par = HOJAS.PAR_Participantes;
    for (const [valor, esperado] of [[true, 'Sí'], [false, 'No']] as const) {
      const filas = filasDeRegistro(registro({ requiere_alojamiento: valor }));
      expect(filas.REG_Respuestas[0][reg.indexOf('Requiere hospedaje')], String(valor)).toBe(esperado);
      expect(filas.PAR_Participantes[0][par.indexOf('Requiere hospedaje')], String(valor)).toBe(esperado);
    }
  });

  it('el personificador es de quien sale en el programa, no de quien escucha', () => {
    // Esto miraba un campo —«modalidad de participación»— que el formulario
    // dejó de pedir al reducirse a dos perfiles, y desde entonces la pestaña
    // no recibía ni una fila. No fallaba: simplemente no escribía.
    expect(filasDeRegistro(registro()).PSE_Personificadores_Semblanzas).toBeDefined();
    expect(
      filasDeRegistro(registro({ perfil: 'publico_general' })).PSE_Personificadores_Semblanzas,
    ).toBeUndefined();
  });

  it('también para las claves de perfil retiradas, que siguen en fichas hechas', () => {
    expect(
      filasDeRegistro(registro({ perfil: 'conferencista' })).PSE_Personificadores_Semblanzas,
    ).toBeDefined();
  });

  it('la semblanza y la foto llegan como enlace de descarga, no como dirección', () => {
    const [fila] = filasDeRegistro(
      registro({
        semblanza_url: 'https://drive.google.com/file/d/abc/view',
        foto_url: 'https://drive.google.com/file/d/xyz/view',
      }),
    ).PSE_Personificadores_Semblanzas;
    const pse = 'PSE_Personificadores_Semblanzas';
    expect(celda(fila, pse, 'Fotografía')).toBe('=HYPERLINK("https://drive.google.com/file/d/xyz/view";"Descargar")');
    expect(celda(fila, pse, 'Semblanza')).toBe('=HYPERLINK("https://drive.google.com/file/d/abc/view";"Descargar")');
  });

  it('sin archivos, esas celdas quedan vacías en vez de con una fórmula rota', () => {
    const [fila] = filasDeRegistro(registro({})).PSE_Personificadores_Semblanzas;
    expect(celda(fila, 'PSE_Personificadores_Semblanzas', 'Fotografía')).toBe('');
    expect(celda(fila, 'PSE_Personificadores_Semblanzas', 'Semblanza')).toBe('');
  });
});

describe('la lista de registrados', () => {
  it('se llama «Resumen Registro» y tiene sólo las seis columnas pedidas, con Perfil tras Nombre', () => {
    expect(HOJA_LISTA).toBe('Resumen Registro');
    expect(HOJAS[HOJA_LISTA]).toEqual(['N.º', 'Nombre', 'Perfil', 'País', 'Institución', 'Modalidad']);
  });

  it('va en segundo lugar: se crea detrás de REG_Respuestas', () => {
    expect(Object.keys(HOJAS)[1]).toBe(HOJA_LISTA);
    expect(COLOCAR_DESPUES_DE[HOJA_LISTA]).toBe('REG_Respuestas');
  });

  it('es un espejo: entra todo registro, sea cual sea su perfil', () => {
    expect(PESTANAS_ESPEJO).toEqual([HOJA_LISTA]);
    for (const perfil of ['ponente', 'publico_general', 'asistente', 'conferencista']) {
      const filas = filasDeRegistro(registro({ perfil, numero_en_hoja: 3 }));
      expect(filas[HOJA_LISTA], perfil).toHaveLength(1);
    }
  });

  it('lleva número, nombre completo, perfil, país, institución y modalidad, en ese orden', () => {
    expect(filaDeLista(registro({ numero_en_hoja: 12 }))).toEqual([
      12, 'Ana Ruiz Montaño', 'Ponente', 'Brasil', 'Universidad Nacional', 'Presencial',
    ]);
    expect(filaDeLista(registro({ modalidad: 'en_linea' }))[5]).toBe('En línea');
  });

  it('cada celda cae bajo su título', () => {
    const fila = filaDeLista(registro({ numero_en_hoja: 3 }));
    const en = (titulo: string) => fila[HOJAS[HOJA_LISTA].indexOf(titulo)];
    expect(en('Nombre')).toBe('Ana Ruiz Montaño');
    expect(en('Perfil')).toBe('Ponente');
    expect(en('País')).toBe('Brasil');
    expect(en('Institución')).toBe('Universidad Nacional');
    expect(en('Modalidad')).toBe('Presencial');
  });

  it('el perfil se lee con su nombre del formulario, no con la clave', () => {
    expect(filaDeLista(registro({ perfil: 'conferencista' }))[2]).toBe('Conferencista');
    expect(filaDeLista(registro({ perfil: 'ponente' }))[2]).not.toBe('ponente');
  });

  it('el país va tal como lo escribió la persona', () => {
    expect(filaDeLista(registro({ pais_residencia: 'méxico' }))[3]).toBe('méxico');
  });

  it('aguanta los datos que faltan sin escribir «null» ni «undefined»', () => {
    const fila = filaDeLista({ modalidad: 'presencial', nombres: null, apellidos: undefined });
    expect(fila).toEqual(['', '', '', '', '', 'Presencial']);
    for (const celda of fila) expect(String(celda)).not.toMatch(/null|undefined/);
  });

  it('colapsa los espacios que sobran en el nombre', () => {
    expect(filaDeLista(registro({ nombres: ' Ana  María ', apellidos: ' Ruiz   Montaño ' }))[1])
      .toBe('Ana María Ruiz Montaño');
  });

  it('colorea Modalidad: verde para presencial y azul para en línea', () => {
    expect(COLORES_MODALIDAD).toEqual([
      { texto: 'Presencial', fondo: '#d9ead3' },
      { texto: 'En línea', fondo: '#c9daf8' },
    ]);
    // El texto de la regla es el mismo que escribe la celda.
    const textos = [
      filaDeLista(registro({ modalidad: 'presencial' }))[5],
      filaDeLista(registro({ modalidad: 'en_linea' }))[5],
    ];
    expect(COLORES_MODALIDAD.map((c) => c.texto)).toEqual(textos);
  });
});

describe('rangoDe', () => {
  it('deja como estaban los nombres sin espacios', () => {
    expect(rangoDe('REG_Respuestas', 'A1')).toBe('REG_Respuestas!A1');
  });

  it('entrecomilla el nombre con espacio: Google no entiende «Resumen Registro!A1»', () => {
    expect(rangoDe('Resumen Registro', 'A2:A')).toBe("'Resumen Registro'!A2:A");
  });

  it('dobla la comilla que haya dentro del nombre', () => {
    expect(rangoDe("Lista d'Ana", '1:1')).toBe("'Lista d''Ana'!1:1");
  });
});
