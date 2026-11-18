import { describe, expect, it } from 'vitest';
import { filasDePersonas, type FilaDeAsistencia, type RegistroDePonente } from '@/lib/asistencia';
import { ENCABEZADOS_DE_REPETIDOS, filasDeRepetidosParaLaHoja, revisarRepetidos } from '@/lib/repetidos';

/**
 * La revisión de los repetidos de «Asistencia por persona»: quién sale en más de una fila con el mismo nombre o el mismo correo, y
 * qué riesgo corre la constancia. Sólo reglas: lo que toca la hoja está en hoja-repetidos.prueba.ts.
 */

/** Una asistencia. Con `registro` está ligada a ese registro; sin él, queda «sin registro». */
const de = (sesion: string, nombre: string, correo: string, registro: string | null, extra: Partial<FilaDeAsistencia> = {}): FilaDeAsistencia => ({
  id: `${sesion}-${correo}`, sesion, via: 'presencial', registro_id: registro, nombre, correo, perfil: registro ? 'publico_general' : null, folio: null,
  creada_en: '2026-11-12T20:00:00Z', estado_registro: registro ? 'confirmado' : null, ...extra,
});
const ponente = (n: number, nombre: string, correo = `ponente${n}@x.org`, extra: Partial<RegistroDePonente> = {}): RegistroDePonente => ({
  id: `rp-${n}`, nombre, correo, perfil: 'ponente', folio: `F-${n}`, estado: 'confirmado', ...extra,
});

describe('quién sale más de una vez', () => {
  it('sin repetidos, nada: ni casos ni cuentas', () => {
    const r = revisarRepetidos(
      [de('jueves', 'Ana Ruiz', 'ana@x.org', 'r1'), de('jueves', 'Luis Pérez', 'luis@x.org', 'r2')],
      [ponente(1, 'Eva Mora')],
    );
    expect(r.casos).toEqual([]);
    expect(r.resumen).toEqual({
      filas: 3, nombresRepetidos: 0, correosRepetidos: 0, casos: 0, dosConstancias: 0, diasRepartidos: 0, sinRegistro: 0, sinRiesgo: 0,
    });
  });

  it('el mismo nombre en dos registros vigentes con otro correo: saldrían dos constancias', () => {
    const r = revisarRepetidos(
      [de('miercoles', 'Ana Ruiz', 'ana@casa.org', 'r1'), de('jueves', 'Luis Pérez', 'luis@x.org', 'r2'), de('jueves', 'Ana Ruiz', 'ana@trabajo.org', 'r3')],
      [],
    );
    expect(r.casos).toHaveLength(1);
    const [caso] = r.casos;
    expect(caso).toMatchObject({ numero: 1, motivos: ['nombre'], riesgo: 'dos_constancias' });
    expect(caso.filas.map((f) => f.numero)).toEqual([1, 3]); // los N.º de la pestaña, no el orden en la lista
    expect(caso.filas.every((f) => f.conRegistro)).toBe(true);
    expect(caso.sugerencia).toMatch(/filas 1 y 3 llevan «Con registro» marcado/);
    expect(caso.sugerencia).toMatch(/cancele el que sobre en el panel/);
    expect(r.resumen).toMatchObject({ nombresRepetidos: 1, correosRepetidos: 0, casos: 1, dosConstancias: 1 });
  });

  it('el nombre se reconoce sin acentos, sin mayúsculas y sin importar el orden de las palabras', () => {
    const r = revisarRepetidos(
      [de('jueves', 'José Pérez Ruiz', 'jose@x.org', 'r1'), de('jueves', 'RUIZ PEREZ, JOSE', 'jr@y.org', 'r2')],
      [],
    );
    expect(r.casos).toHaveLength(1);
    expect(r.casos[0].filas.map((f) => f.nombre)).toEqual(['José Pérez Ruiz', 'RUIZ PEREZ, JOSE']);
  });

  it('una asistencia «sin registro» con el nombre de alguien registrado reparte sus días: se avisa, sin riesgo de dos constancias', () => {
    const r = revisarRepetidos(
      [
        de('miercoles', 'Ana Ruiz', 'ana@x.org', 'r1'),
        de('jueves', 'Ana Ruiz', 'ana.otro@y.org', null),
        de('viernes', 'Ana Ruiz', 'ana.otro@y.org', null),
      ],
      [],
    );
    const [caso] = r.casos;
    expect(caso.riesgo).toBe('dias_repartidos');
    expect(caso.filas.map((f) => [f.numero, f.conRegistro, f.ligada, f.total])).toEqual([[1, true, true, 1], [2, false, false, 2]]);
    expect(caso.filas[0].accion).toBe('Registro vigente: es la que lleva la constancia');
    expect(caso.filas[1].accion).toBe('Asistencia sin registro: si es la misma persona, ligarla al registro de la fila 1');
    expect(caso.sugerencia).toMatch(/repartida entre las filas 1 y 2: el total de la fila 1 no la suma toda/);
    // Una asistencia suelta se liga a su registro desde el panel.
    expect(caso.sugerencia).toMatch(/ligue en el panel \(Asistencia → Por día → «Ligar a un registro»\) la asistencia suelta de la fila 2 al registro de la fila 1/);
    expect(r.resumen).toMatchObject({ casos: 1, dosConstancias: 0, diasRepartidos: 1 });
  });

  it('el mismo correo en un registro cancelado y en el vigente se junta aunque los nombres difieran, y lo cancelado no recibe constancia', () => {
    const r = revisarRepetidos(
      [
        de('miercoles', 'Ana Ruiz', 'ana@x.org', 'r1', { estado_registro: 'cancelado' }),
        de('jueves', 'Ana Ruiz Soto', 'ana@x.org', 'r2'),
      ],
      [],
    );
    const [caso] = r.casos;
    expect(caso.motivos).toEqual(['correo']);
    expect(caso.riesgo).toBe('dias_repartidos'); // el cancelado asistió: sus días no cuentan para el vigente
    expect(caso.filas.map((f) => f.conRegistro)).toEqual([false, true]);
    expect(caso.filas[0].accion).toBe('Registro cancelado: no recibe constancia, y sus días no se suman a la fila 2');
    // Los días de un registro cancelado no se pueden ligar: se anotan a mano en el vigente.
    expect(caso.sugerencia).toMatch(/los días de la fila 1, de un registro cancelado, no se suman: anótelos a mano en el registro de la fila 2 \(panel → «Registrar a mano»\)/);
    expect(caso.sugerencia).not.toMatch(/Ligar a un registro/);
    expect(r.resumen).toMatchObject({ nombresRepetidos: 0, correosRepetidos: 1, casos: 1 });
  });

  it('si hay días en una asistencia suelta y en un registro cancelado, se dicen los dos pasos', () => {
    const r = revisarRepetidos(
      [
        de('miercoles', 'Ana Ruiz', 'ana@x.org', 'r1', { estado_registro: 'cancelado' }),
        de('jueves', 'Ana Ruiz', 'ana.otra@y.org', null),
        de('viernes', 'Ana Ruiz', 'ana2@x.org', 'r3'),
      ],
      [],
    );
    const [caso] = r.casos;
    expect(caso.riesgo).toBe('dias_repartidos');
    expect(caso.sugerencia).toMatch(/ligue en el panel .* la asistencia suelta de la fila 2 al registro de la fila 3, y los días de la fila 1, de un registro cancelado/);
  });

  it('el correo se compara sin mayúsculas ni espacios de más', () => {
    const r = revisarRepetidos(
      [de('jueves', 'Ana Ruiz', 'Ana@X.org', 'r1'), de('jueves', 'Eva Mora', ' ana@x.org ', 'r2')],
      [],
    );
    expect(r.casos).toHaveLength(1);
    expect(r.casos[0].motivos).toEqual(['correo']);
  });

  it('un ponente cancelado sin asistencia que repite el nombre de uno vigente no es riesgo: no lleva asistencia ni constancia', () => {
    const r = revisarRepetidos(
      [],
      [ponente(1, 'Luis Pérez', 'luis@x.org', { estado: 'cancelado' }), ponente(2, 'Luis Pérez', 'luis2@x.org')],
    );
    const [caso] = r.casos;
    expect(caso.riesgo).toBe('sin_riesgo');
    expect(caso.filas.map((f) => [f.numero, f.conRegistro])).toEqual([[1, false], [2, true]]);
    expect(caso.sugerencia).toBe('Sólo la fila 2 tiene registro vigente y las demás no llevan asistencia: no sale más de una constancia.');
  });

  it('dos registros de ponente con el mismo nombre, sin asistencia, son dos constancias', () => {
    const r = revisarRepetidos([], [ponente(1, 'Luis Pérez', 'luis@x.org'), ponente(2, 'Luis Pérez', 'luis2@x.org')]);
    expect(r.casos[0]).toMatchObject({ riesgo: 'dos_constancias', motivos: ['nombre'] });
  });

  it('los ponentes que no registraron asistencia también cuentan: un ponente y una asistencia suelta con su nombre', () => {
    const r = revisarRepetidos([de('jueves', 'Luis Pérez', 'otro@typo.org', null)], [ponente(1, 'Luis Pérez')]);
    const [caso] = r.casos;
    expect(caso.riesgo).toBe('dias_repartidos');
    expect(caso.filas.map((f) => [f.numero, f.perfil, f.total])).toEqual([[1, null, 1], [2, 'ponente', 0]]);
    // La asistencia suelta se liga al registro del ponente.
    expect(caso.filas[0].accion).toMatch(/ligarla al registro de la fila 2/);
  });

  it('nadie con registro vigente: ninguna recibiría constancia, y se dice por si alguien sí debería', () => {
    const r = revisarRepetidos([de('jueves', 'Pedro Soto', 'p1@x.org', null), de('viernes', 'Pedro Soto', 'p2@y.org', null)], []);
    const [caso] = r.casos;
    expect(caso.riesgo).toBe('sin_registro');
    expect(caso.filas.map((f) => f.accion)).toEqual([
      'Asistencia sin registro: si la persona está registrada, ligarla a su registro',
      'Asistencia sin registro: si la persona está registrada, ligarla a su registro',
    ]);
    expect(caso.sugerencia).toMatch(/Ninguna de las filas 1 y 2 tiene registro vigente/);
  });

  it('lo que comparte nombre con una fila y correo con otra es un solo caso, con los dos motivos', () => {
    const r = revisarRepetidos(
      [
        de('jueves', 'Ana Ruiz', 'ana@casa.org', 'r1'),
        de('jueves', 'Ana Ruiz', 'ana@trabajo.org', 'r2'), // el mismo nombre que la 1
        de('jueves', 'A. Ruiz Soto', 'ana@trabajo.org', 'r3'), // el mismo correo que la 2
        de('jueves', 'Luis Pérez', 'luis@x.org', 'r4'),
      ],
      [],
    );
    expect(r.casos).toHaveLength(1);
    expect(r.casos[0].motivos).toEqual(['nombre', 'correo']);
    expect(r.casos[0].filas.map((f) => f.numero)).toEqual([1, 2, 3]);
    // Se cuentan los nombres y los correos repetidos por separado, aunque sea un solo caso.
    expect(r.resumen).toMatchObject({ nombresRepetidos: 1, correosRepetidos: 1, casos: 1 });
  });

  it('los casos salen de más a menos urgente, y entre iguales por el N.º de su primera fila; el número de caso sigue ese orden', () => {
    const r = revisarRepetidos(
      [
        de('jueves', 'Sin Riesgo Uno', 'sr1@x.org', 'r1', { estado_registro: 'cancelado' }), // 1: un registro cancelado que asistió
        de('jueves', 'Solo Suelta', 'ss1@x.org', null), // 2
        de('jueves', 'Solo Suelta', 'ss2@y.org', null), // 3: nadie con registro
        de('jueves', 'Doble Uno', 'd1@x.org', 'r4'), // 4
        de('jueves', 'Doble Uno', 'd2@y.org', 'r5'), // 5: dos constancias
        de('jueves', 'Repartida', 'rep@x.org', 'r6'), // 6
        de('jueves', 'Repartida', 'rep2@y.org', null), // 7: días repartidos
      ],
      [ponente(1, 'Sin Riesgo Uno', 'sr2@x.org')], // 8: un ponente vigente, sin asistencia, con el nombre del cancelado de la fila 1
    );
    expect(r.casos.map((c) => [c.numero, c.riesgo, c.filas[0].numero])).toEqual([
      [1, 'dos_constancias', 4],
      [2, 'dias_repartidos', 1], // el cancelado que asistió reparte los días con la ponente vigente
      [3, 'dias_repartidos', 6],
      [4, 'sin_registro', 2],
    ]);
    expect(r.resumen).toMatchObject({ casos: 4, dosConstancias: 1, diasRepartidos: 2, sinRegistro: 1, sinRiesgo: 0 });
  });

  it('la sesión de prueba no cuenta: quien sólo la escaneó no tiene fila, así que no repite a nadie', () => {
    const r = revisarRepetidos([de('prueba', 'Ana Ruiz', 'ana@x.org', 'r1'), de('jueves', 'Ana Ruiz', 'ana2@x.org', 'r2')], []);
    expect(r.casos).toEqual([]);
    expect(r.resumen.filas).toBe(1);
  });

  it('un correo o un nombre vacío no se cuentan como repetidos', () => {
    const r = revisarRepetidos([de('jueves', '', '', 'r1'), de('jueves', '', '', 'r2')], []);
    expect(r.casos).toEqual([]);
  });

  it('los N.º son los de la pestaña: la fila N de «Asistencia por persona» es la que el caso dice', () => {
    const asistentes = [
      de('jueves', 'Uno Solo', 'uno@x.org', 'r1'),
      de('jueves', 'Ana Ruiz', 'ana@x.org', 'r2'),
      de('jueves', 'Dos Solo', 'dos@x.org', 'r3'),
      de('viernes', 'Ana Ruiz', 'ana2@x.org', 'r4'),
    ];
    const ponentes = [ponente(1, 'Eva Mora'), ponente(2, 'Eva Mora', 'eva2@x.org')];
    const hoja = filasDePersonas(asistentes, undefined, undefined, ponentes);
    const r = revisarRepetidos(asistentes, ponentes);
    expect(r.casos).toHaveLength(2);
    for (const caso of r.casos) {
      for (const f of caso.filas) {
        const enLaHoja = hoja[f.numero - 1];
        expect([enLaHoja[0], enLaHoja[1], enLaHoja[2]]).toEqual([f.numero, f.nombre, f.correo]);
      }
    }
  });

  it('con la ponencia de cada quien, si se da', () => {
    const r = revisarRepetidos(
      [],
      [ponente(1, 'Luis Pérez', 'l1@x.org'), ponente(2, 'Luis Pérez', 'l2@x.org')],
      (nombre) => (nombre === 'Luis Pérez' ? 'Título de Luis' : ''),
    );
    expect(r.casos[0].filas.map((f) => f.ponencia)).toEqual(['Título de Luis', 'Título de Luis']);
  });
});

describe('las filas de la pestaña «Repetidos por revisar»', () => {
  const asistentes = [
    de('jueves', 'Ana Ruiz', 'ana@casa.org', 'r1'),
    de('viernes', 'Ana Ruiz', 'ana@trabajo.org', 'r2'),
    de('jueves', 'Pedro Soto', 'p1@x.org', null),
    de('viernes', 'Pedro Soto', 'p2@y.org', null),
  ];
  const revision = revisarRepetidos(asistentes, []);
  const etiqueta = (clave: string) => ({ publico_general: 'Público general' })[clave] ?? clave;

  it('lleva trece títulos, y cada fila trae una celda por título', () => {
    expect(ENCABEZADOS_DE_REPETIDOS).toHaveLength(13);
    const filas = filasDeRepetidosParaLaHoja(revision, etiqueta);
    expect(filas.every((f) => f.length === ENCABEZADOS_DE_REPETIDOS.length)).toBe(true);
  });

  it('cada caso va junto, con una fila en blanco entre uno y otro', () => {
    const filas = filasDeRepetidosParaLaHoja(revision, etiqueta);
    expect(filas).toHaveLength(2 + 1 + 2); // dos casos de dos filas y un separador
    expect(filas[2].every((c) => c === '')).toBe(true);
    expect(filas.map((f) => f[0])).toEqual([1, 1, '', 2, 2]);
  });

  it('el motivo, el riesgo y qué hacer con el caso van en la primera fila de cada caso; qué hacer con cada fila, en todas', () => {
    const filas = filasDeRepetidosParaLaHoja(revision, etiqueta);
    expect(filas[0].slice(0, 3)).toEqual([1, 'Mismo nombre', 'Dos constancias']);
    expect(filas[1].slice(0, 3)).toEqual([1, '', '']);
    expect(filas[0][12]).toBe(revision.casos[0].sugerencia);
    expect(filas[1][12]).toBe('');
    expect(filas[0][11]).toBe('Registro vigente: si es la misma persona y sobra, cancelarlo en el panel');
    expect(filas[3].slice(0, 3)).toEqual([2, 'Mismo nombre', 'Sin registro']);
  });

  it('cada fila lleva su N.º, nombre, correo, perfil como se lee, si tiene registro, los días y el folio', () => {
    const filas = filasDeRepetidosParaLaHoja(revision, etiqueta);
    expect(filas[0].slice(3, 11)).toEqual([1, 'Ana Ruiz', 'ana@casa.org', 'Público general', 'Sí', 1, '', '']);
    expect(filas[3].slice(3, 11)).toEqual([3, 'Pedro Soto', 'p1@x.org', '', 'No', 1, '', '']);
  });

  it('sin repetidos sólo hay títulos: ninguna fila', () => {
    expect(filasDeRepetidosParaLaHoja(revisarRepetidos([], []), etiqueta)).toEqual([]);
  });
});
