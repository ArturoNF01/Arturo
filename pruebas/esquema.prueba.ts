import { describe, expect, it } from 'vitest';
import { esquemaRegistro, esquemaConsultaSql, esquemaConfiguracion } from '@/lib/esquema';
import { CONFIG } from '@/lib/config';

/** Registro válido mínimo, tal como lo envía el formulario. */
function valido(extra: Record<string, unknown> = {}) {
  return {
    perfil: 'espectador_linea',
    modalidad: 'en_linea',
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

  it('no deja elegir una modalidad que el perfil no admite', () => {
    const resultado = esquemaRegistro.safeParse(
      valido({ perfil: 'espectador_linea', modalidad: 'presencial' }),
    );
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues.some((i) => i.path[0] === 'modalidad')).toBe(true);
  });

  it('exige nombre para el personificador a panelistas y conferencistas', () => {
    const resultado = esquemaRegistro.safeParse(
      valido({ perfil: 'panelista', modalidad: 'presencial', modalidad_participacion: 'ponencia_mesa' }),
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
      esquemaRegistro.safeParse(valido({ semblanza: 'a'.repeat(CONFIG.limiteSemblanzaCaracteres) })).success,
    ).toBe(true);
    expect(
      esquemaRegistro.safeParse(valido({ semblanza: 'a'.repeat(CONFIG.limiteSemblanzaCaracteres + 1) })).success,
    ).toBe(false);
    expect(
      esquemaRegistro.safeParse(valido({ resumen_ponencia: 'a'.repeat(CONFIG.limiteResumenCaracteres + 1) })).success,
    ).toBe(false);
  });

  it('rechaza una salida de hotel anterior a la entrada', () => {
    const resultado = esquemaRegistro.safeParse(
      valido({
        perfil: 'panelista', modalidad: 'presencial',
        nombre_personificador: 'Dra. Ana Ruiz', modalidad_participacion: 'ponencia_mesa',
        requiere_alojamiento: true,
        fecha_entrada_hotel: '2026-06-04',
        fecha_salida_hotel: '2026-06-01',
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
