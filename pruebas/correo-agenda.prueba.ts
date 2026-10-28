import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bd/conexion', () => ({
  unaFila: async () => null,
  consultar: async () => [],
}));
vi.mock('@/lib/servidor/contenido', () => ({ leerEjes: async () => ({ filas: [] }) }));

const { variablesDeRegistro } = await import('@/lib/servidor/correo');

const GENERAL = 'https://ejemplo.org/Agenda.pdf';
const PT = 'https://ejemplo.org/Programa_PT.pdf';
const EN = 'https://ejemplo.org/Programa_EN.pdf';

function variables(idioma: string, urlAgendaPt: string | null = PT, programaPublicado = true) {
  return variablesDeRegistro({
    clave: 'confirmacion_registro',
    registro: { folio: 'REG-1', nombres: 'Ana', apellidos: 'Ruiz', correo: 'a@b.org', idioma, perfil: 'publico_general', modalidad: 'presencial' },
    correoContacto: 'congreso@ciess.org',
    fechaLimite: '2026-10-30',
    urlAgenda: GENERAL,
    urlAgendaPt: urlAgendaPt ?? undefined,
    urlAgendaEn: EN,
    programaPublicado,
  });
}

describe('la agenda en el acuse, según el idioma del registro', () => {
  it('quien se registró en portugués recibe la agenda en portugués, en el botón y en la variable', () => {
    const v = variables('pt');
    expect(v.url_agenda).toBe(PT);
    expect(v.agenda_bloque).toContain(`href="${PT}"`);
    expect(v.agenda_bloque).not.toContain(GENERAL);
  });

  it('quien se registró en inglés recibe la agenda en inglés', () => {
    const v = variables('en');
    expect(v.url_agenda).toBe(EN);
    expect(v.agenda_bloque).toContain(`href="${EN}"`);
    expect(v.agenda_bloque).not.toContain(GENERAL);
  });

  it('en español, la general', () => {
    const v = variables('es');
    expect(v.url_agenda).toBe(GENERAL);
    expect(v.agenda_bloque).toContain(`href="${GENERAL}"`);
  });

  it('sin versión en portugués, cae a la general en vez de dejar el botón sin enlace', () => {
    expect(variables('pt', '').url_agenda).toBe(GENERAL);
    expect(variables('pt', null).agenda_bloque).toContain(`href="${GENERAL}"`);
  });

  it('con la agenda sin publicar no sale el bloque, en ningún idioma', () => {
    expect(variables('pt', PT, false).agenda_bloque).toBe('');
  });
});
