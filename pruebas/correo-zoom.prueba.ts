import { describe, expect, it, vi } from 'vitest';

// `correo.ts` habla con la base para traducir el eje temático; aquí sólo se
// mira cómo arma las variables, así que la conexión se sustituye.
vi.mock('@/lib/bd/conexion', () => ({
  unaFila: async () => null,
  consultar: async () => [],
}));
vi.mock('@/lib/servidor/contenido', () => ({ leerEjes: async () => ({ filas: [] }) }));

const { variablesDeRegistro } = await import('@/lib/servidor/correo');

function variables(
  registro: Record<string, unknown>,
  urlRegistroZoom?: string,
  urlSesionZoom?: string,
) {
  return variablesDeRegistro({
    clave: 'confirmacion_registro',
    registro: { folio: 'REG-1', nombres: 'Ana', apellidos: 'Ruiz', correo: 'a@b.org', idioma: 'es', ...registro },
    correoContacto: 'congreso@ciess.org',
    fechaLimite: '2026-10-30',
    urlAgenda: 'https://ejemplo.org/agenda',
    urlRegistroZoom,
    urlSesionZoom,
  });
}

const ZOOM = 'https://us02web.zoom.us/webinar/register/WN_ejemplo';
const SALA = 'https://us02web.zoom.us/j/83396553628';

/**
 * El enlace de conexión no lo da este sistema: lo manda Zoom cuando la persona
 * se registra en el seminario web. A quien sigue la transmisión hay que
 * decírselo en el acuse, o se queda con un folio y sin manera de entrar. Y no
 * hay que decírselo a nadie más: a quien viaja a la sede, un botón de Zoom en
 * mitad de su acuse le hace dudar de si tiene que conectarse o presentarse.
 */
describe('el registro de Zoom en el acuse', () => {
  it('va en el del público que sigue la transmisión', () => {
    const v = variables({ perfil: 'publico_general', modalidad: 'en_linea' }, ZOOM);
    expect(v.zoom_bloque).toContain(ZOOM);
    expect(v.url_zoom).toBe(ZOOM);
  });

  it('no va en el de quien viene a la sede', () => {
    const v = variables({ perfil: 'publico_general', modalidad: 'presencial' }, ZOOM);
    expect(v.zoom_bloque).toBe('');
  });

  it('no va en el de quien expone, aunque sea en línea', () => {
    // A esa persona se le agenda su conexión con el comité, no por Zoom.
    const v = variables({ perfil: 'ponente', modalidad: 'en_linea' }, ZOOM);
    expect(v.zoom_bloque).toBe('');
  });

  it('sin enlace configurado no se inventa nada', () => {
    const v = variables({ perfil: 'publico_general', modalidad: 'en_linea' });
    expect(v.zoom_bloque).toBe('');
    expect(v.url_zoom).toBe('');
  });
});

/**
 * Y debajo del registro, la puerta.
 *
 * El formulario de Zoom devuelve un enlace personal por correo. El día del
 * congreso ese correo lleva un mes enterrado y lo que la gente busca es por
 * dónde se entra, así que la sala va también en el acuse. Debajo, no encima:
 * quien no se haya registrado todavía tiene que ver antes el formulario, que
 * es lo que le da su enlace y lo que deja constancia de su asistencia.
 */
describe('la sala del seminario web en el acuse', () => {
  it('acompaña al registro en el del público en línea', () => {
    const v = variables({ perfil: 'publico_general', modalidad: 'en_linea' }, ZOOM, SALA);
    expect(v.zoom_bloque).toContain(SALA);
    expect(v.url_sesion_zoom).toBe(SALA);

    // El orden importa: primero el formulario, después la sala.
    expect(v.zoom_bloque.indexOf(ZOOM)).toBeLessThan(v.zoom_bloque.indexOf(SALA));
  });

  it('sin sala configurada, el acuse queda como estaba', () => {
    const v = variables({ perfil: 'publico_general', modalidad: 'en_linea' }, ZOOM);
    expect(v.zoom_bloque).toContain(ZOOM);
    expect(v.url_sesion_zoom).toBe('');
    // Ni una línea separadora colgando de nada.
    expect(v.zoom_bloque).not.toContain('border-top');
  });

  it('a quien viene a la sede no se le ofrece ninguna de las dos', () => {
    const v = variables({ perfil: 'publico_general', modalidad: 'presencial' }, ZOOM, SALA);
    expect(v.zoom_bloque).toBe('');
  });

  it('y la sala sola, sin registro, no abre el bloque', () => {
    // Si se borra el registro de Zoom del panel, el aviso entero desaparece:
    // mandar a la sala a quien no se registró es mandarlo a una puerta que
    // le va a pedir el formulario de todos modos.
    const v = variables({ perfil: 'publico_general', modalidad: 'en_linea' }, undefined, SALA);
    expect(v.zoom_bloque).toBe('');
  });
});
