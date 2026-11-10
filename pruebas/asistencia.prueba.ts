import { describe, expect, it } from 'vitest';
import {
  ALFABETO_DE_CODIGOS, CLAVE_DE_PRUEBA, DIAS_DE_ASISTENCIA, SESION_DE_PRUEBA, esSesionDePrueba, filasDeAsistencias, aCsv, agruparPorPersona, type FilaDeAsistencia, LARGO_DE_CODIGO, MINUTOS_ANTES, MINUTOS_DESPUES, SESIONES_DE_ASISTENCIA,
  correoValido, decidirIdentidad, diaDeClave, elegirRegistroPorNombre, esCodigoPosible, estadoDeVentana,
  etiquetaDeClave, huellaDeNombre, instanteEnMexico, nombreDePila, normalizarTexto, sesionPorClave, sesionesDelDia,
  jornadaDeHoy, ventanaDe,
} from '@/lib/asistencia';
import { PROGRAMA } from '@/lib/programa';

/**
 * La asistencia con QR: qué sesiones cuentan, cuándo vale cada código y cómo se reconoce a quien
 * escanea. Lo que toca la base de datos se prueba contra PostgreSQL (`npm run prueba-bd`).
 */

describe('las jornadas a las que se pasa asistencia: una por día', () => {
  it('son tres: miércoles, jueves y viernes', () => {
    expect(SESIONES_DE_ASISTENCIA.map((x) => x.clave)).toEqual(['miercoles', 'jueves', 'viernes']);
    expect(SESIONES_DE_ASISTENCIA.every((x) => x.tipo === 'dia')).toBe(true);
    expect(DIAS_DE_ASISTENCIA.map((d) => d.iso)).toEqual(['2026-11-11', '2026-11-12', '2026-11-13']);
  });

  it('cada día de la agenda tiene su jornada, con el horario de su primera actividad a la última', () => {
    expect(SESIONES_DE_ASISTENCIA).toHaveLength(PROGRAMA.length);
    const horario = (clave: string) => sesionPorClave(clave)?.horario;
    expect(horario('miercoles')).toBe('08:30–17:00');
    expect(horario('jueves')).toBe('08:30–17:30');
    expect(horario('viernes')).toBe('09:00–17:30'); // el viernes no hay registro: empieza con la mesa 5
  });

  it('cada día tiene una sola jornada', () => {
    for (const dia of DIAS_DE_ASISTENCIA) expect(sesionesDelDia(dia.iso)).toHaveLength(1);
  });

  it('todas tienen horario legible, termina después de empezar y están dentro del día que les toca', () => {
    for (const s of SESIONES_DE_ASISTENCIA) {
      expect(Number.isNaN(s.inicio.getTime()), s.clave).toBe(false);
      expect(s.fin.getTime(), s.clave).toBeGreaterThan(s.inicio.getTime());
      expect(s.inicio.toISOString().slice(0, 10), s.clave).toMatch(/^2026-11-1[123]$/);
    }
  });

  it('se nombran en los tres idiomas, con el título del día', () => {
    expect(etiquetaDeClave('jueves', 'es')).toBe('Jueves 12 de noviembre · Inauguración y mesas temáticas 1 a 4');
    expect(etiquetaDeClave('jueves', 'en')).toBe('Thursday 12 November · Opening and thematic panels 1 to 4');
    expect(etiquetaDeClave('miercoles', 'es')).toMatch(/^Miércoles 11 de noviembre · /);
    expect(diaDeClave('viernes', 'es')).toBe('Viernes 13 de noviembre');
    expect(diaDeClave('viernes', 'pt')).toBe('Sexta-feira, 13 de novembro');
    // Una clave de cuando la asistencia era por mesa ya no está en la agenda: se dice tal cual, para no perder la fila.
    expect(etiquetaDeClave('mesa-4', 'es')).toBe('mesa-4');
    expect(diaDeClave('mesa-4', 'es')).toBe('');
  });
});

describe('la hora de México', () => {
  it('9:00 en la Ciudad de México es 15:00 UTC en noviembre (sin horario de verano)', () => {
    expect(instanteEnMexico('2026-11-12', '09:00').toISOString()).toBe('2026-11-12T15:00:00.000Z');
    expect(instanteEnMexico('2026-11-13', '16:50').toISOString()).toBe('2026-11-13T22:50:00.000Z');
  });

  it('no depende del huso de quien corre el programa', () => {
    const antes = process.env.TZ;
    process.env.TZ = 'Asia/Tokyo';
    try {
      expect(instanteEnMexico('2026-11-12', '09:00').toISOString()).toBe('2026-11-12T15:00:00.000Z');
    } finally {
      if (antes === undefined) delete process.env.TZ; else process.env.TZ = antes;
    }
  });
});

describe('la ventana de cada código: 20 minutos antes del día y 30 después', () => {
  const jueves = sesionPorClave('jueves')!; // 08:30–17:30

  it('abre 20 minutos antes de la primera actividad y cierra 30 minutos después de la última', () => {
    expect(MINUTOS_ANTES).toBe(20);
    expect(MINUTOS_DESPUES).toBe(30);
    const { abre, cierra } = ventanaDe(jueves);
    expect(abre.toISOString()).toBe('2026-11-12T14:10:00.000Z'); // 08:10 en México
    expect(cierra.toISOString()).toBe('2026-11-13T00:00:00.000Z'); // 18:00 en México
  });

  it('antes, abierta y cerrada, con los límites incluidos', () => {
    const en = (iso: string) => estadoDeVentana(jueves, new Date(iso));
    expect(en('2026-11-12T14:09:59Z')).toBe('antes');
    expect(en('2026-11-12T14:10:00Z')).toBe('abierta');
    expect(en('2026-11-12T19:00:00Z')).toBe('abierta'); // a mediodía, en plena jornada
    expect(en('2026-11-13T00:00:00Z')).toBe('abierta');
    expect(en('2026-11-13T00:00:01Z')).toBe('cerrada');
  });

  it('el QR de un día no sirve otro día', () => {
    const miercoles = sesionPorClave('miercoles')!;
    const unaTardeDelJueves = new Date('2026-11-12T20:00:00Z');
    expect(estadoDeVentana(miercoles, unaTardeDelJueves)).toBe('cerrada');
    expect(estadoDeVentana(sesionPorClave('viernes')!, unaTardeDelJueves)).toBe('antes');
    expect(estadoDeVentana(jueves, new Date('2026-11-13T15:00:00Z'))).toBe('cerrada');
  });

  it('dentro del día se puede escanear a cualquier hora: llegar tarde o irse temprano no cambia nada', () => {
    for (const hora of ['14:30', '16:00', '19:30', '22:59']) {
      expect(estadoDeVentana(jueves, new Date(`2026-11-12T${hora}:00Z`)), hora).toBe('abierta');
    }
  });
});

describe('reconocer a quien escanea', () => {
  it('normaliza acentos, mayúsculas, signos y espacios', () => {
    expect(normalizarTexto('  José  Pérez-Ruiz ')).toBe('jose perez ruiz');
    expect(normalizarTexto('MARÍA DEL CARMEN')).toBe('maria del carmen');
  });

  it('el nombre es una bolsa de palabras: el orden en que lo teclea no importa', () => {
    expect(huellaDeNombre('Ruiz Pérez, José')).toBe(huellaDeNombre('jose perez ruiz'));
    expect(huellaDeNombre('Ana')).not.toBe(huellaDeNombre('Ana Ruiz'));
  });

  const candidatos = [
    { id: 'a', nombres: 'María Fernanda', apellidos: 'Robles Iturbide' },
    { id: 'b', nombres: 'Luis', apellidos: 'Pérez Gómez' },
    { id: 'c', nombres: 'Luis', apellidos: 'Pérez Gómez' }, // un homónimo exacto
    { id: 'd', nombres: 'Ana', apellidos: 'Ruiz' },
  ];

  it('por nombre sólo si coincide con un único registro', () => {
    expect(elegirRegistroPorNombre('maria fernanda robles iturbide', candidatos)).toBe('a');
    expect(elegirRegistroPorNombre('Robles Iturbide, María Fernanda', candidatos)).toBe('a');
    expect(elegirRegistroPorNombre('Luis Pérez Gómez', candidatos)).toBeNull(); // dos personas: no se adivina
    expect(elegirRegistroPorNombre('Pedro Ramírez', candidatos)).toBeNull();
  });

  it('un nombre suelto no identifica a nadie', () => {
    expect(elegirRegistroPorNombre('Ana', candidatos)).toBeNull();
    expect(elegirRegistroPorNombre('', candidatos)).toBeNull();
  });

  it('valida las direcciones de correo', () => {
    expect(correoValido('a@b.org')).toBe(true);
    expect(correoValido(' ana@universidad.edu.mx ')).toBe(true);
    for (const malo of ['', 'ana', 'ana@', '@b.org', 'a b@c.org', 'a@b']) expect(correoValido(malo), malo).toBe(false);
  });

  it('saluda con el nombre de pila, no con el nombre completo', () => {
    expect(nombreDePila('María Fernanda')).toBe('María');
    expect(nombreDePila('  Luis ')).toBe('Luis');
    expect(nombreDePila('')).toBe('');
  });
});

describe('qué se hace con quien escanea, en dos pasos', () => {
  const candidatos = [{ id: 'a', nombres: 'María', apellidos: 'Robles' }];

  it('con un correo que es de un registro: se le registra, sin pedir nada más', () => {
    expect(decidirIdentidad({ registroPorCorreo: 'a', nombre: '', candidatosPorNombre: [] }))
      .toEqual({ accion: 'registrar', registroId: 'a', por: 'correo' });
  });

  it('con un correo que no aparece y sin nombre: se le pide su nombre y su correo, y no se guarda nada', () => {
    expect(decidirIdentidad({ registroPorCorreo: null, nombre: '', candidatosPorNombre: candidatos }))
      .toEqual({ accion: 'pedir_datos' });
    expect(decidirIdentidad({ registroPorCorreo: null, nombre: '   ', candidatosPorNombre: candidatos }))
      .toEqual({ accion: 'pedir_datos' });
  });

  it('en el segundo paso, si el correo corregido aparece, se le registra por el correo', () => {
    expect(decidirIdentidad({ registroPorCorreo: 'a', nombre: 'María Robles', candidatosPorNombre: candidatos }))
      .toEqual({ accion: 'registrar', registroId: 'a', por: 'correo' });
  });

  it('en el segundo paso, si el correo sigue sin aparecer pero el nombre es único, se le registra por el nombre', () => {
    expect(decidirIdentidad({ registroPorCorreo: null, nombre: 'María Robles', candidatosPorNombre: candidatos }))
      .toEqual({ accion: 'registrar', registroId: 'a', por: 'nombre' });
  });

  it('si ni el correo ni el nombre aparecen, queda «sin registro» para que el comité la concilie', () => {
    expect(decidirIdentidad({ registroPorCorreo: null, nombre: 'Pedro Ramírez', candidatosPorNombre: candidatos }))
      .toEqual({ accion: 'sin_registro' });
  });
});

describe('los códigos', () => {
  it('son de 10 caracteres de un alfabeto sin letras que se confunden', () => {
    expect(LARGO_DE_CODIGO).toBe(10);
    expect(ALFABETO_DE_CODIGOS).not.toMatch(/[0o1li]/);
    expect(esCodigoPosible('k3x9m2p7qa')).toBe(true);
    for (const malo of ['', 'corto', 'K3X9M2P7QA', 'k3x9m2p7q1', 'k3x9m2p7qaa', 'k3x9m2p7q ']) {
      expect(esCodigoPosible(malo), malo).toBe(false);
    }
  });
});

describe('la vista por persona', () => {
  const f = (id: string, sesion: string, nombre: string, registro: string | null, via: 'presencial' | 'en_linea' = 'presencial'): FilaDeAsistencia => ({
    id, sesion, via, registro_id: registro, nombre, correo: `${nombre.toLowerCase().replace(/\s/g, '.')}@x.org`, perfil: null, folio: null, creada_en: '2026-11-12T20:00:00Z',
  });

  it('una fila por persona, con a cuántos días asistió y a cuáles; primero quien más suma', () => {
    const personas = agruparPorPersona([
      f('1', 'miercoles', 'Ana Ruiz', 'r1'), f('2', 'jueves', 'Ana Ruiz', 'r1'), f('3', 'viernes', 'Ana Ruiz', 'r1', 'en_linea'),
      f('4', 'jueves', 'Luis Pérez', 'r2'),
    ]);
    expect(personas.map((p) => [p.nombre, p.total])).toEqual([['Ana Ruiz', 3], ['Luis Pérez', 1]]);
    expect(personas[0].porDia).toEqual({ '2026-11-11': 1, '2026-11-12': 1, '2026-11-13': 1 });
    expect(personas[0].sesiones.map((s) => s.via)).toEqual(['presencial', 'presencial', 'en_linea']);
  });

  it('quien está «sin registro» se agrupa por su correo: dos escaneos suyos son una persona', () => {
    const personas = agruparPorPersona([f('1', 'jueves', 'Pedro Soto', null), f('2', 'viernes', 'Pedro Soto', null)]);
    expect(personas).toHaveLength(1);
    expect(personas[0]).toMatchObject({ total: 2, sinRegistro: true });
  });

  it('una sesión que ya no está en la agenda cuenta en el total pero no en ningún día', () => {
    const [p] = agruparPorPersona([f('1', 'mesa-99', 'Ana Ruiz', 'r1')]);
    expect(p.total).toBe(1);
    expect(p.porDia).toEqual({});
  });
});

describe('el CSV', () => {
  it('escapa comas, comillas y saltos de línea', () => {
    expect(aCsv([['a', 'b,c', 'd"e', 'f\ng']])).toBe('a,"b,c","d""e","f\ng"');
  });

  it('un nombre que empiece como fórmula no se ejecuta al abrirlo en Excel', () => {
    // Los nombres los escribe cualquiera desde el formulario público.
    const csv = aCsv([['=HYPERLINK("http://malo")', '+52 55', '-1', '@suma']]);
    expect(csv.startsWith("\"'=HYPERLINK")).toBe(true);
    expect(csv).toContain("'+52 55");
    expect(csv).toContain("'-1");
    expect(csv).toContain("'@suma");
  });

  it('los números se quedan como números', () => {
    expect(aCsv([[1, 'x']])).toBe('1,x');
  });
});

describe('la sesión de prueba', () => {
  it('no es de la agenda: las jornadas siguen siendo tres', () => {
    expect(SESIONES_DE_ASISTENCIA).toHaveLength(3);
    expect(SESIONES_DE_ASISTENCIA.some((x) => x.clave === CLAVE_DE_PRUEBA)).toBe(false);
    expect(sesionPorClave('prueba')).toBe(SESION_DE_PRUEBA);
    expect(esSesionDePrueba('prueba')).toBe(true);
    expect(esSesionDePrueba('mesa-1')).toBe(false);
  });

  it('está siempre abierta, hoy, durante el Congreso y mucho después', () => {
    for (const cuando of ['2026-11-09T12:00:00Z', '2026-11-12T22:00:00Z', '2030-01-01T00:00:00Z']) {
      expect(estadoDeVentana(SESION_DE_PRUEBA, new Date(cuando)), cuando).toBe('abierta');
    }
  });

  it('se nombra «Sesión de prueba» y su día es «Prueba», para que en la hoja no se confunda con un día del Congreso', () => {
    expect(etiquetaDeClave('prueba', 'es')).toBe('Sesión de prueba');
    expect(etiquetaDeClave('prueba', 'en')).toBe('Test session');
    expect(diaDeClave('prueba', 'es')).toBe('Prueba');
    const [fila] = filasDeAsistencias([{ sesion: 'prueba', via: 'presencial', nombre: 'Ana Ruiz', correo: 'ana@x.org' }]);
    expect(fila.slice(3)).toEqual(['Prueba', 'Presencial']);
  });

  it('no cuenta para la asistencia de nadie: la vista por persona la deja fuera', () => {
    const f = (id: string, sesion: string): FilaDeAsistencia => ({
      id, sesion, via: 'presencial', registro_id: 'r1', nombre: 'Ana Ruiz', correo: 'ana@x.org', perfil: null, folio: null, creada_en: '2026-11-12T20:00:00Z',
    });
    const personas = agruparPorPersona([f('1', 'prueba'), f('2', 'jueves')]);
    expect(personas).toHaveLength(1);
    expect(personas[0].total).toBe(1);
    // Quien sólo hizo la prueba no aparece.
    expect(agruparPorPersona([f('3', 'prueba')])).toEqual([]);
  });
});

describe('la jornada que enseña la pantalla de recepción', () => {
  const a = (iso: string) => jornadaDeHoy(new Date(iso));

  it('cada día del Congreso enseña el suyo, a cualquier hora de México', () => {
    // 12:00 UTC del 12 es 06:00 en México; 05:59 UTC del 13 sigue siendo el 12 (23:59 en México).
    expect(a('2026-11-11T14:00:00Z')).toMatchObject({ relacion: 'hoy', sesion: { clave: 'miercoles' } });
    expect(a('2026-11-12T12:00:00Z')).toMatchObject({ relacion: 'hoy', sesion: { clave: 'jueves' } });
    expect(a('2026-11-13T05:59:00Z')).toMatchObject({ relacion: 'hoy', sesion: { clave: 'jueves' } });
    expect(a('2026-11-13T06:01:00Z')).toMatchObject({ relacion: 'hoy', sesion: { clave: 'viernes' } });
  });

  it('el día cambia con la fecha de México, no con la de Greenwich', () => {
    // 03:00 UTC del 12 son las 21:00 del 11 en México: todavía es miércoles.
    expect(a('2026-11-12T03:00:00Z')?.sesion.clave).toBe('miercoles');
  });

  it('antes del Congreso enseña el primer día, y después, el último', () => {
    expect(a('2026-11-10T18:00:00Z')).toMatchObject({ relacion: 'proximo', sesion: { clave: 'miercoles' } });
    expect(a('2026-11-14T18:00:00Z')).toMatchObject({ relacion: 'termino', sesion: { clave: 'viernes' } });
  });

  it('sin jornadas no hay nada que enseñar', () => {
    expect(jornadaDeHoy(new Date(), [])).toBeNull();
  });
});
