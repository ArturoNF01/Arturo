import { describe, expect, it } from 'vitest';
import { contarPalabras, filasDeRegistro, horaPresentacion } from '@/lib/normalizacion';
import { HOJAS } from '@/lib/normalizacion';

/** Registro mínimo con los valores canónicos que guarda el formulario. */
function registro(extra: Record<string, unknown> = {}) {
  return {
    id: '11111111-2222-3333-4444-555555555555',
    folio: 'REG-20260401-AB12',
    creado_en: '2026-04-01T15:30:00.000Z',
    perfil: 'panelista',
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
    modalidad_participacion: 'ponencia_mesa',
    requiere_alojamiento: false,
    requiere_traslado: 'no',
    estado: 'en_proceso',
    consentimiento_datos: true,
    ...extra,
  };
}

describe('horaPresentacion', () => {
  it('suma el margen aéreo internacional a la llegada', () => {
    // 40 minutos de margen para llegada aérea internacional.
    expect(horaPresentacion('14:20', 'Llegada', 'Internacional', 'Aéreo')).toBe('15:00');
  });

  it('usa el margen aéreo nacional cuando el ámbito no es internacional', () => {
    expect(horaPresentacion('14:20', 'Llegada', 'Nacional', 'Aéreo')).toBe('14:40');
  });

  it('usa el margen terrestre sin importar el ámbito', () => {
    expect(horaPresentacion('09:05', 'Llegada', 'Internacional', 'Terrestre')).toBe('09:15');
  });

  it('resta el margen en las salidas', () => {
    // 180 minutos antes de un vuelo internacional.
    expect(horaPresentacion('18:00', 'Salida', 'Internacional', 'Aéreo')).toBe('15:00');
  });

  it('ajusta el paso por medianoche sin devolver horas negativas', () => {
    expect(horaPresentacion('01:00', 'Salida', 'Internacional', 'Aéreo')).toBe('22:00');
    expect(horaPresentacion('23:50', 'Llegada', 'Internacional', 'Aéreo')).toBe('00:30');
  });

  it('devuelve cadena vacía cuando el dato es insuficiente', () => {
    expect(horaPresentacion('', 'Llegada', 'Nacional', 'Aéreo')).toBe('');
    expect(horaPresentacion('sin hora', 'Llegada', 'Nacional', 'Aéreo')).toBe('');
    expect(horaPresentacion(null, 'Llegada', 'Nacional', 'Aéreo')).toBe('');
  });
});

describe('contarPalabras', () => {
  it('cuenta palabras colapsando espacios y saltos de línea', () => {
    expect(contarPalabras('  Doctora   en\n\nderecho  social ')).toBe(4);
  });

  it('devuelve cero para texto vacío o ausente', () => {
    expect(contarPalabras('')).toBe(0);
    expect(contarPalabras('   ')).toBe(0);
    expect(contarPalabras(null)).toBe(0);
  });
});

describe('filasDeRegistro', () => {
  it('siempre produce la respuesta completa y la fila de participantes', () => {
    const filas = filasDeRegistro(registro());
    expect(Object.keys(filas)).toEqual(['REG_Respuestas', 'PAR_Participantes', 'PSE_Personificadores_Semblanzas']);
  });

  it('coloca el folio en la primera columna de cada pestaña, que es la clave de resincronización', () => {
    const filas = filasDeRegistro(registro({ requiere_alojamiento: true, requiere_traslado: 'llegada_y_salida' }));
    for (const valores of Object.values(filas)) {
      for (const fila of valores) {
        expect(fila[0]).toBe('REG-20260401-AB12');
      }
    }
  });

  it('cada fila tiene tantas celdas como encabezados declara su pestaña', () => {
    const filas = filasDeRegistro(
      registro({
        requiere_alojamiento: true,
        requiere_traslado: 'llegada_y_salida',
        regimen_alimentario: 'vegano',
        alergias: 'Nueces',
      }),
    );
    for (const [hoja, valores] of Object.entries(filas)) {
      for (const fila of valores) {
        expect(fila, `pestaña ${hoja}`).toHaveLength(HOJAS[hoja].length);
      }
    }
  });

  it('traduce los valores canónicos al español para el libro de seguimiento', () => {
    const [fila] = filasDeRegistro(registro()).PAR_Participantes;
    expect(fila).toContain('Internacional');
    expect(fila).toContain('Ponencia en mesa temática');
  });

  it('omite alojamiento cuando no se solicita', () => {
    expect(filasDeRegistro(registro()).ALO_Alojamiento).toBeUndefined();
  });

  it('calcula las noches de hotel', () => {
    const [fila] = filasDeRegistro(
      registro({
        requiere_alojamiento: true,
        fecha_entrada_hotel: '2026-06-01',
        fecha_salida_hotel: '2026-06-04',
      }),
    ).ALO_Alojamiento;
    expect(fila[8]).toBe('3');
  });

  it('genera dos movimientos de traslado en llegada y salida', () => {
    const filas = filasDeRegistro(registro({ requiere_traslado: 'llegada_y_salida' }));
    expect(filas.TRA_Traslados).toHaveLength(2);
    expect(filas.TRA_Traslados[0][3]).toBe('Llegada');
    expect(filas.TRA_Traslados[1][3]).toBe('Salida');
  });

  it('genera un solo movimiento cuando sólo se pide la llegada', () => {
    const filas = filasDeRegistro(registro({ requiere_traslado: 'solo_llegada' }));
    expect(filas.TRA_Traslados).toHaveLength(1);
    expect(filas.TRA_Traslados[0][3]).toBe('Llegada');
  });

  it('calcula la hora de presentación dentro de la fila de traslado', () => {
    const filas = filasDeRegistro(
      registro({
        requiere_traslado: 'solo_llegada',
        medio_arribo: 'aereo',
        hora_llegada: '14:20',
      }),
    );
    expect(filas.TRA_Traslados[0][10]).toBe('14:20');
    expect(filas.TRA_Traslados[0][11]).toBe('15:00');
  });

  it('incluye personificador para panelistas y conferencistas aunque no declaren rol académico', () => {
    const filas = filasDeRegistro(registro({ perfil: 'conferencista', modalidad_participacion: '' }));
    expect(filas.PSE_Personificadores_Semblanzas).toBeDefined();
  });

  it('no incluye personificador para un espectador', () => {
    const filas = filasDeRegistro(
      registro({ perfil: 'espectador_presencial', modalidad_participacion: 'asistente' }),
    );
    expect(filas.PSE_Personificadores_Semblanzas).toBeUndefined();
  });

  it('cuenta las palabras de la semblanza en la pestaña de personificadores', () => {
    const [fila] = filasDeRegistro(
      registro({ semblanza: 'Investigadora en seguridad social y políticas de cuidado.' }),
    ).PSE_Personificadores_Semblanzas;
    expect(fila[11]).toBe(8);
    expect(fila[12]).toBe(60);
  });

  it('registra restricciones alimentarias sólo cuando existen', () => {
    expect(filasDeRegistro(registro({ regimen_alimentario: 'sin_restriccion' })).ALI_Restricciones)
      .toBeUndefined();
    expect(filasDeRegistro(registro({ regimen_alimentario: 'vegano' })).ALI_Restricciones)
      .toBeDefined();
    expect(
      filasDeRegistro(registro({ regimen_alimentario: 'sin_restriccion', alergias: 'Mariscos' }))
        .ALI_Restricciones,
    ).toBeDefined();
  });
});
