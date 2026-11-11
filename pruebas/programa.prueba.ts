import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MESAS, MESA_POR_NUMERO, PAISES, PLATAFORMA_POR_SALA, PROGRAMA, RESUMEN, SALAS, TEXTOS_PROGRAMA,
  agruparPorHorario, enlaceDe, esHibrida, plataformaDe, unirAutores, type Ponencia, type Sesion,
} from '@/lib/programa';

/**
 * El programa es una transcripción a mano de un PDF, y una errata en una hora
 * o en un número de mesa no da error en ninguna parte: sale en la página y
 * alguien entra a la sala equivocada. Estas pruebas no saben qué dice el PDF,
 * pero sí qué cuentas tienen que salir entre los propios datos, y casi toda
 * errata de transcripción rompe alguna.
 */

const IDIOMAS = ['es', 'en', 'pt'] as const;

/** «10:30–12:00» → [630, 720] minutos desde la medianoche. */
function intervalo(horario: string): [number, number] {
  const m = horario.match(/^(\d{2}):(\d{2})–(\d{2}):(\d{2})$/);
  if (!m) throw new Error(`Horario mal escrito: «${horario}»`);
  return [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])];
}

const todas = PROGRAMA.flatMap((dia) => dia.sesiones.map((s) => ({ dia, s })));

describe('el programa publicado', () => {
  it('tiene las once mesas, numeradas del 1 al 11 sin huecos', () => {
    expect(MESAS.map((m) => m.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it('cada mesa se programa exactamente una vez, y sólo mesas que existen', () => {
    const programadas = todas.filter(({ s }) => s.tipo === 'mesa').map(({ s }) => s.mesa);
    expect(programadas.every((n) => n !== undefined && MESA_POR_NUMERO.has(n))).toBe(true);
    expect([...programadas].sort((a, b) => a! - b!)).toEqual(MESAS.map((m) => m.numero));
  });

  it('las mesas 1 a 4 van el jueves y las 5 a 11 el viernes', () => {
    const dia = (n: number) => todas.find(({ s }) => s.mesa === n)!.dia.iso;
    for (const n of [1, 2, 3, 4]) expect(dia(n), `mesa ${n}`).toBe('2026-11-12');
    for (const n of [5, 6, 7, 8, 9, 10, 11]) expect(dia(n), `mesa ${n}`).toBe('2026-11-13');
  });

  it('ninguna sala tiene dos sesiones a la vez', () => {
    // La comprobación que más errores de horario atrapa: dos mesas en el
    // Auditorio al mismo tiempo no pueden ser las dos ciertas.
    for (const dia of PROGRAMA) {
      const porSala = new Map<string, [number, number, string][]>();
      for (const s of dia.sesiones) {
        if (!s.sala) continue;
        const [ini, fin] = intervalo(s.horario);
        porSala.set(s.sala, [...(porSala.get(s.sala) ?? []), [ini, fin, s.horario]]);
      }
      for (const [sala, tramos] of porSala) {
        const ordenados = [...tramos].sort((a, b) => a[0] - b[0]);
        for (let i = 1; i < ordenados.length; i++) {
          expect(
            ordenados[i][0] >= ordenados[i - 1][1],
            `${dia.iso} · ${sala}: ${ordenados[i - 1][2]} se pisa con ${ordenados[i][2]}`,
          ).toBe(true);
        }
      }
    }
  });

  it('cada día va en orden y ninguna sesión termina antes de empezar', () => {
    for (const dia of PROGRAMA) {
      let anterior = -1;
      for (const s of dia.sesiones) {
        const [ini, fin] = intervalo(s.horario);
        expect(fin, `${dia.iso} ${s.horario}`).toBeGreaterThan(ini);
        expect(ini, `${dia.iso} ${s.horario} fuera de orden`).toBeGreaterThanOrEqual(anterior);
        anterior = ini;
      }
    }
  });

  it('los tres días son el 11, el 12 y el 13 de noviembre de 2026, en orden', () => {
    expect(PROGRAMA.map((d) => d.iso)).toEqual(['2026-11-11', '2026-11-12', '2026-11-13']);
  });

  it('las cuentas que se enseñan arriba salen de los datos', () => {
    expect(RESUMEN).toEqual({ dias: 3, mesas: 11, ponencias: 45, paises: 12 });
  });

  it('cada mesa lleva las ponencias que dice el programa impreso', () => {
    // Cuatro, cinco, cinco, cuatro, cuatro, cuatro, tres, cuatro, tres, cuatro, cinco.
    // La versión anterior traía una más en la mesa 9 y otra en la 10: si alguien
    // vuelve a pegar un título retirado, esta cuenta se descuadra.
    expect(MESAS.map((m) => m.ponencias.length)).toEqual([4, 5, 5, 4, 4, 4, 3, 4, 3, 4, 5]);
  });

  it('todo país del programa tiene su bandera en public/banderas', () => {
    // Sin el archivo, la agenda enseñaría una imagen rota donde antes iba el nombre.
    for (const clave of Object.keys(PAISES)) {
      expect(existsSync(join(process.cwd(), 'public', 'banderas', `${clave}.svg`)), clave).toBe(true);
    }
  });

  it('toda sala y todo país usados existen, y toda ponencia tiene autor y título', () => {
    for (const { s } of todas) if (s.sala) expect(SALAS[s.sala], s.horario).toBeDefined();
    for (const mesa of MESAS) {
      expect(mesa.ponencias.length, `mesa ${mesa.numero}`).toBeGreaterThan(0);
      for (const p of mesa.ponencias) {
        expect(PAISES[p.pais], p.titulo).toBeDefined();
        expect(p.titulo.trim().length, `mesa ${mesa.numero}`).toBeGreaterThan(10);
        expect(p.autores.length, p.titulo).toBeGreaterThan(0);
        for (const a of p.autores) expect(a, p.titulo).toBe(a.trim());
      }
    }
  });

  it('todo lo que se traduce está en los tres idiomas, sin dejar uno en blanco', () => {
    const textos: [string, Record<string, string>][] = [
      ...Object.entries(SALAS).map(([k, v]) => [`sala ${k}`, v] as [string, Record<string, string>]),
      ...Object.entries(PAISES).map(([k, v]) => [`país ${k}`, v] as [string, Record<string, string>]),
      ...MESAS.map((m) => [`mesa ${m.numero}`, m.titulo] as [string, Record<string, string>]),
      ...PROGRAMA.flatMap((d) => [
        [`${d.iso} fecha`, d.fecha], [`${d.iso} título`, d.titulo],
        ...(d.nota ? [[`${d.iso} nota`, d.nota] as [string, Record<string, string>]] : []),
      ] as [string, Record<string, string>][]),
      ...todas.flatMap(({ s }) => [
        ...(s.actividad ? [[`${s.horario} actividad`, s.actividad] as [string, Record<string, string>]] : []),
        ...(s.participantes ?? []).map((p, i) => [`apertura participante ${i + 1}`, p.cargo] as [string, Record<string, string>]),
        ...(s.ponente ? [[`${s.horario} ponente`, s.ponente.cargo] as [string, Record<string, string>]] : []),
      ]),
    ];
    for (const [que, texto] of textos) {
      for (const idioma of IDIOMAS) {
        expect(texto[idioma]?.trim().length ?? 0, `${que} · ${idioma}`).toBeGreaterThan(0);
      }
    }
    // Y los textos de la interfaz traen las mismas claves en los tres.
    expect(Object.keys(TEXTOS_PROGRAMA.en).sort()).toEqual(Object.keys(TEXTOS_PROGRAMA.es).sort());
    expect(Object.keys(TEXTOS_PROGRAMA.pt).sort()).toEqual(Object.keys(TEXTOS_PROGRAMA.es).sort());
  });

  it('la nota del miércoles trae aparte la condición del cupo, en los tres idiomas', () => {
    const miercoles = PROGRAMA[0];
    for (const idioma of IDIOMAS) {
      expect(miercoles.nota?.[idioma]?.length, idioma).toBeGreaterThan(20);
      expect(miercoles.notaDestacada?.[idioma]?.length, idioma).toBeGreaterThan(10);
    }
  });

  it('la apertura conserva su horario y su sala, y lista los siete cargos del programa', () => {
    const apertura = todas.find(({ s }) => s.tipo === 'apertura')!.s;
    expect(apertura.horario).toBe('09:00–09:30');
    expect(apertura.sala).toBe('auditorio');
    expect(apertura.actividad?.es).toBe('Sesión de apertura');
    // El programa da cargos, no personas: presidencia y secretaría general de la CISS,
    // dirección del CIESS y las cuatro coordinaciones de mesa de la RIUSS.
    expect(apertura.participantes).toHaveLength(7);
    for (const p of apertura.participantes!) {
      expect(p.nombre, 'sin nombre hasta que el comité lo mande').toBeUndefined();
      for (const idioma of IDIOMAS) expect(p.cargo[idioma].trim().length).toBeGreaterThan(10);
    }
  });

  it('la conferencia magistral trae a su ponente, con nombre y cargo', () => {
    const conferencia = todas.find(({ s }) => s.tipo === 'conferencia')!.s;
    expect(conferencia.horario).toBe('09:30–10:30');
    expect(conferencia.ponente?.nombre).toBe('Héctor J. Villarreal');
    for (const idioma of IDIOMAS) expect(conferencia.ponente?.cargo[idioma]).toContain('Monterrey');
  });

  it('sólo la apertura lleva lista de participantes y sólo la conferencia lleva ponente', () => {
    for (const { s } of todas) {
      if (s.participantes) expect(s.tipo, s.horario).toBe('apertura');
      if (s.ponente) expect(s.tipo, s.horario).toBe('conferencia');
    }
  });

  it('cada ponencia dice si se presenta en persona o en línea, salvo tres que el programa no dice', () => {
    const todasLasPonencias = MESAS.flatMap((m) => m.ponencias);
    const cuenta = (v: string | undefined) => todasLasPonencias.filter((p) => p.participacion === v).length;
    // Del programa: 23 presenciales, 19 virtuales y 3 sin indicar (no se supone nada).
    expect(cuenta('presencial')).toBe(23);
    expect(cuenta('virtual')).toBe(19);
    expect(cuenta(undefined)).toBe(3);
    for (const p of todasLasPonencias) {
      if (p.participacion) expect(['presencial', 'virtual']).toContain(p.participacion);
    }
  });
});

describe('por dónde se entra a cada sesión', () => {
  it('el Auditorio va por Zoom y las salas de la planta baja por Meet', () => {
    expect(PLATAFORMA_POR_SALA).toEqual({ lobby: null, auditorio: 'zoom', comisiones: 'meet' });
  });

  it('cada mesa lleva la plataforma de su sala, salvo la 4: Zoom las 1, 2, 3, 4, 5, 7, 9 y 11; Meet las 6, 8 y 10', () => {
    const plataforma = (n: number) => plataformaDe(todas.find(({ s }) => s.mesa === n)!.s);
    for (const n of [1, 2, 3, 4, 5, 7, 9, 11]) expect(plataforma(n), `mesa ${n}`).toBe('zoom');
    for (const n of [6, 8, 10]) expect(plataforma(n), `mesa ${n}`).toBe('meet');
  });

  it('la mesa 4 se hace en la sala de comisiones (planta baja) pero se transmite por su propia sala de Zoom', () => {
    const mesa4 = todas.find(({ s }) => s.mesa === 4)!.s;
    expect(mesa4.sala, 'la sala no cambia').toBe('comisiones');
    expect(mesa4.horario).toBe('15:30–17:30');
    const generales = { zoom: 'https://zoom.example/general', meet: 'https://meet.example/general' };
    expect(enlaceDe(mesa4, generales)).toBe('https://us02web.zoom.us/j/82897635427');
    // Ni la sala general de Zoom ni la de Meet se la pisan, vacías o no.
    expect(enlaceDe(mesa4, { zoom: '', meet: '' })).toBe('https://us02web.zoom.us/j/82897635427');
  });

  it('el jueves por la tarde las dos salas son el Auditorio y la sala de comisiones, y no existe una «sala de sesiones»', () => {
    // El comité lo corrigió: la mesa 4 es en la sala de comisiones, planta baja. Una sala con ese otro nombre no existe.
    const jueves = PROGRAMA.find((d) => d.iso === '2026-11-12')!;
    const tarde = jueves.sesiones.filter((x) => x.horario === '15:30–17:30');
    expect(tarde.map((x) => [x.mesa, x.sala])).toEqual([[3, 'auditorio'], [4, 'comisiones']]);
    expect(SALAS.comisiones.es).toBe('Sala de comisiones, planta baja');
    for (const sala of Object.values(SALAS)) for (const texto of Object.values(sala)) expect(texto).not.toMatch(/sesion|sessi|session room/i);
  });

  it('las demás sesiones siguen entrando por el enlace general de su plataforma', () => {
    const generales = { zoom: 'https://zoom.example/general', meet: 'https://meet.example/general' };
    for (const { s } of todas) {
      if (s.mesa === 4) continue;
      expect(s.enlace, `${s.horario} ${s.tipo}`).toBeUndefined();
      const plataforma = plataformaDe(s);
      expect(enlaceDe(s, generales), `${s.horario} ${s.tipo}`).toBe(plataforma ? generales[plataforma] : '');
    }
  });

  it('un enlace propio es https y de la plataforma que dice la sesión', () => {
    for (const { s } of todas) {
      if (!s.enlace) continue;
      expect(s.enlace).toMatch(/^https:\/\//);
      if (plataformaDe(s) === 'zoom') expect(new URL(s.enlace).hostname).toMatch(/(^|\.)zoom\.us$/);
      if (plataformaDe(s) === 'meet') expect(new URL(s.enlace).hostname).toBe('meet.google.com');
    }
  });

  it('el registro y el almuerzo no llevan botón, aunque tengan sala; lo demás con sala, sí', () => {
    for (const { s } of todas) {
      if (s.tipo === 'registro' || s.tipo === 'pausa') expect(plataformaDe(s), s.horario).toBeNull();
      else expect(plataformaDe(s), `${s.horario} ${s.tipo}`).not.toBeNull();
    }
  });

  it('la apertura, la conferencia y la clausura van por Zoom, y también todo el miércoles', () => {
    for (const { s } of todas) {
      if (['apertura', 'conferencia', 'clausura'].includes(s.tipo)) expect(plataformaDe(s), s.tipo).toBe('zoom');
    }
    // El miércoles es en la sala de comisiones, que por sí sola llevaría Meet; el comité
    // pidió que todo ese día vaya por Zoom.
    const miercoles = PROGRAMA.find((d) => d.iso === '2026-11-11')!.sesiones;
    const conBoton = miercoles.filter((s) => s.tipo === 'trabajo');
    expect(conBoton).toHaveLength(5);
    for (const s of conBoton) expect(plataformaDe(s), s.actividad?.es).toBe('zoom');
    // Y el cambio es sólo de ese día: la misma sala el viernes sigue yendo por Meet.
    expect(plataformaDe(todas.find(({ s }) => s.mesa === 6)!.s)).toBe('meet');
  });

  it('todas las sesiones son híbridas (presencial y virtual); el registro y el almuerzo no son sesiones', () => {
    for (const { s } of todas) {
      if (s.tipo === 'registro' || s.tipo === 'pausa') expect(esHibrida(s), s.horario).toBe(false);
      else expect(esHibrida(s), `${s.horario} ${s.tipo}`).toBe(true);
    }
    // 4 mesas de trabajo + reunión general + apertura + conferencia + 11 mesas + clausura.
    expect(todas.filter(({ s }) => esHibrida(s))).toHaveLength(5 + 2 + 11 + 1);
    for (const idioma of IDIOMAS) expect(TEXTOS_PROGRAMA[idioma].hibrida.length, idioma).toBeGreaterThan(10);
    expect(TEXTOS_PROGRAMA.es.hibrida).toBe('Híbrida (presencial y virtual)');
    expect(TEXTOS_PROGRAMA.pt.hibrida).toBe('Híbrida (presencial e virtual)');
  });

  it('los textos del botón existen en los tres idiomas', () => {
    for (const idioma of IDIOMAS) {
      expect(TEXTOS_PROGRAMA[idioma].unirse.zoom).toContain('Zoom');
      expect(TEXTOS_PROGRAMA[idioma].unirse.meet).toContain('Meet');
      expect(TEXTOS_PROGRAMA[idioma].participacion.presencial.length).toBeGreaterThan(0);
      expect(TEXTOS_PROGRAMA[idioma].participacion.virtual.length).toBeGreaterThan(0);
    }
  });
});

describe('las sesiones paralelas', () => {
  it('se juntan por horario: una pareja el jueves por la tarde, tres el viernes', () => {
    const parejas = (iso: string) =>
      agruparPorHorario(PROGRAMA.find((d) => d.iso === iso)!.sesiones).filter((b) => b.sesiones.length > 1);

    const jueves = parejas('2026-11-12');
    expect(jueves.map((b) => b.horario)).toEqual(['15:30–17:30']);
    expect(jueves[0].sesiones.map((s) => s.mesa)).toEqual([3, 4]);

    const viernes = parejas('2026-11-13');
    expect(viernes.map((b) => b.horario)).toEqual(['09:00–10:30', '10:30–12:00', '13:00–15:00']);
    expect(viernes.map((b) => b.sesiones.map((s) => s.mesa))).toEqual([[5, 6], [7, 8], [9, 10]]);
  });

  it('el miércoles no hay ninguna: todo es seguido', () => {
    const miercoles = agruparPorHorario(PROGRAMA[0].sesiones);
    expect(miercoles.every((b) => b.sesiones.length === 1)).toBe(true);
  });

  it('agrupar no pierde ni inventa sesiones', () => {
    for (const dia of PROGRAMA) {
      const total = agruparPorHorario(dia.sesiones).reduce((n, b) => n + b.sesiones.length, 0);
      expect(total, dia.iso).toBe(dia.sesiones.length);
    }
  });

  it('sesiones en la misma hora pero separadas por otra no se confunden', () => {
    const sesion = (horario: string): Sesion => ({ horario, tipo: 'pausa' });
    const grupos = agruparPorHorario([sesion('09:00–10:00'), sesion('10:00–11:00'), sesion('09:00–10:00')]);
    expect(grupos).toHaveLength(3);
  });
});

describe('cómo se escriben los autores', () => {
  const ponencia = (autores: string[], colaboradores?: true): Ponencia =>
    ({ titulo: 'x', autores, pais: 'mx', ...(colaboradores ? { colaboradores } : {}) });

  it('en español: «y», y «e» delante de un nombre que empieza por i', () => {
    expect(unirAutores(ponencia(['Ana', 'Beatriz']), 'es')).toBe('Ana y Beatriz');
    // El programa impreso lo trae así: «… Céspedes Castillo e Itzel Gutiérrez».
    expect(unirAutores(ponencia(['Francisco Céspedes', 'Itzel Gutiérrez']), 'es'))
      .toBe('Francisco Céspedes e Itzel Gutiérrez');
  });

  it('en inglés lleva la coma de serie, y en portugués «e»', () => {
    expect(unirAutores(ponencia(['A', 'B', 'C']), 'en')).toBe('A, B, and C');
    expect(unirAutores(ponencia(['A', 'B', 'C']), 'pt')).toBe('A, B e C');
  });

  it('«y colaboradores» se traduce y va al final, no como un autor más', () => {
    const p = ponencia(['Valeria Torrijos', 'María Núñez'], true);
    expect(unirAutores(p, 'es')).toBe('Valeria Torrijos, María Núñez y colaboradores');
    expect(unirAutores(p, 'en')).toBe('Valeria Torrijos, María Núñez, and collaborators');
  });

  it('un solo autor se queda tal cual', () => {
    expect(unirAutores(ponencia(['Ana Pérez']), 'es')).toBe('Ana Pérez');
  });
});
