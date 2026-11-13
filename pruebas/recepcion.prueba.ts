import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { instanteEnMexico } from '@/lib/asistencia';
import { esquemaConfiguracion } from '@/lib/esquema';
import { PROGRAMA } from '@/lib/programa';
import {
  LARGO_MAXIMO_DE_AVISO, SEGUNDOS_MAXIMOS_POR_IDIOMA, SEGUNDOS_MINIMOS_POR_IDIOMA, TEXTOS_RECEPCION, avance,
  avisoDeRecepcion, avisoGuardado, bloquesDelDia, duracion, enlacesDeRecepcion, horaDeMexico, leerSegundos, minutosPara,
  momentoDelDia, programaDeLaPantalla, segundosPorIdioma, unir,
} from '@/lib/recepcion';

/**
 * La pantalla de recepción: qué está en vivo y qué sigue (a cualquier hora, sin reloj propio), el aviso del comité y los
 * enlaces de los dos QR. Lo que se ve se comprueba aparte, con capturas.
 */
const dia = (iso: string) => PROGRAMA.find((d) => d.iso === iso)!;
const miercoles = bloquesDelDia(dia('2026-11-11'));
const jueves = bloquesDelDia(dia('2026-11-12'));
const viernes = bloquesDelDia(dia('2026-11-13'));
/** Un instante de México: `a('2026-11-12', '15:45')`. */
const a = (iso: string, hora: string) => instanteEnMexico(iso, hora).getTime();
const claves = (bs: { clave: string }[]) => bs.map((b) => b.clave);

describe('la agenda de cada día, lista para la pantalla', () => {
  it('trae todas las sesiones del programa, en orden de hora', () => {
    for (const d of PROGRAMA) {
      const bloques = bloquesDelDia(d);
      expect(bloques, d.iso).toHaveLength(d.sesiones.length);
      const inicios = bloques.map((b) => b.inicio);
      expect(inicios, d.iso).toEqual([...inicios].sort());
    }
  });

  it('las dos salas a la vez del jueves por la tarde: la mesa 3 en el Auditorio y la 4 en la sala de comisiones', () => {
    const tarde = jueves.filter((b) => b.horario === '16:00–18:00');
    expect(claves(tarde)).toEqual(['mesa-3', 'mesa-4']);
    expect(tarde.map((b) => b.sala?.es)).toEqual(['Auditorio', 'Sala de comisiones, planta baja']);
    for (const b of jueves) expect(b.sala?.es ?? '', b.clave).not.toMatch(/sesiones/i);
  });

  it('el viernes empieza con el registro de participantes y las mesas 5, 7 y 9 están en la sala de comisiones de la planta alta', () => {
    expect([viernes[0].clave, viernes[0].horario, viernes[0].sala?.es]).toEqual(['registro', '08:30–09:00', 'Lobby del Auditorio']);
    expect(viernes[0].naturaleza).toBe('registro');
    const sala = (clave: string) => viernes.find((b) => b.clave === clave)!.sala?.es;
    expect([sala('mesa-5'), sala('mesa-7'), sala('mesa-9')]).toEqual(Array(3).fill('Sala de comisiones, planta alta'));
    expect([sala('mesa-6'), sala('mesa-8'), sala('mesa-10')]).toEqual(Array(3).fill('Sala de comisiones, planta baja'));
    expect(sala('mesa-11')).toBe('Auditorio');
    // A las 08:45 está en marcha el registro, y lo que sigue son las dos mesas de las 09:00.
    const m = momentoDelDia(viernes, a('2026-11-13', '08:45'));
    expect([m.fase, claves(m.actuales), claves(m.siguientes)]).toEqual(['en_curso', ['registro'], ['mesa-5', 'mesa-6']]);
  });

  it('cada tipo de sesión sabe cómo se nombra: la mesa por su número, la conferencia con su ponente', () => {
    const mesa1 = jueves.find((b) => b.clave === 'mesa-1')!;
    expect(mesa1.etiqueta?.es).toBe('Mesa temática 1');
    expect(mesa1.etiqueta?.en).toBe('Thematic panel 1');
    expect(mesa1.titulo.es).toMatch(/mercado laboral/);
    expect(mesa1.corto).toEqual(mesa1.etiqueta);

    const conferencia = jueves.find((b) => b.clave === 'conferencia')!;
    expect(conferencia.etiqueta?.es).toBe('Conferencia magistral');
    expect(conferencia.ponente).toBe('Héctor J. Villarreal');

    const apertura = jueves.find((b) => b.clave === 'apertura')!;
    expect(apertura.etiqueta).toBeNull();
    expect(apertura.corto).toEqual(apertura.titulo);
    expect(apertura.titulo.es).toBe('Sesión de apertura');
  });

  it('el registro y el almuerzo no son sesiones en vivo', () => {
    expect(miercoles.find((b) => b.clave === 'registro')!.naturaleza).toBe('registro');
    expect(miercoles.find((b) => b.clave === 'pausa')!.naturaleza).toBe('receso');
    expect(miercoles.find((b) => b.clave === 'pausa')!.sala).toBeNull();
    // Siete mesas (de la 5 a la 11) y la clausura.
    expect(viernes.filter((b) => b.naturaleza === 'sesion')).toHaveLength(8);
  });

  it('todo lo que se muestra está en los tres idiomas', () => {
    for (const b of [...miercoles, ...jueves, ...viernes]) {
      for (const texto of [b.titulo, b.corto, ...(b.etiqueta ? [b.etiqueta] : []), ...(b.sala ? [b.sala] : [])]) {
        for (const idioma of ['es', 'en', 'pt'] as const) expect(texto[idioma].trim(), `${b.clave} ${idioma}`).not.toBe('');
      }
    }
  });
});

describe('qué pasa ahora y qué sigue', () => {
  it('antes de que empiece el día: lo primero que sigue es el registro', () => {
    const m = momentoDelDia(jueves, a('2026-11-12', '07:50'));
    expect(m.fase).toBe('antes');
    expect(m.actuales).toEqual([]);
    expect(claves(m.siguientes)).toEqual(['registro']);
  });

  it('el registro es lo que está en marcha de 08:30 a 09:00, y la apertura lo que sigue', () => {
    const m = momentoDelDia(jueves, a('2026-11-12', '08:45'));
    expect(m.fase).toBe('en_curso');
    expect(claves(m.actuales)).toEqual(['registro']);
    expect(claves(m.siguientes)).toEqual(['apertura']);
  });

  it('el minuto en que termina una sesión ya es de la siguiente: el final no cuenta', () => {
    expect(claves(momentoDelDia(jueves, a('2026-11-12', '09:00')).actuales)).toEqual(['apertura']);
    expect(claves(momentoDelDia(jueves, a('2026-11-12', '09:29')).actuales)).toEqual(['apertura']);
    expect(claves(momentoDelDia(jueves, a('2026-11-12', '09:30')).actuales)).toEqual(['conferencia']);
    expect(claves(momentoDelDia(jueves, a('2026-11-12', '10:30')).actuales)).toEqual(['mesa-1']);
  });

  it('con dos salas a la vez están las dos en marcha, y lo que sigue es lo siguiente a esa hora', () => {
    const m = momentoDelDia(jueves, a('2026-11-12', '16:30'));
    expect(m.fase).toBe('en_curso');
    expect(claves(m.actuales)).toEqual(['mesa-3', 'mesa-4']);
    expect(m.siguientes).toEqual([]);

    const viernes930 = momentoDelDia(viernes, a('2026-11-13', '09:30'));
    expect(claves(viernes930.actuales)).toEqual(['mesa-5', 'mesa-6']);
    expect(claves(viernes930.siguientes)).toEqual(['mesa-7', 'mesa-8']);
  });

  it('en el almuerzo es receso, y lo que sigue es lo de después', () => {
    const m = momentoDelDia(jueves, a('2026-11-12', '15:30'));
    expect(m.fase).toBe('receso');
    expect(claves(m.actuales)).toEqual(['pausa']);
    expect(claves(m.siguientes)).toEqual(['mesa-3', 'mesa-4']);
  });

  it('el miércoles son las mesas de trabajo, una tras otra, en la sala de comisiones', () => {
    const m = momentoDelDia(miercoles, a('2026-11-11', '10:00'));
    expect(m.actuales).toHaveLength(1);
    expect(m.actuales[0].titulo.es).toBe('Mesa de Trabajo RIUSS – Salud');
    expect(m.actuales[0].sala?.es).toBe('Sala de comisiones, planta baja');
    expect(m.siguientes[0].titulo.es).toBe('Mesa de Trabajo RIUSS – Pensiones');
  });

  it('el jueves 12 se recorrió 30 minutos desde la mesa 2: mesa 2 a las 13:00, almuerzo a las 15:00 y mesas 3 y 4 a las 16:00', () => {
    const hora = (clave: string) => jueves.find((b) => b.clave === clave)!.horario;
    expect([hora('mesa-1'), hora('mesa-2'), hora('pausa'), hora('mesa-3'), hora('mesa-4')]).toEqual([
      '10:30–12:30', '13:00–15:00', '15:00–16:00', '16:00–18:00', '16:00–18:00',
    ]);
    // Lo anterior no se mueve: ya ocurrió.
    expect([hora('registro'), hora('apertura'), hora('conferencia')]).toEqual(['08:30–09:00', '09:00–09:30', '09:30–10:30']);
    // A las 12:45 no hay nada en marcha y lo que sigue es la mesa 2; a las 13:00 ya empezó.
    const entre = momentoDelDia(jueves, a('2026-11-12', '12:45'));
    expect([entre.fase, claves(entre.actuales), claves(entre.siguientes)]).toEqual(['receso', [], ['mesa-2']]);
    expect(claves(momentoDelDia(jueves, a('2026-11-12', '13:00')).actuales)).toEqual(['mesa-2']);
    // El día termina a las 18:00: la jornada de asistencia, y con ella el cierre del QR, se recorren igual.
    expect(Date.parse(jueves.at(-1)!.fin)).toBe(a('2026-11-12', '18:00'));
  });

  it('al terminar el día no queda nada en marcha ni por venir', () => {
    expect(momentoDelDia(jueves, a('2026-11-12', '17:59')).fase).toBe('en_curso');
    expect(momentoDelDia(jueves, a('2026-11-12', '18:00'))).toEqual({ fase: 'despues', actuales: [], siguientes: [] });
    expect(momentoDelDia(viernes, a('2026-11-13', '20:00')).fase).toBe('despues');
  });

  it('una agenda vacía es un día que ya acabó', () => {
    expect(momentoDelDia([], Date.now()).fase).toBe('despues');
  });

  it('en un hueco entre dos sesiones se dice receso y se sabe qué sigue', () => {
    const hueco = [jueves[0], { ...jueves[1], inicio: new Date(a('2026-11-12', '10:00')).toISOString(), fin: new Date(a('2026-11-12', '11:00')).toISOString() }];
    const m = momentoDelDia(hueco, a('2026-11-12', '09:30'));
    expect(m.fase).toBe('receso');
    expect(m.actuales).toEqual([]);
    expect(m.siguientes).toHaveLength(1);
  });

  it('la hora que se le da es la que manda: el mismo instante da lo mismo en cualquier huso', () => {
    // 22:30 UTC del 12 son las 16:30 en México.
    expect(claves(momentoDelDia(jueves, Date.parse('2026-11-12T22:30:00Z')).actuales)).toEqual(['mesa-3', 'mesa-4']);
  });
});

describe('cuánto va y cuánto falta', () => {
  const mesa1 = jueves.find((b) => b.clave === 'mesa-1')!; // 10:30–12:30

  it('el avance va de 0 a 1 y no se sale', () => {
    expect(avance(mesa1, a('2026-11-12', '10:00'))).toBe(0);
    expect(avance(mesa1, a('2026-11-12', '11:30'))).toBeCloseTo(0.5);
    expect(avance(mesa1, a('2026-11-12', '13:00'))).toBe(1);
  });

  it('los minutos que faltan se redondean hacia arriba: a 30 segundos todavía es 1 min', () => {
    expect(minutosPara(mesa1.fin, a('2026-11-12', '12:00'))).toBe(30);
    expect(minutosPara(mesa1.fin, a('2026-11-12', '12:00') + 30_000)).toBe(30);
    expect(minutosPara(mesa1.fin, a('2026-11-12', '12:30') - 30_000)).toBe(1);
    expect(minutosPara(mesa1.fin, a('2026-11-12', '13:00'))).toBe(0);
  });

  it('las duraciones se leen igual en los tres idiomas', () => {
    expect(duracion(45)).toBe('45 min');
    expect(duracion(60)).toBe('1 h');
    expect(duracion(80)).toBe('1 h 20 min');
    expect(duracion(0)).toBe('0 min');
  });

  it('la hora se dice en hora de México, en 24 horas', () => {
    expect(horaDeMexico(Date.parse('2026-11-12T21:45:00Z'))).toBe('15:45');
    expect(horaDeMexico('2026-11-12T14:10:00Z')).toBe('08:10');
  });
});

describe('el día que se enseña, con su mañana', () => {
  it('el miércoles trae el jueves como «mañana», y el viernes ya no tiene', () => {
    expect(programaDeLaPantalla('2026-11-11', 'hoy')!.manana).toMatchObject({
      dia: { es: 'Jueves 12 de noviembre' },
      bloque: { clave: 'registro', sala: { es: 'Lobby del Auditorio' } },
    });
    expect(programaDeLaPantalla('2026-11-12', 'hoy')!.manana!.dia.es).toBe('Viernes 13 de noviembre');
    expect(programaDeLaPantalla('2026-11-13', 'hoy')!.manana).toBeNull();
  });

  it('un día que no está en el programa no se enseña', () => {
    expect(programaDeLaPantalla('2026-11-20', 'hoy')).toBeNull();
  });

  it('todo cabe en JSON: viaja de la página al navegador', () => {
    const programa = programaDeLaPantalla('2026-11-12', 'hoy')!;
    expect(JSON.parse(JSON.stringify(programa))).toEqual(programa);
  });
});

describe('el aviso del comité', () => {
  it('sin nada guardado no hay aviso', () => {
    for (const vacio of [undefined, null, '', 5, [], {}, { es: '', en: '', pt: '' }, { es: '   ', en: '\n', pt: '' }]) {
      expect(avisoDeRecepcion(vacio), JSON.stringify(vacio)).toBeNull();
    }
  });

  it('si sólo está en español, se enseña en español en los tres idiomas', () => {
    expect(avisoDeRecepcion({ es: 'La mesa 4 inicia tarde.' })).toEqual({
      es: 'La mesa 4 inicia tarde.', en: 'La mesa 4 inicia tarde.', pt: 'La mesa 4 inicia tarde.',
    });
  });

  it('cada idioma que sí se escribió se respeta, y el que falta usa el español', () => {
    expect(avisoDeRecepcion({ es: 'Hola', en: 'Hello', pt: '' })).toEqual({ es: 'Hola', en: 'Hello', pt: 'Hola' });
  });

  it('si falta el español se usa el primer idioma que haya, mejor eso que ningún aviso', () => {
    expect(avisoDeRecepcion({ es: '', en: 'Hello', pt: '' })).toEqual({ es: 'Hello', en: 'Hello', pt: 'Hello' });
  });

  it('limpia espacios y saltos de línea, y no pasa del largo máximo', () => {
    const largo = 'x'.repeat(LARGO_MAXIMO_DE_AVISO + 50);
    expect(avisoGuardado({ es: '  Hola \n\n  mundo  ', en: largo, pt: 7 })).toEqual({
      es: 'Hola mundo', en: 'x'.repeat(LARGO_MAXIMO_DE_AVISO), pt: '',
    });
  });

  it('lo guardado conserva los tres idiomas aunque vengan incompletos: es lo que edita el panel', () => {
    expect(avisoGuardado({ es: 'Hola' })).toEqual({ es: 'Hola', en: '', pt: '' });
    expect(avisoGuardado(null)).toEqual({ es: '', en: '', pt: '' });
  });
});

describe('los dos QR', () => {
  it('el de la agenda lleva a la agenda del sitio, no al PDF', () => {
    const { agenda } = enlacesDeRecepcion('https://congreso-dss.ciess.org', 'abc');
    expect(agenda).toBe('https://congreso-dss.ciess.org/#agenda');
    expect(agenda).not.toMatch(/api\/agenda|\.pdf/);
  });

  it('el de asistencia lleva al código presencial del día, y sin código no hay enlace', () => {
    expect(enlacesDeRecepcion('https://congreso-dss.ciess.org/', 'ek2p5b7bn5').asistencia).toBe('https://congreso-dss.ciess.org/a/ek2p5b7bn5');
    expect(enlacesDeRecepcion('https://congreso-dss.ciess.org', null).asistencia).toBeNull();
  });

  it('a donde llega el QR de la agenda existe: la sección del sitio se llama «agenda»', () => {
    expect(readFileSync('src/componentes/programa.tsx', 'utf8')).toMatch(/<section id="agenda">/);
  });
});

describe('los textos de la pantalla', () => {
  it('todos están completos en los tres idiomas, también los que llevan un dato', () => {
    const dia = { es: 'Jueves 12 de noviembre', en: 'Thursday 12 November', pt: 'Quinta-feira, 12 de novembro' };
    const T = TEXTOS_RECEPCION;
    // Una muestra de cada texto que lleva un dato: si se agrega uno nuevo y no entra aquí, la cuenta de abajo avisa.
    const conDato: [string, Record<string, string>][] = [
      ['registroAbierto', T.registroAbierto('18:00')], ['registroAbre', T.registroAbre('08:10')],
      ['registroDisponible', T.registroDisponible(dia)], ['hoyIniciamos', T.hoyIniciamos('08:30')],
      ['iniciaElDia', T.iniciaElDia(dia, '08:30')], ['mananaA', T.mananaA('08:30')],
      ['regresamos', T.regresamos('15:30')], ['quedan', T.quedan(45)], ['en', T.en(45)],
    ];
    const fijos = Object.entries(T).filter(([, valor]) => typeof valor !== 'function') as [string, Record<string, string>][];
    expect(Object.values(T).filter((valor) => typeof valor === 'function')).toHaveLength(conDato.length);
    expect(fijos.length).toBeGreaterThan(15);

    for (const [nombre, texto] of [...fijos, ...conDato]) {
      for (const idioma of ['es', 'en', 'pt'] as const) expect(texto[idioma]?.trim(), `${nombre} ${idioma}`).toBeTruthy();
    }
  });

  it('el recordatorio de la constancia dice lo mismo que el sitio: 80 % de asistencia', () => {
    for (const idioma of ['es', 'en', 'pt'] as const) expect(TEXTOS_RECEPCION.constancia[idioma]).toMatch(/80/);
  });

  it('dos textos se unen idioma por idioma, y sin el segundo queda el primero', () => {
    const sala = { es: 'Auditorio', en: 'Auditorium', pt: 'Auditório' };
    const mesa = { es: 'Mesa temática 3', en: 'Thematic panel 3', pt: 'Mesa temática 3' };
    expect(unir(mesa, sala)).toEqual({ es: 'Mesa temática 3 · Auditorio', en: 'Thematic panel 3 · Auditorium', pt: 'Mesa temática 3 · Auditório' });
    expect(unir(mesa, null)).toBe(mesa);
  });
});

describe('el aviso se guarda desde el panel', () => {
  it('la configuración acepta un aviso en los tres idiomas, y también vacío para quitarlo', () => {
    expect(esquemaConfiguracion.safeParse({ aviso_recepcion: { es: 'Hola', en: 'Hello', pt: 'Olá' } }).success).toBe(true);
    expect(esquemaConfiguracion.safeParse({ aviso_recepcion: { es: '', en: '', pt: '' } }).success).toBe(true);
  });

  it('no acepta un aviso que no cabe en la pantalla, ni un idioma que el sitio no tiene', () => {
    expect(esquemaConfiguracion.safeParse({ aviso_recepcion: { es: 'x'.repeat(LARGO_MAXIMO_DE_AVISO + 1) } }).success).toBe(false);
    expect(esquemaConfiguracion.safeParse({ aviso_recepcion: { es: 'x'.repeat(LARGO_MAXIMO_DE_AVISO) } }).success).toBe(true);
    expect(esquemaConfiguracion.safeParse({ aviso_recepcion: { fr: 'Bonjour' } }).success).toBe(false);
  });

  it('la base siembra la fila del aviso (la ruta del panel sólo actualiza filas que existen)', () => {
    expect(readFileSync('basedatos/esquema.sql', 'utf8')).toMatch(/\('aviso_recepcion', '\{"es": "", "en": "", "pt": ""\}'::jsonb/);
  });
});

describe('cuánto se queda cada idioma', () => {
  const texto = (palabras: number) => {
    const t = Array.from({ length: palabras }, () => 'palabra').join(' ');
    return { es: t, en: t, pt: t };
  };

  it('nunca menos de 9 segundos, aunque no haya nada que leer: con 4 no se alcanzaba', () => {
    expect(segundosPorIdioma([])).toBe(SEGUNDOS_MINIMOS_POR_IDIOMA);
    expect(segundosPorIdioma([texto(2)])).toBe(9);
    expect(SEGUNDOS_MINIMOS_POR_IDIOMA).toBeGreaterThanOrEqual(9);
  });

  it('crece con lo más largo que haya en pantalla, de a un tercio de segundo por palabra', () => {
    expect(segundosPorIdioma([texto(15)])).toBe(9);
    expect(segundosPorIdioma([texto(21)])).toBe(11);
    expect(segundosPorIdioma([texto(30)])).toBe(14);
    expect(segundosPorIdioma([texto(10), texto(24)])).toBe(12);
  });

  it('manda el idioma más largo: el portugués suele llevar más palabras', () => {
    expect(segundosPorIdioma([{ es: 'a b c', en: 'a b c', pt: Array.from({ length: 27 }, () => 'p').join(' ') }])).toBe(13);
  });

  it('no pasa de 16 segundos, por largo que sea el texto', () => {
    expect(segundosPorIdioma([texto(200)])).toBe(SEGUNDOS_MAXIMOS_POR_IDIOMA);
  });

  it('un título normal de mesa y un aviso del largo máximo caben en el tiempo calculado', () => {
    const mesa = bloquesDelDia(dia('2026-11-12')).find((b) => b.clave === 'mesa-1')!;
    const conferencia = bloquesDelDia(dia('2026-11-12')).find((b) => b.clave === 'conferencia')!;
    expect(segundosPorIdioma([mesa.titulo])).toBeGreaterThanOrEqual(9);
    // La conferencia es el título más largo del programa: se lee en 10 segundos o más.
    expect(segundosPorIdioma([conferencia.titulo])).toBeGreaterThanOrEqual(10);
    const aviso = 'palabra '.repeat(Math.floor(LARGO_MAXIMO_DE_AVISO / 8)).trim();
    expect(segundosPorIdioma([{ es: aviso, en: aviso, pt: aviso }])).toBeLessThanOrEqual(SEGUNDOS_MAXIMOS_POR_IDIOMA);
  });

  it('lo que se pide con ?segundos= manda, entre 5 y 30', () => {
    expect(segundosPorIdioma([texto(40)], 12)).toBe(12);
    expect(segundosPorIdioma([], 2)).toBe(5);
    expect(segundosPorIdioma([], 99)).toBe(30);
    expect(segundosPorIdioma([texto(40)], null)).toBe(16);
    expect(segundosPorIdioma([], Number.NaN)).toBe(9);
  });

  it('la dirección sólo acepta un entero entre 5 y 30', () => {
    expect(leerSegundos('12')).toBe(12);
    expect(leerSegundos('5')).toBe(5);
    expect(leerSegundos('30')).toBe(30);
    for (const malo of [undefined, null, '', '4', '31', '99', '1.5', '-8', 'doce', '12s', '012x']) {
      expect(leerSegundos(malo), String(malo)).toBeUndefined();
    }
  });
});
