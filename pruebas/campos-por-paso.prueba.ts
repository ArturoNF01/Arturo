import { describe, expect, it } from 'vitest';
import { PASO_DE_CAMPO, PERFILES, pasosVisibles } from '@/lib/perfiles';
import { esquemaRegistro } from '@/lib/esquema';

/**
 * El mapa de campo a paso es lo que permite llevar a quien se registra hasta
 * donde está el problema. Un campo que falte ahí vuelve a producir el fallo
 * de origen: «revise los campos marcados» en el último paso, con los campos
 * marcados siete pantallas atrás y sin manera de llegar a ellos.
 */
describe('a qué paso pertenece cada campo', () => {
  const auxiliares = new Set([
    // Campos de la interfaz que no se guardan, y datos que el formulario
    // rellena solo: no hay una casilla que enfocar para ninguno.
    'idioma', 'token', 'sitio_web', 'abierto_en', 'estado', 'grupo',
    'modalidad_participacion', 'semblanza_drive_id', 'foto_drive_id',
    'boleto_drive_id', 'correo_alterno', 'disponibilidad_dias',

    // De cuando había seis perfiles: los preguntaban las secciones de
    // «Sesión a su cargo» y «Dictamen», que se fueron con los perfiles de
    // coordinador, moderador y dictaminador. El esquema los sigue aceptando
    // —hay registros hechos que los traen y el panel los muestra— pero
    // ningún formulario los pide ya, así que no hay paso al que llevar a
    // nadie.
    'sesion_asignada', 'ejes_dictamen', 'ponencias_maximas', 'conflicto_interes',

    // Y de cuando el formulario preguntaba por el coche y por la comida. Las
    // secciones «Estacionamiento» y «Alimentación y cierre» se quitaron al
    // simplificar el registro; las columnas siguen en la base porque hay
    // fichas que las traen y el panel las sigue mostrando, pero ningún
    // formulario las pide, así que no hay paso al que llevar a nadie.
    'placa_vehiculo', 'modelo_vehiculo', 'color_vehiculo',
    'requerimientos_accesibilidad', 'regimen_alimentario', 'condicion_alimentaria',
    'condicion_alimentaria_detalle', 'contacto_emergencia', 'apoyo_traslado',
    'datos_viatico', 'requiere_factura', 'datos_facturacion', 'comentarios',

    // Y del último recorte, el que dejó el registro en lo mínimo. De la
    // identificación se fueron la entidad, la ciudad, la nacionalidad y el
    // ORCID; de la ponencia, la coautoría y el permiso de publicación; y
    // enteras, la documentación de invitación —la tramita el comité, no se
    // pide por formulario—, el alojamiento, y todo lo que hacía falta sólo
    // para ir a recoger a alguien al aeropuerto. De quien viene a escuchar
    // quedan tres: de dónde llega y qué días está.
    'entidad_federativa', 'ciudad_residencia', 'nacionalidad', 'orcid',
    'autoriza_publicacion', 'coautoria',
    'documentacion_solicitada', 'nombre_pasaporte', 'destinatario_oficio',
    'documentacion_otra', 'boleto_url',
    // Y la semblanza, que se retiró entera: el PDF, la fotografía y las
    // autorizaciones sueltas. La de grabación no está aquí porque sigue
    // pidiéndose, con los demás consentimientos.
    'semblanza_url', 'foto_url', 'autorizaciones',
    'requiere_traslado', 'medio_arribo', 'terminal_origen',
    'hora_llegada', 'aerolinea_llegada', 'vuelo_llegada',
    'hora_salida', 'aerolinea_salida', 'vuelo_salida', 'observaciones_traslado',
  ]);

  it('todo campo que el servidor puede rechazar sabe en qué paso está', () => {
    // El esquema lleva un superRefine encima, así que el objeto con los
    // campos está una capa más adentro.
    type ConForma = { _def: { schema?: ConForma }; shape?: Record<string, unknown> };
    let nodo = esquemaRegistro as unknown as ConForma;
    while (!nodo.shape && nodo._def?.schema) nodo = nodo._def.schema;

    const claves = Object.keys(nodo.shape ?? {});
    expect(claves.length, 'no se pudo leer la forma del esquema').toBeGreaterThan(20);

    const huerfanos = claves.filter((c) => !auxiliares.has(c) && !PASO_DE_CAMPO[c]);
    expect(huerfanos, `sin paso asignado: ${huerfanos.join(', ')}`).toEqual([]);
  });

  it('cada paso al que apunta el mapa existe de verdad para algún perfil', () => {
    const reales = new Set(
      PERFILES.flatMap((p) => [
        ...pasosVisibles(p, 'presencial'),
        ...pasosVisibles(p, 'en_linea'),
      ]),
    );
    for (const [campo, paso] of Object.entries(PASO_DE_CAMPO)) {
      expect(reales.has(paso), `${campo} → ${paso}`).toBe(true);
    }
  });
});
