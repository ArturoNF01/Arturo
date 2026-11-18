import { describe, expect, it } from 'vitest';
import type { FilaDeAsistencia, RegistroDePonente } from '@/lib/asistencia';
import {
  filasConDatosPropios, planearFusiones, planearNombresDeRegistros, planearNombresDeSueltas,
} from '@/lib/limpieza';
import { revisarRepetidos } from '@/lib/repetidos';

const de = (sesion: string, nombre: string, correo: string, registro: string | null, extra: Partial<FilaDeAsistencia> = {}): FilaDeAsistencia => ({
  id: `${sesion}-${correo}`, sesion, via: 'presencial', registro_id: registro, nombre, correo, perfil: registro ? 'publico_general' : null, folio: null,
  creada_en: '2026-11-12T20:00:00Z', estado_registro: registro ? 'confirmado' : null, ...extra,
});
const plan = (asistencias: FilaDeAsistencia[], ponentes: RegistroDePonente[] = []) => planearFusiones(revisarRepetidos(asistencias, ponentes), asistencias);

describe('qué asistencias sueltas se ligan', () => {
  it('la suelta que repite a alguien con un solo registro vigente se liga a él, con todas sus asistencias', () => {
    const asistencias = [
      de('jueves', 'Carlos Chavera Bianchi', 'carlos@x.org', 'r1'),
      de('miercoles', 'CARLOS CHAVERA BIANCHI', 'kbarrios@cipps.unam.mx', null),
      de('viernes', 'CARLOS CHAVERA BIANCHI', 'KBarrios@cipps.unam.mx', null),
    ];
    const { fusiones, omitidas } = plan(asistencias);
    expect(omitidas).toEqual([]);
    expect(fusiones).toHaveLength(1);
    expect(fusiones[0].destino).toMatchObject({ numero: 1, registroId: 'r1' });
    expect(fusiones[0].sueltas).toHaveLength(1);
    expect(fusiones[0].sueltas[0].fila.numero).toBe(2);
    // Las dos asistencias de esa persona (el correo se compara sin mayúsculas).
    expect(fusiones[0].sueltas[0].asistencias).toEqual(['miercoles-kbarrios@cipps.unam.mx', 'viernes-KBarrios@cipps.unam.mx']);
  });

  it('sólo se ligan las sueltas: el registro vigente y los cancelados no se tocan', () => {
    const { fusiones } = plan([
      de('jueves', 'Ana Ruiz', 'ana@x.org', 'r1'),
      de('miercoles', 'Ana Ruiz', 'ana@x.org', 'r0', { estado_registro: 'cancelado' }),
      de('viernes', 'ANA RUIZ', 'otra@y.org', null),
    ]);
    expect(fusiones).toHaveLength(1);
    expect(fusiones[0].sueltas.map((s) => s.fila.numero)).toEqual([3]);
  });

  it('con dos registros vigentes no se sabe a cuál ligar: se deja y se dice', () => {
    const { fusiones, omitidas } = plan([
      de('jueves', 'Ana Ruiz', 'ana@casa.org', 'r1'), de('jueves', 'Ana Ruiz', 'ana@trabajo.org', 'r2'), de('viernes', 'ANA RUIZ', 'otra@y.org', null),
    ]);
    expect(fusiones).toEqual([]);
    expect(omitidas).toHaveLength(1);
    expect(omitidas[0].motivo).toMatch(/dos o más registros vigentes/);
    expect(omitidas[0].filas.map((f) => f.numero)).toEqual([3]);
  });

  it('si ninguna fila tiene registro vigente no hay a quién ligar: se deja', () => {
    const { fusiones, omitidas } = plan([de('jueves', 'Pedro Soto', 'p1@x.org', null), de('viernes', 'PEDRO SOTO', 'p2@y.org', null)]);
    expect(fusiones).toEqual([]);
    expect(omitidas[0].motivo).toMatch(/ningún|ninguna/);
  });

  it('también con un ponente sin asistencia como destino', () => {
    const ponente: RegistroDePonente = { id: 'rp-1', nombre: 'Luis Pérez', correo: 'luis@x.org', perfil: 'ponente', folio: 'F-1', estado: 'confirmado' };
    const { fusiones } = plan([de('jueves', 'LUIS PÉREZ', 'otro@typo.org', null)], [ponente]);
    expect(fusiones[0].destino.registroId).toBe('rp-1');
    expect(fusiones[0].sueltas[0].fila.numero).toBe(1);
  });

  it('sin repetidos no hay nada que ligar', () => {
    expect(plan([de('jueves', 'Ana Ruiz', 'ana@x.org', 'r1'), de('jueves', 'Luis Pérez', 'luis@x.org', null)])).toEqual({ fusiones: [], omitidas: [] });
  });
});

describe('qué nombres se pasan a altas y bajas', () => {
  const registro = (id: string, nombres: string, apellidos: string) => ({ id, folio: `F-${id}`, nombres, apellidos });

  it('el campo que está todo en mayúsculas; el otro se deja como está', () => {
    const c = planearNombresDeRegistros([
      registro('1', 'CARLOS', 'CHAVERA BIANCHI'), registro('2', 'MARÍA', 'López Ruiz'), registro('3', 'Ana', 'Ruiz'), registro('4', 'LI', 'WANG'),
    ]);
    expect(c.map((x) => [x.id, x.despues])).toEqual([
      ['1', { nombres: 'Carlos', apellidos: 'Chavera Bianchi' }],
      ['2', { nombres: 'María', apellidos: 'López Ruiz' }],
      ['4', { nombres: 'LI', apellidos: 'Wang' }], // «LI» es demasiado corto para saber
    ]);
    expect(c[0].antes).toEqual({ nombres: 'CARLOS', apellidos: 'CHAVERA BIANCHI' });
  });

  it('lo que ya está bien no es un cambio', () => {
    expect(planearNombresDeRegistros([registro('1', 'Ana', 'Ruiz')])).toEqual([]);
  });

  it('las asistencias sin registro, también', () => {
    const c = planearNombresDeSueltas([
      { id: 'a1', nombre: 'PEDRO SOTO', correo: 'p@x.org' }, { id: 'a2', nombre: 'Pedro Soto', correo: 'q@x.org' },
    ]);
    expect(c).toEqual([{ id: 'a1', correo: 'p@x.org', antes: 'PEDRO SOTO', despues: 'Pedro Soto' }]);
  });
});

describe('lo que quien hace las constancias ya escribió a la derecha', () => {
  const fila = (propias: unknown[], derecha: unknown[] = []) => [...propias, ...derecha];
  const diez = ['1', 'A', 'a@x', '', 'Público general', 0, 1, 0, 1, true];

  it('encuentra las filas, desde la que se pida, con algo escrito después de las diez columnas', () => {
    const datos = [fila(diez, ['', 'X']), fila(diez), fila(diez, ['', '', '', '', '', '', '', 'Constancia.pdf']), fila(diez)];
    expect(filasConDatosPropios(datos, 10, 0)).toEqual([0, 2]);
    expect(filasConDatosPropios(datos, 10, 1)).toEqual([2]);
    expect(filasConDatosPropios(datos, 10, 3)).toEqual([]);
  });

  it('una casilla sin marcar no cuenta, ni las celdas en blanco; una marcada, sí', () => {
    expect(filasConDatosPropios([fila(diez, ['', '', '', '', '', '', 'FALSE'])], 10, 0)).toEqual([]);
    expect(filasConDatosPropios([fila(diez, ['  ', ''])], 10, 0)).toEqual([]);
    expect(filasConDatosPropios([fila(diez, ['', '', '', '', '', '', 'TRUE'])], 10, 0)).toEqual([0]);
  });

  it('lo que está en las diez columnas del sistema no cuenta', () => {
    expect(filasConDatosPropios([diez], 10, 0)).toEqual([]);
  });
});
