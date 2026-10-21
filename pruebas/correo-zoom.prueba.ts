import { describe, expect, it, vi } from 'vitest';

// `correo.ts` habla con la base para traducir el eje temático; aquí sólo se
// mira cómo arma las variables, así que la conexión se sustituye.
vi.mock('@/lib/bd/conexion', () => ({
  unaFila: async () => null,
  consultar: async () => [],
}));
vi.mock('@/lib/servidor/contenido', () => ({ leerEjes: async () => ({ filas: [] }) }));

const { variablesDeRegistro } = await import('@/lib/servidor/correo');

function variables(registro: Record<string, unknown>, urlSesionZoom?: string) {
  return variablesDeRegistro({
    clave: 'confirmacion_registro',
    registro: { folio: 'REG-1', nombres: 'Ana', apellidos: 'Ruiz', correo: 'a@b.org', idioma: 'es', ...registro },
    correoContacto: 'congreso@ciess.org',
    fechaLimite: '2026-10-30',
    urlAgenda: 'https://ejemplo.org/agenda',
    urlSesionZoom,
  });
}

const SALA = 'https://us02web.zoom.us/j/83396553628';

/**
 * El enlace de la sala va en el acuse de quien sigue la transmisión, y en el
 * de nadie más: a quien viaja a la sede, un botón de Zoom en mitad de su
 * acuse le hace dudar de si tiene que conectarse o presentarse.
 *
 * Hubo un registro previo en Zoom —era él quien mandaba un enlace personal— y
 * se retiró. La sala es ahora la misma para todos y se entrega al terminar el
 * registro del congreso, sin pasos intermedios.
 */
describe('la sala del seminario web en el acuse', () => {
  it('va en el del público que sigue la transmisión', () => {
    const v = variables({ perfil: 'publico_general', modalidad: 'en_linea' }, SALA);
    expect(v.zoom_bloque).toContain(SALA);
    expect(v.url_zoom).toBe(SALA);
  });

  it('con la dirección a la vista, además del botón', () => {
    // El acuse se imprime y se reenvía; de un botón impreso no se copia nada.
    const v = variables({ perfil: 'publico_general', modalidad: 'en_linea' }, SALA);
    expect(v.zoom_bloque.split(SALA)).toHaveLength(3); // el href y el texto
  });

  it('y no manda a nadie a registrarse en ninguna parte', () => {
    // El registro previo se retiró: si vuelve a aparecer esa palabra en el
    // acuse, es que alguien revivió un paso que ya no existe.
    const v = variables({ perfil: 'publico_general', modalidad: 'en_linea' }, SALA);
    expect(v.zoom_bloque).not.toMatch(/regístrese|registrarme|inscrever|register on zoom/i);
  });

  it('no va en el de quien viene a la sede', () => {
    const v = variables({ perfil: 'publico_general', modalidad: 'presencial' }, SALA);
    expect(v.zoom_bloque).toBe('');
  });

  it('no va en el de quien expone, aunque sea en línea', () => {
    // A esa persona se le agenda su conexión con el comité, no por aquí.
    const v = variables({ perfil: 'ponente', modalidad: 'en_linea' }, SALA);
    expect(v.zoom_bloque).toBe('');
  });

  it('sin enlace configurado no se inventa nada', () => {
    const v = variables({ perfil: 'publico_general', modalidad: 'en_linea' });
    expect(v.zoom_bloque).toBe('');
    expect(v.url_zoom).toBe('');
  });
});

/**
 * El programa va en todos los acuses que confirman algo, sin mirar el perfil
 * ni la modalidad: quien expone quiere ver en qué mesa quedó y a qué hora, y
 * quien asiste, qué va a oír.
 */
describe('el programa en los acuses', () => {
  const PROGRAMA = 'https://home.ciess.org/wp-content/uploads/2026/10/Agenda_Congreso_RIUSS_2026_publico.pdf';

  function conPrograma(registro: Record<string, unknown>) {
    return variablesDeRegistro({
      clave: 'confirmacion_registro',
      registro: { folio: 'REG-1', nombres: 'Ana', apellidos: 'Ruiz', correo: 'a@b.org', idioma: 'es', ...registro },
      correoContacto: 'congreso@ciess.org',
      fechaLimite: '2026-10-30',
      urlAgenda: PROGRAMA,
      programaPublicado: true,
    });
  }

  it('sale para los cuatro casos: ponente y público, presencial y en línea', () => {
    for (const perfil of ['ponente', 'publico_general']) {
      for (const modalidad of ['presencial', 'en_linea']) {
        const v = conPrograma({ perfil, modalidad });
        expect(v.agenda_bloque, `${perfil} · ${modalidad}`).toContain(PROGRAMA);
      }
    }
  });

  it('y no compite con el de la sala: uno es la puerta y el otro el folleto', () => {
    // El del seminario va relleno; el del programa, perfilado. Si los dos
    // fueran botones azules, el correo tendría dos llamadas a la acción del
    // mismo peso y ninguna ganaría.
    const v = variablesDeRegistro({
      clave: 'confirmacion_registro',
      registro: { folio: 'REG-1', perfil: 'publico_general', modalidad: 'en_linea', idioma: 'es', correo: 'a@b.org' },
      correoContacto: 'congreso@ciess.org',
      fechaLimite: '2026-10-30',
      urlAgenda: PROGRAMA,
      programaPublicado: true,
      urlSesionZoom: SALA,
    });
    expect(v.zoom_bloque).toContain('background:#2e5c8a');
    expect(v.agenda_bloque).toContain('border:1px solid #2e5c8a');
    expect(v.agenda_bloque).not.toContain('background:#2e5c8a');
  });

  it('mientras el comité no lo dé por publicado, el acuse sale sin botón', () => {
    // Un correo es lo único que no se puede corregir después: mandar a
    // descargar un PDF que todavía se está corrigiendo deja circulando una
    // versión vieja que nadie puede retirar.
    const v = variablesDeRegistro({
      clave: 'confirmacion_registro',
      registro: { folio: 'REG-1', perfil: 'ponente', modalidad: 'presencial', idioma: 'es', correo: 'a@b.org' },
      correoContacto: 'congreso@ciess.org',
      fechaLimite: '2026-10-30',
      urlAgenda: PROGRAMA,
      programaPublicado: false,
    });
    expect(v.agenda_bloque).toBe('');
  });

  it('sin programa configurado no se inventa un botón roto', () => {
    const v = variablesDeRegistro({
      clave: 'confirmacion_registro',
      registro: { folio: 'REG-1', perfil: 'ponente', modalidad: 'presencial', idioma: 'es', correo: 'a@b.org' },
      correoContacto: 'congreso@ciess.org',
      fechaLimite: '2026-10-30',
      urlAgenda: '',
      programaPublicado: true,
    });
    expect(v.agenda_bloque).toBe('');
  });
});
