import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bd/conexion', () => ({
  unaFila: async () => null,
  consultar: async () => [],
}));
vi.mock('@/lib/servidor/contenido', () => ({ leerEjes: async () => ({ filas: [] }) }));

const { variablesDeRegistro } = await import('@/lib/servidor/correo');

function variables(idioma: string, fechaLimite: string) {
  return variablesDeRegistro({
    clave: 'confirmacion_registro',
    registro: { folio: 'REG-1', nombres: 'Ana', apellidos: 'Ruiz', correo: 'a@b.org', idioma, perfil: 'publico_general', modalidad: 'presencial' },
    correoContacto: 'congreso@ciess.org',
    fechaLimite,
    urlAgenda: 'https://ejemplo.org/agenda',
  });
}

describe('el plazo en los acuses, con y sin fecha límite', () => {
  it('sin fecha límite, cada idioma dice «en cualquier momento» y la fecha pelada queda vacía', () => {
    expect(variables('es', '').plazo_edicion).toBe('en cualquier momento');
    expect(variables('en', '').plazo_edicion).toBe('at any time');
    expect(variables('pt', '').plazo_edicion).toBe('a qualquer momento');
    expect(variables('es', '').fecha_limite).toBe('');
    expect(variables('es', '').plazo_reenvio).toBe('a la brevedad');
  });

  it('con fecha límite, la frase conserva la fecha, en el idioma de quien recibe el correo', () => {
    expect(variables('es', '2026-11-02').plazo_edicion).toBe('hasta el 2 de noviembre de 2026');
    expect(variables('en', '2026-11-02').plazo_reenvio).toBe('before November 2, 2026');
    expect(variables('pt', '2026-11-02').plazo_edicion).toBe('até 2 de novembro de 2026');
  });
});
