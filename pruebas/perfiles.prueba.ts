import { describe, expect, it } from 'vitest';
import {
  CLAVES_PERFIL, PERFILES, campoVisible, nombrePerfil, pasosVisibles, perfilPorClave,
} from '@/lib/perfiles';

describe('pasos del formulario según el perfil', () => {
  it('el público general en línea sólo ve lo indispensable', () => {
    // Quien sigue la transmisión no tiene hora asignada ni pisa la sede: ni
    // huso horario, ni comida, ni facturación. Tres pantallas y fuera.
    const pasos = pasosVisibles(perfilPorClave('publico_general'), 'en_linea');
    expect(pasos).toEqual(['perfil', 'identificacion', 'privacidad']);
  });

  it('al público general no se le preguntan requerimientos de sala', () => {
    // Proyector y micrófono son de quien expone, no de quien viene a
    // escuchar. La documentación de invitación, tampoco: no viene invitado.
    const pasos = pasosVisibles(perfilPorClave('publico_general'), 'presencial');
    expect(pasos).not.toContain('sala');
    expect(pasos).not.toContain('documentacion');
    expect(pasos).not.toContain('semblanza');
    // Hospedaje y viaje sí: quien pisa la sede cuenta para la logística,
    // venga invitado o por su cuenta.
    expect(pasos).toContain('alojamiento');
    expect(pasos).toContain('traslados');
  });

  it('quien sale en el programa sí los ve, si asiste en persona', () => {
    expect(pasosVisibles(perfilPorClave('ponente'), 'presencial')).toContain('sala');
  });

  it('un ponente presencial recorre todas las secciones que le tocan', () => {
    // Sin traslados: ese servicio es sólo para quien da una conferencia.
    expect(pasosVisibles(perfilPorClave('ponente'), 'presencial')).toEqual([
      'perfil', 'identificacion', 'ponencia', 'semblanza', 'documentacion',
      'sala', 'alojamiento', 'traslados', 'privacidad',
    ]);
  });

  it('a quien viene en persona se le pide viaje y hospedaje, exponga o no', () => {
    for (const clave of CLAVES_PERFIL) {
      const pasos = pasosVisibles(perfilPorClave(clave), 'presencial');
      expect(pasos, clave).toContain('alojamiento');
      expect(pasos, clave).toContain('traslados');
    }
  });

  it('la recepción en el aeropuerto sólo se le ofrece a quien sube al programa', () => {
    // Los datos del vuelo se piden a todos; el servicio, no. Preguntarle al
    // público si lo quiere sería ofrecérselo.
    expect(campoVisible('requiere_traslado', perfilPorClave('ponente'), 'presencial')).toBe(true);
    expect(campoVisible('requiere_traslado', perfilPorClave('publico_general'), 'presencial')).toBe(false);
  });

  it('estacionamiento y cierre ya no se preguntan a nadie', () => {
    // Se quitaron al simplificar: placas, régimen alimentario, facturación y
    // contacto de emergencia dejaron de recogerse en el registro.
    for (const clave of CLAVES_PERFIL) {
      for (const modalidad of ['presencial', 'en_linea'] as const) {
        const pasos = pasosVisibles(perfilPorClave(clave), modalidad);
        expect(pasos, `${clave}/${modalidad}`).not.toContain('estacionamiento');
        expect(pasos, `${clave}/${modalidad}`).not.toContain('cierre');
      }
    }
  });

  it('nada de la sede le aparece a quien participa en línea', () => {
    // Sala, hotel, traslados, comida y estacionamiento sobran si no se viene.
    for (const clave of CLAVES_PERFIL) {
      const pasos = pasosVisibles(perfilPorClave(clave), 'en_linea');
      for (const paso of ['sala', 'alojamiento', 'traslados', 'documentacion']) {
        expect(pasos, `${clave} · ${paso}`).not.toContain(paso);
      }
    }
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

  it('sólo hay dos perfiles con los que registrarse', () => {
    // Fueron seis. Las cuatro claves que se fueron —conferencista,
    // coordinador, moderador, dictaminador— se resuelven por invitación y
    // no deben poder elegirse: son las que abrían ramas enteras del
    // formulario que ya nadie mantiene.
    expect([...CLAVES_PERFIL]).toEqual(['ponente', 'publico_general']);
    for (const vieja of ['conferencista', 'coordinador', 'moderador', 'dictaminador']) {
      expect(perfilPorClave(vieja), vieja).toBeUndefined();
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
  it('la fotografía se le pide a quien sale en el programa, no al público', () => {
    expect(campoVisible('foto', perfilPorClave('ponente'), 'presencial')).toBe(true);
    expect(campoVisible('foto', perfilPorClave('publico_general'), 'presencial')).toBe(false);
  });

  it('el ORCID se pide a quien presenta, no al público', () => {
    expect(campoVisible('orcid', perfilPorClave('ponente'), 'presencial')).toBe(true);
    expect(campoVisible('orcid', perfilPorClave('publico_general'), 'presencial')).toBe(false);
  });

  it('la autorización de grabación se pide a todo el que sale en el programa', () => {
    for (const perfil of PERFILES) {
      expect(campoVisible('autoriza_grabacion', perfil, 'en_linea'), perfil.clave).toBe(perfil.enPrograma);
    }
  });

  it('la prueba de conexión es para quien expone a distancia, no para quien va a la sede', () => {
    expect(campoVisible('prueba_conexion', perfilPorClave('ponente'), 'en_linea')).toBe(true);
    expect(campoVisible('prueba_conexion', perfilPorClave('ponente'), 'presencial')).toBe(false);
    expect(campoVisible('prueba_conexion', perfilPorClave('publico_general'), 'en_linea')).toBe(false);
  });

});

describe('registros anteriores al cambio de perfiles', () => {
  it('una clave que ya no se traduce se muestra legible, no en crudo', () => {
    const t = { perfiles: { ponente: 'Ponente' } } as never;
    expect(nombrePerfil('ponente', t)).toBe('Ponente');
    expect(nombrePerfil('espectador_presencial', t)).toBe('Espectador presencial');
  });
});
