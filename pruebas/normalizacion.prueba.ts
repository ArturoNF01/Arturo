import { describe, expect, it } from 'vitest';
import { HOJAS, contarPalabras, filasDeRegistro } from '@/lib/normalizacion';

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
  it('son las tres que el formulario puede llenar', () => {
    // Fueron seis. ALO, TRA y ALI salieron con el hospedaje, la recepción en
    // el aeropuerto y el régimen alimentario: sin esos campos no había de
    // dónde sacar una fila, y una pestaña que nunca se escribe se lee como
    // un sistema averiado.
    expect(Object.keys(HOJAS)).toEqual([
      'REG_Respuestas', 'PAR_Participantes', 'PSE_Personificadores_Semblanzas',
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

describe('filasDeRegistro', () => {
  it('siempre produce la respuesta completa y la fila de participantes', () => {
    const filas = filasDeRegistro(registro({ perfil: 'publico_general' }));
    expect(Object.keys(filas)).toEqual(['REG_Respuestas', 'PAR_Participantes']);
  });

  it('coloca el folio en la primera columna de cada pestaña, que es la clave de resincronización', () => {
    // De ahí se parte para volver a escribir una fila: si el folio no está
    // primero, resincronizar un registro escribe encima de otro.
    const filas = filasDeRegistro(registro());
    for (const [hoja, valores] of Object.entries(filas)) {
      for (const fila of valores) {
        expect(fila[0], hoja).toBe('REG-20260401-AB12');
      }
    }
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
    expect(fila[3]).toBe('Ponente');
    expect(fila[14]).toMatch(/^Internacional/);
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
    expect(fila[7]).toBe('=HYPERLINK("https://drive.google.com/file/d/xyz/view";"Descargar")');
    expect(fila[8]).toBe('=HYPERLINK("https://drive.google.com/file/d/abc/view";"Descargar")');
  });

  it('sin archivos, esas celdas quedan vacías en vez de con una fórmula rota', () => {
    const [fila] = filasDeRegistro(registro({})).PSE_Personificadores_Semblanzas;
    expect(fila[7]).toBe('');
    expect(fila[8]).toBe('');
  });
});
