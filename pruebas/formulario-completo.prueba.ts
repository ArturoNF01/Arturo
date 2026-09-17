import { describe, expect, it } from 'vitest';
import {
  PASO_DE_CAMPO, PERFILES, campoVisible, pasosVisibles,
  type Modalidad,
} from '@/lib/perfiles';
import { esquemaRegistro } from '@/lib/esquema';

/**
 * Nadie debe ser rechazado por un campo que su formulario nunca le enseñó.
 *
 * Es el fallo que apareció cuando dejamos de pedirle el huso horario al
 * público en línea: el paso desapareció de la pantalla, pero la regla del
 * servidor seguía exigiéndolo, y el envío se rechazaba señalando una casilla
 * que no existía. Desde fuera se veía como «revise los campos marcados» sin
 * ningún campo marcado.
 *
 * En vez de probar ese caso, esta prueba recorre las doce combinaciones de
 * perfil y modalidad: rellena exactamente lo que el formulario enseña, nada
 * más, y comprueba que el servidor lo acepta. Cualquier regla futura que
 * exija algo invisible cae aquí.
 */

/** Un valor plausible para cada campo, del tipo que el esquema espera. */
const RESPUESTAS: Record<string, unknown> = {
  perfil: 'publico_general',
  modalidad: 'presencial',

  apellidos: 'Navarrete Fuentes',
  nombres: 'Arturo',
  nombre_constancia: 'Arturo Navarrete Fuentes',
  genero: 'Hombre',
  correo: 'persona@ejemplo.org',
  telefono_whatsapp: '+52 55 1234 5678',
  institucion: 'CIESS',
  cargo: 'Coordinación',
  procedencia: 'Nacional',
  pais_residencia: 'México',
  entidad_federativa: 'Ciudad de México',
  ciudad_residencia: 'Ciudad de México',
  nacionalidad: 'Mexicana',
  orcid: '0000-0002-1825-0097',

  titulo_ponencia: 'Cobertura y suficiencia de las pensiones',
  resumen_ponencia: 'Resumen breve de la ponencia.',
  idioma_ponencia: 'es',
  palabras_clave: 'pensiones, cobertura',
  coautoria: 'Sin coautoría',
  autoriza_publicacion: true,

  sesion_asignada: 'Mesa 3',
  disponibilidad_dias: ['11', '12'],

  ejes_dictamen: ['Financiamiento'],
  ponencias_maximas: 5,
  conflicto_interes: 'Ninguno',

  semblanza_url: 'https://drive.google.com/file/d/abc/view',
  foto_url: 'https://drive.google.com/file/d/def/view',
  autorizaciones: ['uso_imagen'],
  autoriza_grabacion: true,

  zona_horaria: 'America/Mexico_City',
  prueba_conexion: true,

  documentacion_solicitada: ['carta_invitacion'],
  documentacion_otra: '',
  nombre_pasaporte: 'ARTURO NAVARRETE FUENTES',
  destinatario_oficio: 'Dirección General',
  boleto_url: 'https://drive.google.com/file/d/ghi/view',

  requerimientos_tecnicos: ['proyector'],

  requiere_alojamiento: true,
  fecha_entrada_hotel: '2026-11-10',
  fecha_salida_hotel: '2026-11-14',

  requiere_traslado: 'Sí',
  medio_arribo: 'Avión',
  ciudad_origen: 'Bogotá',
  terminal_origen: 'El Dorado',
  fecha_llegada: '2026-11-10',
  hora_llegada: '18:40',
  aerolinea_llegada: 'Avianca',
  vuelo_llegada: 'AV123',
  fecha_salida: '2026-11-14',
  hora_salida: '07:15',
  aerolinea_salida: 'Avianca',
  vuelo_salida: 'AV124',
  observaciones_traslado: 'Sin observaciones',

  placa_vehiculo: 'ABC-12-34',
  modelo_vehiculo: 'Versa 2020',
  color_vehiculo: 'Blanco',
  requerimientos_accesibilidad: 'Ninguno',

  regimen_alimentario: 'Vegetariano',
  condicion_alimentaria: true,
  condicion_alimentaria_detalle: 'Celiaquía',
  contacto_emergencia: 'María Pérez, +52 55 8765 4321',
  apoyo_traslado: true,
  datos_viatico: 'Autobús desde Puebla',
  requiere_factura: true,
  datos_facturacion: 'RFC XAXX010101000',
  comentarios: 'Sin comentarios',

  consentimiento_datos: true,
  consentimiento_comunicaciones: true,
};

/** Lo que una persona de ese perfil y esa modalidad llega a rellenar. */
function loQueRellena(clave: string, modalidad: Modalidad) {
  const perfil = PERFILES.find((p) => p.clave === clave);
  const pasos = new Set(pasosVisibles(perfil, modalidad));
  const datos: Record<string, unknown> = { perfil: clave, modalidad };

  for (const [campo, paso] of Object.entries(PASO_DE_CAMPO)) {
    if (campo === 'perfil' || campo === 'modalidad') continue;
    if (!pasos.has(paso)) continue;
    if (!campoVisible(campo, perfil, modalidad)) continue;
    datos[campo] = RESPUESTAS[campo];
  }
  return datos;
}

describe('un registro con sólo lo que el formulario enseña', () => {
  it('cubre las respuestas de todos los campos del mapa', () => {
    const sinRespuesta = Object.keys(PASO_DE_CAMPO).filter((c) => !(c in RESPUESTAS));
    expect(sinRespuesta, `sin valor de ejemplo: ${sinRespuesta.join(', ')}`).toEqual([]);
  });

  for (const { clave } of PERFILES) {
    for (const modalidad of ['presencial', 'en_linea'] as const) {
      it(`${clave} · ${modalidad} se acepta`, () => {
        const resultado = esquemaRegistro.safeParse(loQueRellena(clave, modalidad));
        const fallos = resultado.success
          ? []
          : resultado.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
        expect(fallos, `el servidor rechaza campos que nadie vio`).toEqual([]);
      });
    }
  }
});

describe('a quien participa en línea no se le pregunta por la sede', () => {
  const deSede = ['sala', 'alojamiento', 'traslados', 'estacionamiento', 'documentacion', 'cierre'];

  for (const { clave } of PERFILES) {
    it(`${clave} en línea no ve ningún paso presencial`, () => {
      const pasos = pasosVisibles(PERFILES.find((p) => p.clave === clave), 'en_linea');
      expect(pasos.filter((p) => deSede.includes(p))).toEqual([]);
    });
  }

  it('el público en línea no pasa por «Participación en línea»', () => {
    const pasos = pasosVisibles(PERFILES.find((p) => p.clave === 'publico_general'), 'en_linea');
    expect(pasos).not.toContain('conexion');
    expect(pasos).toEqual(['perfil', 'identificacion', 'privacidad']);
  });

  it('a quien sí tiene hora en el programa se le sigue preguntando', () => {
    for (const clave of ['ponente', 'conferencista', 'moderador'] as const) {
      const pasos = pasosVisibles(PERFILES.find((p) => p.clave === clave), 'en_linea');
      expect(pasos, clave).toContain('conexion');
    }
  });
});
