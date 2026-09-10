import { describe, expect, it } from 'vitest';
import { PERFILES, campoVisible, pasosVisibles, perfilPorClave } from '@/lib/perfiles';

describe('pasos del formulario según el perfil', () => {
  it('un espectador en línea sólo ve lo indispensable', () => {
    const pasos = pasosVisibles(perfilPorClave('espectador_linea'), 'en_linea');
    expect(pasos).toEqual(['perfil', 'identificacion', 'cierre', 'privacidad']);
  });

  it('un funcionario del CIESS presencial añade requerimientos en sala', () => {
    const pasos = pasosVisibles(perfilPorClave('funcionario_ciess'), 'presencial');
    expect(pasos).toContain('sala');
    expect(pasos).not.toContain('academico');
    expect(pasos).not.toContain('alojamiento');
  });

  it('un conferencista presencial recorre todas las secciones', () => {
    const pasos = pasosVisibles(perfilPorClave('conferencista'), 'presencial');
    expect(pasos).toEqual([
      'perfil', 'identificacion', 'academico', 'semblanza', 'documentacion',
      'sala', 'alojamiento', 'traslados', 'cierre', 'privacidad',
    ]);
  });

  it('un conferencista en línea no ve alojamiento ni traslados', () => {
    const pasos = pasosVisibles(perfilPorClave('conferencista'), 'en_linea');
    expect(pasos).not.toContain('alojamiento');
    expect(pasos).not.toContain('traslados');
    expect(pasos).toContain('semblanza');
  });

  it('sin perfil elegido sólo se muestra el primer paso', () => {
    expect(pasosVisibles(undefined, 'presencial')).toEqual(['perfil']);
  });

  it('todo perfil admite al menos una modalidad', () => {
    for (const perfil of PERFILES) {
      expect(perfil.permitePresencial || perfil.permiteEnLinea, perfil.clave).toBe(true);
    }
  });

  it('la modalidad por defecto de cada perfil es una que admite', () => {
    for (const perfil of PERFILES) {
      const admitida =
        perfil.modalidadDefault === 'presencial' ? perfil.permitePresencial : perfil.permiteEnLinea;
      expect(admitida, perfil.clave).toBe(true);
    }
  });
});

describe('visibilidad de campos', () => {
  it('el personificador sólo aparece en perfiles que leen semblanza', () => {
    expect(campoVisible('nombre_personificador', perfilPorClave('panelista'), 'presencial')).toBe(true);
    expect(campoVisible('nombre_personificador', perfilPorClave('espectador_linea'), 'en_linea')).toBe(false);
  });

  it('el régimen alimentario sólo aplica a quien asiste en persona', () => {
    expect(campoVisible('regimen_alimentario', perfilPorClave('panelista'), 'presencial')).toBe(true);
    expect(campoVisible('regimen_alimentario', perfilPorClave('panelista'), 'en_linea')).toBe(false);
  });

  it('el ORCID sólo se pide a quien presenta trabajo académico', () => {
    expect(campoVisible('orcid', perfilPorClave('participante_externo'), 'presencial')).toBe(true);
    expect(campoVisible('orcid', perfilPorClave('funcionario_ciss'), 'presencial')).toBe(false);
  });
});
