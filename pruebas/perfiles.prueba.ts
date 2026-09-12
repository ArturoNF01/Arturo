import { describe, expect, it } from 'vitest';
import {
  CLAVES_PERFIL, PERFILES, campoVisible, nombrePerfil, pasosVisibles, perfilPorClave,
} from '@/lib/perfiles';

describe('pasos del formulario según el perfil', () => {
  it('el público general en línea sólo ve lo indispensable', () => {
    const pasos = pasosVisibles(perfilPorClave('publico_general'), 'en_linea');
    expect(pasos).toEqual(['perfil', 'identificacion', 'conexion', 'cierre', 'privacidad']);
  });

  it('al público general no se le preguntan requerimientos de sala', () => {
    // Proyector y micrófono son de quien expone, no de quien viene a
    // escuchar. La accesibilidad no está ahí: va en el cierre, que todos ven.
    const pasos = pasosVisibles(perfilPorClave('publico_general'), 'presencial');
    expect(pasos).not.toContain('sala');
    expect(pasos).not.toContain('documentacion');
    expect(pasos).not.toContain('alojamiento');
    expect(pasos).not.toContain('semblanza');
    expect(pasos).toContain('cierre');
  });

  it('quien sale en el programa sí los ve, si asiste en persona', () => {
    for (const clave of ['ponente', 'conferencista', 'coordinador', 'moderador', 'dictaminador'] as const) {
      expect(pasosVisibles(perfilPorClave(clave), 'presencial'), clave).toContain('sala');
    }
  });

  it('un ponente presencial recorre todas las secciones que le tocan', () => {
    expect(pasosVisibles(perfilPorClave('ponente'), 'presencial')).toEqual([
      'perfil', 'identificacion', 'ponencia', 'semblanza', 'documentacion',
      'sala', 'alojamiento', 'traslados', 'cierre', 'privacidad',
    ]);
  });

  it('quien participa a distancia cambia la logística de sede por la de conexión', () => {
    const enLinea = pasosVisibles(perfilPorClave('ponente'), 'en_linea');
    expect(enLinea).toContain('conexion');
    for (const paso of ['documentacion', 'sala', 'alojamiento', 'traslados']) {
      expect(enLinea, paso).not.toContain(paso);
    }
    expect(enLinea).toContain('ponencia');
    expect(enLinea).toContain('semblanza');
  });

  it('coordinar y moderar pide la sesión a cargo; ponerse a dictaminar, no', () => {
    expect(pasosVisibles(perfilPorClave('coordinador'), 'presencial')).toContain('sesion');
    expect(pasosVisibles(perfilPorClave('moderador'), 'presencial')).toContain('sesion');
    expect(pasosVisibles(perfilPorClave('dictaminador'), 'presencial')).not.toContain('sesion');
  });

  it('sólo al comité científico se le pregunta por el dictamen', () => {
    expect(pasosVisibles(perfilPorClave('dictaminador'), 'presencial')).toContain('dictamen');
    for (const clave of CLAVES_PERFIL.filter((c) => c !== 'dictaminador')) {
      expect(pasosVisibles(perfilPorClave(clave), 'presencial'), clave).not.toContain('dictamen');
    }
  });

  it('nadie más que el ponente confirma una ponencia: la convocatoria ya cerró', () => {
    for (const clave of CLAVES_PERFIL.filter((c) => c !== 'ponente')) {
      expect(pasosVisibles(perfilPorClave(clave), 'presencial'), clave).not.toContain('ponencia');
    }
  });

  it('sin perfil elegido sólo se muestra el primer paso', () => {
    expect(pasosVisibles(undefined, 'presencial')).toEqual(['perfil']);
  });

  it('todo perfil termina en protección de datos, en cualquier modalidad', () => {
    for (const perfil of PERFILES) {
      for (const modalidad of ['presencial', 'en_linea'] as const) {
        const pasos = pasosVisibles(perfil, modalidad);
        expect(pasos.at(-1), `${perfil.clave}/${modalidad}`).toBe('privacidad');
        expect(pasos[0]).toBe('perfil');
      }
    }
  });

  it('ningún paso se repite', () => {
    for (const perfil of PERFILES) {
      for (const modalidad of ['presencial', 'en_linea'] as const) {
        const pasos = pasosVisibles(perfil, modalidad);
        expect(new Set(pasos).size, `${perfil.clave}/${modalidad}`).toBe(pasos.length);
      }
    }
  });
});

describe('visibilidad de campos', () => {
  it('el personificador es el letrero de la mesa: sólo para quien se sienta en ella', () => {
    expect(campoVisible('nombre_personificador', perfilPorClave('ponente'), 'presencial')).toBe(true);
    expect(campoVisible('nombre_personificador', perfilPorClave('ponente'), 'en_linea')).toBe(false);
    expect(campoVisible('nombre_personificador', perfilPorClave('publico_general'), 'presencial')).toBe(false);
  });

  it('el régimen alimentario sólo aplica a quien asiste en persona', () => {
    expect(campoVisible('regimen_alimentario', perfilPorClave('ponente'), 'presencial')).toBe(true);
    expect(campoVisible('regimen_alimentario', perfilPorClave('ponente'), 'en_linea')).toBe(false);
  });

  it('el ORCID se pide a quien presenta y a quien dictamina, no al público', () => {
    expect(campoVisible('orcid', perfilPorClave('ponente'), 'presencial')).toBe(true);
    expect(campoVisible('orcid', perfilPorClave('dictaminador'), 'presencial')).toBe(true);
    expect(campoVisible('orcid', perfilPorClave('publico_general'), 'presencial')).toBe(false);
  });

  it('la autorización de grabación se pide a todo el que sale en el programa', () => {
    for (const perfil of PERFILES) {
      expect(campoVisible('autoriza_grabacion', perfil, 'en_linea'), perfil.clave).toBe(perfil.enPrograma);
    }
  });

  it('la prueba de conexión es para quien expone a distancia, no para quien va a la sede', () => {
    expect(campoVisible('prueba_conexion', perfilPorClave('conferencista'), 'en_linea')).toBe(true);
    expect(campoVisible('prueba_conexion', perfilPorClave('conferencista'), 'presencial')).toBe(false);
    expect(campoVisible('prueba_conexion', perfilPorClave('publico_general'), 'en_linea')).toBe(false);
  });

  it('los viáticos son sólo para invitados que viajan', () => {
    expect(campoVisible('datos_viatico', perfilPorClave('conferencista'), 'presencial')).toBe(true);
    expect(campoVisible('datos_viatico', perfilPorClave('dictaminador'), 'presencial')).toBe(false);
    expect(campoVisible('datos_viatico', perfilPorClave('conferencista'), 'en_linea')).toBe(false);
  });
});

describe('registros anteriores al cambio de perfiles', () => {
  it('una clave que ya no se traduce se muestra legible, no en crudo', () => {
    const t = { perfiles: { ponente: 'Ponente' } } as never;
    expect(nombrePerfil('ponente', t)).toBe('Ponente');
    expect(nombrePerfil('espectador_presencial', t)).toBe('Espectador presencial');
  });
});
