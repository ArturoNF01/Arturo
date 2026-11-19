import { describe, expect, it } from 'vitest';
import type { FilaDeAsistencia, RegistroDePonente } from '@/lib/asistencia';
import { planearDuplicados } from '@/lib/duplicados';
import { revisarRepetidos } from '@/lib/repetidos';

/** Qué registro queda cuando una misma persona tiene dos o más vigentes. Los casos son los cuatro que frenaban los folios. */

const de = (sesion: string, nombre: string, correo: string, registro: string | null, extra: Partial<FilaDeAsistencia> = {}): FilaDeAsistencia => ({
  id: `${sesion}-${correo}`, sesion, via: 'presencial', registro_id: registro, nombre, correo, perfil: registro ? 'publico_general' : null, folio: null,
  creada_en: '2026-11-12T20:00:00Z', estado_registro: registro ? 'confirmado' : null, ...extra,
});
const ponente = (n: number, nombre: string, correo: string): RegistroDePonente => ({ id: `rp-${n}`, nombre, correo, perfil: 'ponente', folio: `F-${n}`, estado: 'confirmado' });
const plan = (asistentes: FilaDeAsistencia[], ponentes: RegistroDePonente[] = [], mantener: string[] = []) =>
  planearDuplicados(revisarRepetidos(asistentes, ponentes), mantener);

describe('quién queda', () => {
  it('de dos ponentes, el que tiene asistencia: el otro se cancela (Héctor García Hernández)', () => {
    const p = plan(
      [de('jueves', 'Héctor García Hernández', 'hgarciah@inger.gob.mx', 'rp-1', { perfil: 'ponente' }), de('viernes', 'Héctor García Hernández', 'hgarciah@inger.gob.mx', 'rp-1', { perfil: 'ponente' })],
      [ponente(1, 'Héctor García Hernández', 'hgarciah@inger.gob.mx'), ponente(2, 'Héctor García Hernández', 'hector.garcia.hernandez@facmed.unam.mx')],
    );
    expect(p.sinResolver).toEqual([]);
    expect(p.resueltos).toHaveLength(1);
    expect(p.resueltos[0].queda).toMatchObject({ registroId: 'rp-1', total: 2 });
    expect(p.resueltos[0].cancelar.map((f) => f.registroId)).toEqual(['rp-2']);
    expect(p.resueltos[0].razon).toBe('tiene más días de asistencia (2 días, contra 0 días)');
  });

  it('de dos del público general, el de más días: el otro se cancela y sus días pasarán al que queda (Jose Abrego)', () => {
    const p = plan([
      de('miercoles', 'Jose Abrego', 'abregoj59@hotmail.com', 'r1'), de('jueves', 'Jose Abrego', 'abregoj59@hotmail.com', 'r1'),
      de('viernes', 'Jose Abrego', 'jlabrego3108@gmail.com', 'r2'),
    ]);
    expect(p.resueltos[0].queda.registroId).toBe('r1');
    expect(p.resueltos[0].cancelar.map((f) => [f.registroId, f.total])).toEqual([['r2', 1]]);
  });

  it('de tres ponentes con el mismo nombre, el único con asistencia queda y los otros dos se cancelan (María Luisa Mussot López)', () => {
    const p = plan(
      [
        de('jueves', 'María Luisa Mussot Lopez', 'malumulo@gmail.com', null), // una asistencia suelta: no es un registro, no se cancela
        de('viernes', 'María Luisa Mussot López', 'malumulo15@gmail.com', 'rp-1', { perfil: 'ponente' }),
      ],
      [ponente(1, 'María Luisa Mussot López', 'malumulo15@gmail.com'), ponente(2, 'María Luisa Mussot López', 'MUSSOT03@HOTMAIL.COM'), ponente(3, 'María Luisa Mussot López', 'EVALUADF@GMAIL.COM')],
    );
    expect(p.sinResolver).toEqual([]);
    expect(p.resueltos[0].queda.registroId).toBe('rp-1');
    expect(p.resueltos[0].cancelar.map((f) => f.registroId)).toEqual(['rp-2', 'rp-3']);
  });

  it('dos ponentes sin asistencia no se distinguen: no se escoge, se dice (Paulo Borges)', () => {
    const p = plan([], [ponente(1, 'Paulo Borges', 'paulobmcosta@gmail.com'), ponente(2, 'Paulo Borges', 'paulo.costa@ifes.edu.br')]);
    expect(p.resueltos).toEqual([]);
    expect(p.sinResolver).toHaveLength(1);
    expect(p.sinResolver[0].razon).toMatch(/los dos son ponentes, y llevan 0 días cada uno\): diga cuál queda con --mantener correo/);
  });

  it('con --mantener se decide el empate, sin mayúsculas en el correo', () => {
    const p = plan([], [ponente(1, 'Paulo Borges', 'paulobmcosta@gmail.com'), ponente(2, 'Paulo Borges', 'paulo.costa@ifes.edu.br')], ['PAULO.COSTA@ifes.edu.br']);
    expect(p.sinResolver).toEqual([]);
    expect(p.resueltos[0].queda.registroId).toBe('rp-2');
    expect(p.resueltos[0].cancelar.map((f) => f.registroId)).toEqual(['rp-1']);
    expect(p.resueltos[0].razon).toBe('se pidió conservarlo');
  });

  it('lo que se pide manda aunque el otro tenga más días', () => {
    const asistentes = [de('jueves', 'Ana Ruiz', 'ana@casa.org', 'r1'), de('viernes', 'Ana Ruiz', 'ana@casa.org', 'r1'), de('jueves', 'Ana Ruiz', 'ana@trabajo.org', 'r2')];
    expect(plan(asistentes).resueltos[0].queda.registroId).toBe('r1');
    expect(plan(asistentes, [], ['ana@trabajo.org']).resueltos[0].queda.registroId).toBe('r2');
  });

  it('el ponente queda aunque el del público general tenga más días: sus días pasarán a él', () => {
    const p = plan(
      [de('jueves', 'Luis Pérez', 'luis@x.org', 'r1'), de('viernes', 'Luis Pérez', 'luis@x.org', 'r1')],
      [ponente(1, 'Luis Pérez', 'luis.p@u.edu')],
    );
    expect(p.resueltos[0].queda.registroId).toBe('rp-1');
    expect(p.resueltos[0].razon).toBe('es ponente y los demás no');
  });

  it('no cancela a un ponente en favor de quien no lo es, ni siquiera pidiéndolo: eso se hace en el panel', () => {
    const p = plan([de('jueves', 'Luis Pérez', 'luis@x.org', 'r1')], [ponente(1, 'Luis Pérez', 'luis.p@u.edu')], ['luis@x.org']);
    expect(p.resueltos).toEqual([]);
    expect(p.sinResolver[0].razon).toMatch(/cancelaría un registro de ponente/);
  });

  it('pedir conservar a más de uno del mismo caso no se puede', () => {
    const p = plan([], [ponente(1, 'Paulo Borges', 'a@x.org'), ponente(2, 'Paulo Borges', 'b@x.org')], ['a@x.org', 'b@x.org']);
    expect(p.sinResolver[0].razon).toMatch(/más de uno/);
  });

  it('sólo se miran los casos de dos constancias: una suelta con un solo registro, o un registro cancelado, no son de esto', () => {
    const p = plan([
      de('jueves', 'Ana Ruiz', 'ana@x.org', 'r1'), de('viernes', 'ANA RUIZ', 'otra@y.org', null),
      de('jueves', 'Eva Mora', 'eva@x.org', 'r3'), de('jueves', 'Eva Mora', 'eva@x.org', 'r4', { estado_registro: 'cancelado' }),
    ]);
    expect(p).toEqual({ resueltos: [], sinResolver: [] });
  });

  it('sin repetidos, nada', () => {
    expect(plan([de('jueves', 'Ana Ruiz', 'ana@x.org', 'r1')])).toEqual({ resueltos: [], sinResolver: [] });
  });
});
