import { describe, expect, it } from 'vitest';
import { SEPARADOR_DE_PONENCIAS, autoresDe, ponenciasDeLaPersona, ponenciasParaLaHoja } from '@/lib/ponentes';
import { MESAS, type Mesa } from '@/lib/programa';

/**
 * Reconocer, por su nombre, a quien presentó una ponencia del programa: es lo que llena la columna «Ponencia» de la hoja de
 * las constancias. Un título equivocado sale impreso en una constancia, así que se prefiere una celda en blanco a una duda.
 */

/** Unas mesas de mentira, para ver lo que no se puede forzar con el programa de verdad (las dudas entre dos autores). */
const mesa = (numero: number, ...ponencias: [titulo: string, ...autores: string[]][]): Pick<Mesa, 'numero' | 'ponencias'> => ({
  numero,
  ponencias: ponencias.map(([titulo, ...autores]) => ({ titulo, autores, pais: 'mx' as const })),
});
const titulos = (nombre: string, autores: ReturnType<typeof autoresDe>) => ponenciasDeLaPersona(nombre, autores).map((p) => p.titulo);

describe('con el programa de verdad', () => {
  const ponencias = MESAS.flatMap((m) => m.ponencias.map((p) => ({ ...p, mesa: m.numero })));

  it('cada autor del programa se reconoce a sí mismo, con todas las ponencias en que figura', () => {
    const nombres = new Set(ponencias.flatMap((p) => p.autores));
    expect(nombres.size).toBeGreaterThan(60);
    for (const nombre of nombres) {
      const propias = ponenciasDeLaPersona(nombre);
      const enQueFigura = ponencias.filter((p) => p.autores.includes(nombre));
      // Ninguna se queda fuera, y ninguna es de otro: su nombre figura en cada una de las que se le dan.
      expect(propias.map((p) => p.titulo), nombre).toEqual(enQueFigura.map((p) => p.titulo));
    }
  });

  it('quien figura en varias ponencias las trae todas', () => {
    expect(ponenciasDeLaPersona('Nuria Ape').map((p) => p.mesa)).toEqual([3, 8]);
    expect(ponenciasDeLaPersona('Leticia Martínez Martiñón').map((p) => p.mesa)).toEqual([6, 11]);
    expect(ponenciasDeLaPersona('Julia Tamara Toyos')).toHaveLength(2); // dos ponencias, las dos en la mesa 5
  });

  it('no importan las mayúsculas, los acentos ni el orden de las palabras', () => {
    const esperado = ponenciasDeLaPersona('Luis Felipe Pérez Gómez');
    expect(esperado).toHaveLength(1);
    expect(ponenciasDeLaPersona('LUIS FELIPE PEREZ GOMEZ')).toEqual(esperado);
    expect(ponenciasDeLaPersona('Pérez Gómez, Luis Felipe')).toEqual(esperado);
  });

  it('el guion no separa un apellido de otro pero tampoco estorba: «García-Hernández» y «García Hernández» son lo mismo', () => {
    expect(ponenciasDeLaPersona('Hector Garcia Hernandez')).toEqual(ponenciasDeLaPersona('Héctor García-Hernández'));
    expect(ponenciasDeLaPersona('Hector Garcia Hernandez')).toHaveLength(2);
  });

  it('una inicial del programa vale por el nombre completo («L. Alberto» es «Luis Alberto»)', () => {
    const titulo = ponenciasDeLaPersona('Luis Alberto Huamán Ordóñez');
    expect(titulo).toHaveLength(1);
    expect(titulo).toEqual(ponenciasDeLaPersona('L. Alberto Huamán Ordoñez'));
    expect(ponenciasDeLaPersona('Valeria Isabel Torrijos García')).toHaveLength(1);
  });

  it('quien escribió de más —los dos apellidos donde el programa pone uno— sí coincide', () => {
    expect(ponenciasDeLaPersona('Sebastián Grillo Pérez')).toEqual(ponenciasDeLaPersona('Sebastian Grillo'));
    expect(ponenciasDeLaPersona('Sebastián Grillo Pérez')).toHaveLength(1);
  });

  it('una partícula no cuenta: «de» y «del» pueden estar o no', () => {
    expect(ponenciasDeLaPersona('Paulo Henrique Almeida Rodriguez')).toEqual(ponenciasDeLaPersona('Paulo Henrique de Almeida Rodriguez'));
    expect(ponenciasDeLaPersona('Paulo Henrique Almeida Rodriguez')).toHaveLength(1);
  });

  it('quien escribió menos palabras que el programa necesita tres: «María López» no es «María Luisa Mussot López»', () => {
    expect(ponenciasDeLaPersona('María Luisa Mussot López')).toHaveLength(1);
    expect(ponenciasDeLaPersona('María López')).toEqual([]);
    expect(ponenciasDeLaPersona('María Mussot López')).toHaveLength(1); // tres palabras: sí
  });

  it('quien no figura en el programa no trae nada', () => {
    for (const nombre of ['', 'Ana', 'Ana Pérez', 'Juan Nadie Pérez', 'J. Pérez', '   ']) {
      expect(ponenciasDeLaPersona(nombre), nombre).toEqual([]);
    }
  });

  it('para la hoja: los títulos tal cual, juntos con el separador; en blanco si no figura', () => {
    const [primera, segunda] = ponenciasDeLaPersona('Nuria Ape');
    expect(ponenciasParaLaHoja('Nuria Ape')).toBe(`${primera.titulo}${SEPARADOR_DE_PONENCIAS}${segunda.titulo}`);
    expect(ponenciasParaLaHoja('Sebastian Grillo')).toBe('Modelado markoviano de aportes previsionales con estados enriquecidos.');
    expect(ponenciasParaLaHoja('Nadie De Aquí')).toBe('');
    // El separador no está en ningún título: el contenido de una celda se puede volver a partir.
    for (const p of ponencias) expect(p.titulo).not.toContain(SEPARADOR_DE_PONENCIAS.trim());
  });
});

describe('cuando se podría confundir a dos autores', () => {
  const autores = autoresDe([
    mesa(1, ['Título A', 'Ana María López Ruiz', 'Luis Pérez'], ['Título B', 'Ana María López Soto']),
    mesa(2, ['Título C', 'Ana María López Ruiz']),
  ]);

  it('si coincide por completo con uno, es ése aunque otro también cupiera', () => {
    expect(titulos('Ana María López Ruiz', autores)).toEqual(['Título A', 'Título C']);
    expect(titulos('Ana María López Soto', autores)).toEqual(['Título B']);
  });

  it('si coincide a medias con dos autores distintos no se adivina: en blanco', () => {
    // «Ana María López» (tres palabras) cabe en los dos, y no es ninguno de los dos.
    expect(titulos('Ana María López', autores)).toEqual([]);
  });

  it('si a medias coincide con uno solo, es ése', () => {
    expect(titulos('Luis Pérez Gómez', autores)).toEqual(['Título A']);
  });

  it('un mismo autor en dos ponencias es un solo autor, no una duda', () => {
    expect(autores).toHaveLength(3);
    expect(titulos('Ana María López Ruiz', autores)).toHaveLength(2);
  });

  it('las ponencias salen en el orden del programa, por mesa', () => {
    const al_reves = autoresDe([mesa(2, ['Segunda', 'Eva Mora Díaz']), mesa(1, ['Primera', 'Eva Mora Díaz'])]);
    // El programa se recorre como viene: quien lo escribe lo pone en orden de mesa.
    expect(titulos('Eva Mora Díaz', al_reves)).toEqual(['Segunda', 'Primera']);
  });
});
