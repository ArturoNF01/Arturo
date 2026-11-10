import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('next/navigation', () => ({ redirect: () => undefined }));
vi.mock('@/lib/bd/conexion', () => ({
  bdConfigurada: () => false, consultar: async () => [], unaFila: async () => null,
}));

const { permisos } = await import('@/lib/servidor/sesion');

/**
 * Quién puede qué en la asistencia. El lector la ve entera —las vistas, los códigos con sus QR y enlaces, y
 * el CSV—; lo que cambia algo (ligar, quitar, cambiar un código, la sesión de prueba, la hoja) y lo que se
 * imprime es de quien organiza. La exportación de los registros sigue siendo de otro nivel.
 */
describe('los permisos de la asistencia por rol', () => {
  it('el lector ve las vistas, ve los códigos y descarga el CSV', () => {
    const p = permisos('lector');
    expect(p.verAsistencia).toBe(true);
    expect(p.verCodigosAsistencia).toBe(true);
    expect(p.exportarAsistencia).toBe(true);
  });

  it('pero el lector no cambia nada: ni asistencias, ni códigos, ni la prueba, ni la hoja', () => {
    expect(permisos('lector').gestionarAsistencia).toBe(false);
  });

  it('el lector sigue sin exportar los registros ni consultar la base: eso es de otro nivel', () => {
    const p = permisos('lector');
    expect(p.exportar).toBe(false);
    expect(p.consultarSql).toBe(false);
    expect(p.editarRegistros).toBe(false);
  });

  it('quien organiza, y por encima, lo puede todo en la asistencia', () => {
    for (const rol of ['organizador', 'superadmin'] as const) {
      const p = permisos(rol);
      expect([p.verAsistencia, p.verCodigosAsistencia, p.exportarAsistencia, p.gestionarAsistencia], rol).toEqual([true, true, true, true]);
    }
  });

  it('sin sesión no se ve nada', () => {
    const p = permisos(undefined);
    expect([p.verAsistencia, p.verCodigosAsistencia, p.exportarAsistencia, p.gestionarAsistencia]).toEqual([false, false, false, false]);
  });
});
