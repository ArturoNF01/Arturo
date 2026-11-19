import { describe, expect, it } from 'vitest';
import { filasDePersonas, type FilaDeAsistencia, type RegistroDePonente } from '@/lib/asistencia';
import { filasSinRegistro } from '@/lib/sin-registro';

/** Las filas «sin registro» de «Asistencia por persona»: cuáles son, con su N.º de la pestaña y las asistencias que llevan. */

const de = (sesion: string, nombre: string, correo: string, registro: string | null, extra: Partial<FilaDeAsistencia> = {}): FilaDeAsistencia => ({
  id: `${sesion}-${correo}`, sesion, via: 'presencial', registro_id: registro, nombre, correo, perfil: registro ? 'publico_general' : null, folio: null,
  creada_en: '2026-11-12T20:00:00Z', estado_registro: registro ? 'confirmado' : null, ...extra,
});

describe('qué filas son «sin registro»', () => {
  it('las de quien escaneó sin que se hallara su registro, con su N.º en la pestaña', () => {
    const r = filasSinRegistro([
      de('jueves', 'Ana Ruiz', 'ana@x.org', 'r1'),
      de('jueves', 'Pedro Soto', 'pedro@x.org', null),
      de('jueves', 'Eva Mora', 'eva@x.org', 'r3'),
      de('viernes', 'Luis Peña', 'luis@x.org', null),
    ], []);
    expect(r.filas.map((f) => [f.numero, f.nombre])).toEqual([[2, 'Pedro Soto'], [4, 'Luis Peña']]);
    expect(r.total).toBe(4);
  });

  it('el N.º es el de la pestaña: la fila N de «Asistencia por persona» es la que se dice', () => {
    const asistentes = [de('jueves', 'Ana Ruiz', 'ana@x.org', 'r1'), de('jueves', 'Pedro Soto', 'pedro@x.org', null), de('viernes', 'Eva Mora', 'eva@x.org', 'r3')];
    const hoja = filasDePersonas(asistentes);
    for (const f of filasSinRegistro(asistentes, []).filas) expect([hoja[f.numero - 1][0], hoja[f.numero - 1][2]]).toEqual([f.numero, f.correo]);
  });

  it('lleva todas las asistencias de esa persona, juntas por correo sin importar las mayúsculas', () => {
    const r = filasSinRegistro([
      de('miercoles', 'Pedro Soto', 'pedro@x.org', null), de('jueves', 'PEDRO SOTO', 'PEDRO@x.org', null), de('viernes', 'Pedro Soto', 'pedro@x.org', null),
      de('jueves', 'Otra Persona', 'otra@x.org', null),
    ], []);
    expect(r.filas).toHaveLength(2);
    expect(r.filas[0]).toMatchObject({ numero: 1, total: 3 });
    expect(r.filas[0].asistencias).toEqual(['miercoles-pedro@x.org', 'jueves-PEDRO@x.org', 'viernes-pedro@x.org']);
    expect(r.filas[1].asistencias).toEqual(['jueves-otra@x.org']);
  });

  it('no incluye las asistencias ligadas a un registro, aunque sea de la misma persona o tenga el mismo correo', () => {
    const r = filasSinRegistro([de('jueves', 'Ana Ruiz', 'ana@x.org', 'r1'), de('viernes', 'Ana Ruiz', 'ana@x.org', null)], []);
    expect(r.filas).toHaveLength(1);
    expect(r.filas[0].asistencias).toEqual(['viernes-ana@x.org']);
  });

  it('un registro cancelado tiene registro: no es «sin registro», y se cuenta aparte', () => {
    const r = filasSinRegistro([de('jueves', 'Ana Ruiz', 'ana@x.org', 'r1', { estado_registro: 'cancelado' }), de('jueves', 'Pedro Soto', 'pedro@x.org', null)], []);
    expect(r.filas.map((f) => f.nombre)).toEqual(['Pedro Soto']);
    expect(r.conRegistroCancelado).toBe(1);
  });

  it('los ponentes sin asistencia tienen registro: no son «sin registro»', () => {
    const ponente: RegistroDePonente = { id: 'rp-1', nombre: 'Luis Pérez', correo: 'luis@x.org', perfil: 'ponente', folio: 'F-1', estado: 'confirmado' };
    const r = filasSinRegistro([de('jueves', 'Pedro Soto', 'pedro@x.org', null)], [ponente]);
    expect(r.filas.map((f) => f.numero)).toEqual([1]);
    expect(r.total).toBe(2);
  });

  it('la sesión de prueba no cuenta: ni fila ni asistencia', () => {
    const r = filasSinRegistro([de('prueba', 'Pedro Soto', 'pedro@x.org', null), de('jueves', 'Pedro Soto', 'pedro@x.org', null)], []);
    expect(r.filas).toHaveLength(1);
    expect(r.filas[0].asistencias).toEqual(['jueves-pedro@x.org']);
  });

  it('sin filas sin registro, nada', () => {
    expect(filasSinRegistro([de('jueves', 'Ana Ruiz', 'ana@x.org', 'r1')], []).filas).toEqual([]);
    expect(filasSinRegistro([], []).filas).toEqual([]);
  });
});
