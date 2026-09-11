import { describe, expect, it } from 'vitest';
import {
  esquemaRegistro, esquemaConsultaSql, esquemaConfiguracion,
  crearEsquemaRegistro, LIMITES_POR_DEFECTO,
} from '@/lib/esquema';

/** Registro válido mínimo, tal como lo envía el formulario. */
function valido(extra: Record<string, unknown> = {}) {
  return {
    perfil: 'publico_general',
    modalidad: 'en_linea',
    zona_horaria: 'America/Mexico_City',
    idioma: 'es',
    apellidos: 'Ruiz',
    nombres: 'Ana',
    correo: 'ana@ejemplo.org',
    institucion: 'CIESS',
    pais_residencia: 'México',
    consentimiento_datos: true,
    ...extra,
  };
}

describe('esquema de registro', () => {
  it('acepta un registro mínimo bien formado', () => {
    expect(esquemaRegistro.safeParse(valido()).success).toBe(true);
  });

  it('exige el consentimiento de tratamiento de datos', () => {
    const resultado = esquemaRegistro.safeParse(valido({ consentimiento_datos: false }));
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0].path).toEqual(['consentimiento_datos']);
  });

  it('rechaza un correo mal formado', () => {
    expect(esquemaRegistro.safeParse(valido({ correo: 'ana(arroba)ejemplo' })).success).toBe(false);
  });

  it('rechaza un perfil que no existe', () => {
    expect(esquemaRegistro.safeParse(valido({ perfil: 'invitado_misterioso' })).success).toBe(false);
  });

  it('todos los perfiles admiten ambas modalidades: el congreso se transmite entero', () => {
    for (const perfil of ['ponente', 'conferencista', 'coordinador', 'moderador',
                          'dictaminador', 'publico_general']) {
      const presencial = esquemaRegistro.safeParse(valido({
        perfil, modalidad: 'presencial',
        nombre_personificador: 'Dra. Ana Ruiz', autoriza_grabacion: true,
        titulo_ponencia: 'Título', eje_tematico: 'pensiones',
        sesion_asignada: 'pensiones', ejes_dictamen: ['pensiones'],
      }));
      expect(presencial.error?.issues.some((i) => i.path[0] === 'modalidad'), perfil).toBeFalsy();
    }
  });

  it('sin autorizar la grabación no pasa quien sale en el programa', () => {
    const resultado = esquemaRegistro.safeParse(valido({
      perfil: 'conferencista', modalidad: 'en_linea', autoriza_grabacion: false,
    }));
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues.some((i) => i.path[0] === 'autoriza_grabacion')).toBe(true);
  });

  it('en línea, sin zona horaria no se puede avisar a qué hora conectarse', () => {
    const resultado = esquemaRegistro.safeParse(valido({ zona_horaria: '' }));
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues.some((i) => i.path[0] === 'zona_horaria')).toBe(true);
  });

  it('un dictaminador sin ejes declarados no se puede repartir', () => {
    const resultado = esquemaRegistro.safeParse(valido({
      perfil: 'dictaminador', autoriza_grabacion: true, ejes_dictamen: [],
    }));
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues.some((i) => i.path[0] === 'ejes_dictamen')).toBe(true);
  });

  it('exige nombre para el personificador a quien se sienta en la mesa', () => {
    const resultado = esquemaRegistro.safeParse(
      valido({ perfil: 'conferencista', modalidad: 'presencial', autoriza_grabacion: true }),
    );
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues.some((i) => i.path[0] === 'nombre_personificador')).toBe(true);
  });

  it('acepta ORCID vacío pero rechaza uno mal formado', () => {
    expect(esquemaRegistro.safeParse(valido({ orcid: '' })).success).toBe(true);
    expect(esquemaRegistro.safeParse(valido({ orcid: '0000-0002-1825-0097' })).success).toBe(true);
    expect(esquemaRegistro.safeParse(valido({ orcid: '0000-0002-1825-009X' })).success).toBe(true);
    expect(esquemaRegistro.safeParse(valido({ orcid: '1234' })).success).toBe(false);
  });

  it('respeta los límites de semblanza y resumen del formulario original', () => {
    expect(
      esquemaRegistro.safeParse(valido({ semblanza: 'a'.repeat(LIMITES_POR_DEFECTO.semblanzaCaracteres) })).success,
    ).toBe(true);
    expect(
      esquemaRegistro.safeParse(valido({ semblanza: 'a'.repeat(LIMITES_POR_DEFECTO.semblanzaCaracteres + 1) })).success,
    ).toBe(false);
    expect(
      esquemaRegistro.safeParse(valido({ resumen_ponencia: 'a'.repeat(LIMITES_POR_DEFECTO.resumenCaracteres + 1) })).success,
    ).toBe(false);
  });

  it('rechaza una salida de hotel anterior a la entrada', () => {
    const resultado = esquemaRegistro.safeParse(
      valido({
        perfil: 'conferencista', modalidad: 'presencial',
        nombre_personificador: 'Dra. Ana Ruiz', autoriza_grabacion: true,
        requiere_alojamiento: true,
        fecha_entrada_hotel: '2026-11-12',
        fecha_salida_hotel: '2026-11-10',
      }),
    );
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues.some((i) => i.path[0] === 'fecha_salida_hotel')).toBe(true);
  });

  it('descarta los campos auxiliares de la interfaz que no pertenecen a la base', () => {
    const resultado = esquemaRegistro.safeParse(valido({ _alojamiento: 'no', token: 'x' }));
    expect(resultado.success).toBe(true);
    expect(resultado.data).not.toHaveProperty('_alojamiento');
    expect(resultado.data).not.toHaveProperty('token');
  });
});

describe('límites configurables desde el panel', () => {
  it('la validación del servidor sigue el límite que se le pase', () => {
    const estricto = crearEsquemaRegistro({ semblanzaCaracteres: 100, resumenCaracteres: 200 });
    expect(estricto.safeParse(valido({ semblanza: 'a'.repeat(100) })).success).toBe(true);
    expect(estricto.safeParse(valido({ semblanza: 'a'.repeat(101) })).success).toBe(false);

    const amplio = crearEsquemaRegistro({ semblanzaCaracteres: 900, resumenCaracteres: 5000 });
    expect(amplio.safeParse(valido({ semblanza: 'a'.repeat(900) })).success).toBe(true);
  });

  it('el mensaje de error nombra el límite vigente', () => {
    const estricto = crearEsquemaRegistro({ semblanzaCaracteres: 100, resumenCaracteres: 200 });
    const resultado = estricto.safeParse(valido({ semblanza: 'a'.repeat(101) }));
    expect(resultado.error?.issues[0].message).toContain('100');
  });
});

describe('esquema de consulta SQL', () => {
  it('impone un límite máximo de filas', () => {
    expect(esquemaConsultaSql.safeParse({ consulta: 'select 1', limite: 999999 }).success).toBe(false);
    expect(esquemaConsultaSql.safeParse({ consulta: 'select 1', limite: 500 }).success).toBe(true);
  });

  it('usa mil filas cuando no se indica límite', () => {
    const resultado = esquemaConsultaSql.safeParse({ consulta: 'select 1' });
    expect(resultado.data?.limite).toBe(1000);
  });
});

describe('esquema de configuración', () => {
  it('acepta cupos nulos, que significan sin límite', () => {
    expect(esquemaConfiguracion.safeParse({ cupos_en_linea: null }).success).toBe(true);
  });

  it('rechaza cupos negativos y URLs inválidas', () => {
    expect(esquemaConfiguracion.safeParse({ cupos_presenciales: -5 }).success).toBe(false);
    expect(esquemaConfiguracion.safeParse({ url_agenda: 'no-es-url' }).success).toBe(false);
  });
});
