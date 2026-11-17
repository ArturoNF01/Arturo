import { describe, expect, it } from 'vitest';
import {
  ENCABEZADOS_DE_COTEJO, coincidenciaDeTitulos, cotejarPonentes, filasDeCotejoParaLaHoja, type RegistroParaCotejo,
} from '@/lib/cotejo-ponentes';
import { MESAS, type Mesa } from '@/lib/programa';

/**
 * El cotejo de los ponentes de la agenda con los registros: quién ya es ponente, quién se registró como público general
 * (y se cambia a ponente), quién no está, y qué ponentes registrados no salen en la agenda. Cambiar el perfil de una persona
 * equivocada es peor que dejarla para que alguien lo revise, así que todo lo dudoso se queda sin cambiar.
 */

const registro = (n: number, nombre: string, perfil = 'ponente', extra: Partial<RegistroParaCotejo> = {}): RegistroParaCotejo => ({
  id: `r-${n}`, folio: `F-${String(n).padStart(3, '0')}`, nombre, correo: `persona${n}@x.org`, perfil, estado: 'confirmado',
  titulo_ponencia: null, eje_tematico: null, ...extra,
});

/** Los autores de la agenda, una vez cada uno, tal como están escritos. */
const autoresDeLaAgenda = [...new Set(MESAS.flatMap((m) => m.ponencias.flatMap((p) => p.autores)))];

const mesaDePrueba = (numero: number, ...ponencias: [titulo: string, ...autores: string[]][]): Pick<Mesa, 'numero' | 'ponencias'> => ({
  numero,
  ponencias: ponencias.map(([titulo, ...autores]) => ({ titulo, autores, pais: 'mx' as const, participacion: 'presencial' as const })),
});

describe('los títulos', () => {
  it('el mismo título, sin acentos, signos ni mayúsculas, coincide', () => {
    expect(coincidenciaDeTitulos('¿ES LA PGU CHILENA UN MODELO EXPORTABLE?', 'Es la PGU chilena un modelo exportable')).toBe('si');
  });

  it('uno abreviado o con un cambio pequeño es «parecido»', () => {
    const agenda = 'Reducción de jornada laboral y seguridad social en México ¿qué nos dice la evidencia antes de que empiece la cuenta regresiva?';
    expect(coincidenciaDeTitulos('Reducción de jornada laboral y seguridad social en México: qué nos dice la evidencia', agenda)).toBe('parecido');
  });

  it('otro tema es «no», y sin título es «sin_titulo»', () => {
    expect(coincidenciaDeTitulos('Cuidados de largo plazo en Uruguay', 'Modelado markoviano de aportes previsionales con estados enriquecidos.')).toBe('no');
    expect(coincidenciaDeTitulos('   ', 'Lo que sea')).toBe('sin_titulo');
    expect(coincidenciaDeTitulos(null, 'Lo que sea')).toBe('sin_titulo');
  });
});

describe('con la agenda de verdad', () => {
  it('hay una fila por cada autor de cada ponencia, y quien tiene dos ponencias cuenta una vez', () => {
    const c = cotejarPonentes(MESAS, []);
    expect(c.filas).toHaveLength(MESAS.flatMap((m) => m.ponencias.flatMap((p) => p.autores)).length);
    expect(c.resumen).toMatchObject({ mesas: 11, ponencias: 45, autores: autoresDeLaAgenda.length, sinRegistro: autoresDeLaAgenda.length });
    expect(autoresDeLaAgenda.length).toBe(69);
  });

  it('si todos los autores están registrados como ponentes, no hay nada que cambiar ni nadie fuera de la agenda', () => {
    const c = cotejarPonentes(MESAS, autoresDeLaAgenda.map((a, i) => registro(i + 1, a)));
    expect(c.resumen).toMatchObject({ autores: 69, yaPonentes: 69, porCambiar: 0, sinRegistro: 0, dudosos: 0, ponentesFueraDeAgenda: 0, ponentesDespues: 69 });
    expect(c.cambios).toEqual([]);
  });

  it('quien se registró como público general se cambia a ponente; el total de ponentes sube en uno por cada cambio', () => {
    const registros = autoresDeLaAgenda.map((a, i) => registro(i + 1, a, i < 3 ? 'publico_general' : 'ponente'));
    const c = cotejarPonentes(MESAS, registros);
    expect(c.resumen).toMatchObject({ yaPonentes: 66, porCambiar: 3, ponentesRegistrados: 66, ponentesDespues: 69 });
    expect(c.cambios.map((x) => x.registro.id)).toEqual(['r-1', 'r-2', 'r-3']);
    expect(c.cambios[0].autor).toBe(autoresDeLaAgenda[0]);
  });

  it('se reconoce aunque se haya registrado con acentos, mayúsculas, otro orden, un segundo apellido o iniciales de más', () => {
    const c = cotejarPonentes(MESAS, [
      registro(1, 'LUIS FELIPE PEREZ GOMEZ', 'publico_general'),
      registro(2, 'Hormazábal Soledad', 'publico_general'),
      registro(3, 'Luis Alberto Huamán Ordóñez', 'publico_general'), // el programa dice «L. Alberto»
      registro(4, 'Sebastián Grillo Pérez', 'publico_general'), // con un apellido más
    ]);
    expect(c.cambios.map((x) => x.registro.id).sort()).toEqual(['r-1', 'r-2', 'r-3', 'r-4']);
    const huaman = c.filas.find((f) => f.autor.startsWith('L. Alberto'))!;
    expect(huaman).toMatchObject({ resultado: 'cambiar', calce: 'parcial' });
    expect(c.filas.find((f) => f.autor === 'Luis Felipe Pérez Gómez')).toMatchObject({ resultado: 'cambiar', calce: 'igual' });
  });

  it('un nombre corto que cabe en uno largo no basta: «María López» no es «María Luisa Mussot López»', () => {
    const c = cotejarPonentes(MESAS, [registro(1, 'María López', 'publico_general')]);
    expect(c.cambios).toEqual([]);
    expect(c.filas.find((f) => f.autor === 'María Luisa Mussot López')!.resultado).toBe('sin_registro');
  });
});

describe('qué se hace con cada autor', () => {
  const mesas = [mesaDePrueba(1, ['Título A', 'Ana María López Ruiz', 'Luis Pérez'], ['Título B', 'Eva Mora Díaz'], ['Título C', 'Sergio Cano Vela'])];

  it('quien tiene otro perfil (moderador, conferencista…) se dice, pero no se cambia: perdería ese papel', () => {
    const c = cotejarPonentes(mesas, [registro(1, 'Eva Mora Díaz', 'moderador')]);
    expect(c.filas.find((f) => f.autor === 'Eva Mora Díaz')).toMatchObject({ resultado: 'otro_perfil' });
    expect(c.cambios).toEqual([]);
  });

  it('un registro cancelado se dice, y no se cambia', () => {
    const c = cotejarPonentes(mesas, [registro(1, 'Eva Mora Díaz', 'publico_general', { estado: 'cancelado' })]);
    expect(c.filas.find((f) => f.autor === 'Eva Mora Díaz')).toMatchObject({ resultado: 'cancelado' });
    expect(c.cambios).toEqual([]);
  });

  it('un registro vigente le gana a uno cancelado de la misma persona', () => {
    const c = cotejarPonentes(mesas, [
      registro(1, 'Eva Mora Díaz', 'publico_general', { estado: 'cancelado' }),
      registro(2, 'Eva Mora Díaz', 'publico_general'),
    ]);
    expect(c.cambios.map((x) => x.registro.id)).toEqual(['r-2']);
  });

  it('quien no está registrado, no está: se dice y no se inventa', () => {
    const c = cotejarPonentes(mesas, [registro(1, 'Eva Mora Díaz')]);
    expect(c.filas.find((f) => f.autor === 'Sergio Cano Vela')).toMatchObject({ resultado: 'sin_registro', registro: null });
    expect(c.resumen.sinRegistro).toBe(3); // Ana, Luis y Sergio; Eva sí está (son cuatro autores)
  });

  it('si la misma persona se registró dos veces, una de ponente y otra de público general, ya es ponente y no se cambia el otro registro (no saldrían dos)', () => {
    const c = cotejarPonentes(mesas, [registro(1, 'Eva Mora Díaz', 'ponente'), registro(2, 'Eva Mora Díaz', 'publico_general')]);
    const fila = c.filas.find((f) => f.autor === 'Eva Mora Díaz')!;
    expect(fila.resultado).toBe('ya_ponente');
    expect(fila.registro?.id).toBe('r-1');
    expect(fila.otros.map((o) => o.id)).toEqual(['r-2']);
    expect(c.cambios).toEqual([]);
    expect(c.resumen.ponentesDespues).toBe(1);
  });

  it('si podría ser más de un registro y ninguno es de ponente, no se elige: se enseñan los candidatos', () => {
    const c = cotejarPonentes(mesas, [registro(1, 'Ana María López Ruiz Soto', 'publico_general'), registro(2, 'Ana María López Ruiz Vega', 'publico_general')]);
    const fila = c.filas.find((f) => f.autor === 'Ana María López Ruiz')!;
    expect(fila.resultado).toBe('dudoso');
    expect(fila.candidatos.map((x) => x.id)).toEqual(['r-1', 'r-2']);
    expect(c.cambios).toEqual([]);
  });

  it('un mismo registro que piden dos autores distintos no se cambia a ninguno de los dos', () => {
    const dos = [mesaDePrueba(1, ['Título A', 'José Luis Martínez Pérez'], ['Título B', 'José Luis Martínez Pérez Soto'])];
    const c = cotejarPonentes(dos, [registro(1, 'José Luis Martínez Pérez Soto Rojas', 'publico_general')]);
    expect(c.cambios).toEqual([]);
    expect(c.filas.map((f) => f.resultado)).toEqual(['dudoso', 'dudoso']);
  });

  it('un nombre corto no se toma por el de la agenda: se reconoce sólo el registro que es igual, aunque esté cancelado', () => {
    const c = cotejarPonentes(mesas, [registro(1, 'Eva Mora', 'publico_general'), registro(2, 'Eva Mora Díaz', 'publico_general', { estado: 'cancelado' })]);
    // «Eva Mora» tiene menos palabras que el programa y no llega a tres: no se reconoce; el otro sí es igual, pero está cancelado.
    expect(c.filas.find((f) => f.autor === 'Eva Mora Díaz')).toMatchObject({ resultado: 'cancelado' });
  });
});

describe('los temas de las ponencias', () => {
  const mesas = [mesaDePrueba(1, ['Reformas pensionales subsidiarias del sistema de capitalización individual', 'Eva Mora Díaz'])];

  it('el título que se registró se compara con el de la agenda', () => {
    const cuando = (titulo: string | null) =>
      cotejarPonentes(mesas, [registro(1, 'Eva Mora Díaz', 'ponente', { titulo_ponencia: titulo })]).filas[0].titulo;
    expect(cuando('Reformas pensionales subsidiarias del sistema de capitalización individual.')).toBe('si');
    expect(cuando('Reformas pensionales subsidiarias de la capitalización individual')).toBe('parecido');
    expect(cuando('Otro tema que no tiene nada que ver')).toBe('no');
    expect(cuando(null)).toBe('sin_titulo');
  });

  it('el resumen cuenta cómo están los títulos', () => {
    const c = cotejarPonentes(mesas, [registro(1, 'Eva Mora Díaz', 'ponente', { titulo_ponencia: 'Reformas pensionales subsidiarias del sistema de capitalización individual' })]);
    expect(c.resumen.titulos).toEqual({ si: 1, parecido: 0, no: 0, sin_titulo: 0 });
  });

  it('quien no tiene registro no tiene título que comparar', () => {
    expect(cotejarPonentes(mesas, []).filas[0].titulo).toBeNull();
  });
});

describe('los ponentes que la agenda no menciona', () => {
  const mesas = [mesaDePrueba(3, ['Cuidados de largo plazo y protección social en Uruguay', 'Eva Mora Díaz'])];

  it('un ponente registrado que no es autor de ninguna ponencia se enseña aparte', () => {
    const c = cotejarPonentes(mesas, [registro(1, 'Eva Mora Díaz'), registro(2, 'Persona Que No Sale', 'ponente')]);
    expect(c.soloRegistrados.map((s) => s.registro.id)).toEqual(['r-2']);
    expect(c.resumen).toMatchObject({ ponentesRegistrados: 2, ponentesFueraDeAgenda: 1 });
  });

  it('si su título se parece al de una ponencia de la agenda, se dice cuál: puede ser un coautor o alguien que escribió distinto su nombre', () => {
    const c = cotejarPonentes(mesas, [
      registro(2, 'Persona Que No Sale', 'ponente', { titulo_ponencia: 'Cuidados de largo plazo y protección social en Uruguay' }),
    ]);
    expect(c.soloRegistrados[0].parecidas).toEqual([
      { mesa: 3, titulo: 'Cuidados de largo plazo y protección social en Uruguay', autores: ['Eva Mora Díaz'], coincidencia: 'si' },
    ]);
  });

  it('quien es de público general y no es autor no es asunto del cotejo', () => {
    const c = cotejarPonentes(mesas, [registro(1, 'Alguien Del Público', 'publico_general')]);
    expect(c.soloRegistrados).toEqual([]);
    expect(c.cambios).toEqual([]);
  });

  it('un ponente con el registro cancelado también cuenta entre los registrados (como el conteo de la hoja de registro)', () => {
    const c = cotejarPonentes(mesas, [registro(1, 'Eva Mora Díaz', 'ponente', { estado: 'cancelado' })]);
    expect(c.resumen.ponentesRegistrados).toBe(1);
  });
});

describe('las filas de la hoja', () => {
  const perfil = (clave: string) => ({ ponente: 'Ponente', publico_general: 'Público general', moderador: 'Moderador' })[clave] ?? clave;
  const mesas = [mesaDePrueba(1, ['Título A', 'Ana María López Ruiz'], ['Título B', 'Eva Mora Díaz'], ['Título C', 'Sergio Cano Vela'])];
  const registros = [
    registro(1, 'Ana María López Ruiz', 'publico_general', { titulo_ponencia: 'Título A' }),
    registro(2, 'Eva Mora Díaz', 'ponente'),
    registro(3, 'Persona Que No Sale', 'ponente', { titulo_ponencia: 'Título C' }),
  ];

  it('cada fila trae una celda por título; primero los autores de la agenda y después los ponentes fuera de ella', () => {
    const filas = filasDeCotejoParaLaHoja(cotejarPonentes(mesas, registros), perfil);
    expect(filas.every((f) => f.length === ENCABEZADOS_DE_COTEJO.length)).toBe(true);
    expect(filas.map((f) => f[5])).toEqual([
      'Se registró como público general: cambiar a ponente',
      'Ya es ponente',
      'No está registrado',
      'Ponente registrado que no figura en la agenda',
    ]);
    expect(filas[0].slice(0, 3)).toEqual([1, 'Título A', 'Ana María López Ruiz']);
    expect(filas[0].slice(6, 13)).toEqual(['Ana María López Ruiz', 'persona1@x.org', 'F-001', 'Público general', 'confirmado', 'Título A', 'Sí']);
  });

  it('lo que acaba de cambiarse sale ya como ponente, con la nota de que se cambió', () => {
    const c = cotejarPonentes(mesas, registros.map((r) => (r.id === 'r-1' ? { ...r, perfil: 'ponente' } : r)));
    const filas = filasDeCotejoParaLaHoja(c, perfil, new Set(['r-1']));
    expect(filas[0][5]).toBe('Se registró como público general: ya se cambió a ponente');
    expect(filas[0][9]).toBe('Ponente');
  });

  it('el ponente que la agenda no menciona dice a qué ponencia se parece su título', () => {
    const filas = filasDeCotejoParaLaHoja(cotejarPonentes(mesas, registros), perfil);
    const solo = filas.at(-1)!;
    expect(solo[6]).toBe('Persona Que No Sale');
    expect(solo[13]).toMatch(/mesa 1: «Título C» \(Sergio Cano Vela\)/);
  });

  it('un nombre que sólo se parece al de la agenda lleva la nota de que hay que confirmarlo', () => {
    const c = cotejarPonentes(mesas, [registro(1, 'Ana María López Ruiz Soto', 'publico_general')]);
    expect(filasDeCotejoParaLaHoja(c, perfil)[0][13]).toMatch(/confirmar que es la misma persona/);
  });
});
