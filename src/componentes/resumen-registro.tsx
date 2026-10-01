'use client';

import { useApp } from './proveedores';
import { etiquetaDe, type GrupoOpciones } from '@/lib/opciones';
import {
  nombrePerfil, pasosVisibles, perfilPorClave,
  type Modalidad, type PasoFormulario,
} from '@/lib/perfiles';
import { traducir, type EjeTematico } from '@/lib/contenido';

type Registro = Record<string, unknown>;

interface Fila {
  clave: string;
  etiqueta: string;
  grupo?: GrupoOpciones;
  lista?: boolean;
}

interface Seccion {
  /**
   * El paso del formulario del que sale esta sección.
   *
   * Sin paso quiere decir que la sección ya no se pregunta. No se borra: hay
   * registros hechos que traen esos datos y el comité los sigue consultando.
   * Se enseñan sólo si la ficha tiene algo que enseñar.
   */
  paso?: PasoFormulario;
  titulo: string;
  filas: Fila[];
}

export function ResumenRegistro({
  registro,
  ejes = [],
}: {
  registro: Registro;
  /** Permite mostrar el nombre del eje temático en lugar de su clave. */
  ejes?: EjeTematico[];
}) {
  const { t, idioma } = useApp();
  const c = t.formulario.campos;

  const secciones: Seccion[] = [
    {
      paso: 'identificacion',
      titulo: t.formulario.secciones.identificacion,
      filas: [
        { clave: 'apellidos', etiqueta: c.apellidos },
        { clave: 'nombres', etiqueta: c.nombres },
        { clave: 'nombre_constancia', etiqueta: c.nombreConstancia },
        { clave: 'genero', etiqueta: c.genero, grupo: 'genero' },
        { clave: 'correo', etiqueta: c.correo },
        { clave: 'telefono_whatsapp', etiqueta: c.telefono },
        { clave: 'institucion', etiqueta: c.institucion },
        { clave: 'cargo', etiqueta: c.cargo },
        { clave: 'procedencia', etiqueta: c.procedencia, grupo: 'procedencia' },
        { clave: 'pais_residencia', etiqueta: c.pais },
        { clave: 'entidad_federativa', etiqueta: c.entidad },
        { clave: 'ciudad_residencia', etiqueta: c.ciudad },
        { clave: 'nacionalidad', etiqueta: c.nacionalidad },
        { clave: 'orcid', etiqueta: c.orcid },
      ],
    },
    {
      paso: 'ponencia',
      titulo: t.formulario.secciones.academico,
      filas: [
        { clave: 'modalidad_participacion', etiqueta: c.modalidadParticipacion, grupo: 'roles' },
        { clave: 'titulo_ponencia', etiqueta: c.tituloPonencia },
        { clave: 'resumen_ponencia', etiqueta: c.resumen },
        { clave: 'palabras_clave', etiqueta: c.palabrasClave },
        { clave: 'coautoria', etiqueta: c.coautoria },
      ],
    },
    {
      paso: 'semblanza',
      titulo: t.formulario.secciones.semblanza,
      filas: [
        { clave: 'semblanza_url', etiqueta: c.semblanzaArchivo },
        { clave: 'foto_url', etiqueta: c.foto },
        { clave: 'autorizaciones', etiqueta: c.autorizaciones, grupo: 'autorizaciones', lista: true },
      ],
    },
    {
      titulo: t.formulario.secciones.documentacion,
      filas: [
        // Sin `grupo`: las dos listas de documentación tienen etiquetas
        // distintas y aquí no se sabe cuál se usó. Se muestran los valores.
        { clave: 'documentacion_solicitada', etiqueta: c.documentacionSolicitada, lista: true },
        { clave: 'documentacion_otra', etiqueta: c.documentacionOtra },
        { clave: 'nombre_pasaporte', etiqueta: c.nombrePasaporte },
        { clave: 'destinatario_oficio', etiqueta: c.destinatarioOficio },
        { clave: 'boleto_url', etiqueta: c.boletoVuelo },
      ],
    },
    {
      paso: 'sala',
      titulo: t.formulario.secciones.sala,
      filas: [
        { clave: 'requerimientos_tecnicos', etiqueta: c.requerimientosTecnicos, grupo: 'tecnicos', lista: true },
      ],
    },
    {
      titulo: t.formulario.secciones.estacionamiento,
      filas: [
        { clave: 'placa_vehiculo', etiqueta: c.placa },
        { clave: 'modelo_vehiculo', etiqueta: c.modeloAuto },
        { clave: 'color_vehiculo', etiqueta: c.colorAuto },
        { clave: 'requerimientos_accesibilidad', etiqueta: c.accesibilidad },
      ],
    },
    {
      titulo: t.formulario.secciones.alojamiento,
      filas: [
        { clave: 'fecha_entrada_hotel', etiqueta: c.fechaEntradaHotel },
        { clave: 'fecha_salida_hotel', etiqueta: c.fechaSalidaHotel },
      ],
    },
    {
      // Sin `paso`, aunque «Llegada y salida» siga preguntándose: de los
      // trece campos que tuvo quedan tres, y los otros diez sólo existen en
      // fichas de antes. Atarla al paso los habría escondido justo en los
      // registros que los traen.
      titulo: t.formulario.secciones.traslados,
      filas: [
        { clave: 'ciudad_origen', etiqueta: c.ciudadOrigen },
        { clave: 'fecha_llegada', etiqueta: c.fechaLlegada },
        { clave: 'fecha_salida', etiqueta: c.fechaSalida },
        { clave: 'requiere_traslado', etiqueta: c.requiereTraslado, grupo: 'traslado' },
        { clave: 'medio_arribo', etiqueta: c.medioArribo, grupo: 'medioArribo' },
        { clave: 'terminal_origen', etiqueta: c.terminalOrigen },
        { clave: 'hora_llegada', etiqueta: c.horaLlegada },
        { clave: 'aerolinea_llegada', etiqueta: c.aerolineaLlegada },
        { clave: 'vuelo_llegada', etiqueta: c.vueloLlegada },
        { clave: 'hora_salida', etiqueta: c.horaSalida },
        { clave: 'aerolinea_salida', etiqueta: c.aerolineaSalida },
        { clave: 'vuelo_salida', etiqueta: c.vueloSalida },
        { clave: 'observaciones_traslado', etiqueta: c.observacionesTraslado },
      ],
    },
    {
      titulo: t.formulario.secciones.cierre,
      filas: [
        { clave: 'regimen_alimentario', etiqueta: c.regimenAlimentario },
        { clave: 'condicion_alimentaria_detalle', etiqueta: c.condicionAlimentariaDetalle },
        { clave: 'contacto_emergencia', etiqueta: c.contactoEmergencia },
        { clave: 'datos_viatico', etiqueta: c.datosViatico },
        { clave: 'datos_facturacion', etiqueta: c.datosFacturacion },
        { clave: 'comentarios', etiqueta: c.comentarios },
      ],
    },
  ];

  const preguntados = new Set<PasoFormulario>(
    pasosVisibles(
      perfilPorClave(String(registro.perfil)),
      registro.modalidad === 'en_linea' ? 'en_linea' : ('presencial' as Modalidad),
    ),
  );

  function valorDe(fila: Fila): string {
    const bruto = registro[fila.clave];
    if (bruto === null || bruto === undefined || bruto === '') return '';
    if (fila.clave === 'eje_tematico') {
      const eje = ejes.find((e) => e.clave === bruto);
      return eje ? traducir(eje.nombre, idioma) : String(bruto);
    }
    // Una columna `date` llega como objeto Date desde el controlador de
    // PostgreSQL, y convertirlo a texto a secas da «Mon Nov 09 2026 00:00:00
    // GMT+0000 (Coordinated Universal Time)» en la pantalla que alguien ve
    // justo después de registrarse. Va en hora UTC a propósito: la fecha se
    // guardó sin hora, y leerla en otro huso la correría un día.
    // Y por la API llega la misma fecha convertida a texto ISO, porque JSON
    // no tiene fechas: hay que reconocer las dos formas o el panel la pinta
    // distinto que la pantalla de confirmación.
    const fecha = bruto instanceof Date
      ? bruto
      : typeof bruto === 'string' && /^\d{4}-\d{2}-\d{2}(T00:00:00(\.000)?Z?)?$/.test(bruto)
        ? new Date(bruto.length === 10 ? `${bruto}T00:00:00Z` : bruto)
        : null;
    if (fecha && !Number.isNaN(fecha.getTime())) {
      return fecha.toLocaleDateString(idioma, {
        timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric',
      });
    }
    if (Array.isArray(bruto)) {
      if (bruto.length === 0) return '';
      return fila.grupo
        ? bruto.map((v) => etiquetaDe(fila.grupo!, String(v), t)).join(' · ')
        : bruto.join(' · ');
    }
    if (typeof bruto === 'boolean') return bruto ? t.formulario.opciones.si : t.formulario.opciones.no;
    return fila.grupo ? etiquetaDe(fila.grupo, String(bruto), t) : String(bruto);
  }

  return (
    <div className="space-y-6">
      <dl className="tarjeta grid gap-x-8 gap-y-3 p-5 sm:grid-cols-2">
        <Dato etiqueta={t.perfiles.titulo} valor={nombrePerfil(String(registro.perfil), t)} />
        <Dato
          etiqueta={t.modalidad.titulo}
          valor={registro.modalidad === 'en_linea' ? t.modalidad.en_linea : t.modalidad.presencial}
        />
      </dl>

      {secciones.map((seccion) => {
        // Ata el resumen a lo que a esa persona se le llegó a preguntar. Sin
        // esto, a quien participa en línea le aparecía un apartado
        // «Traslados» con un «No» que nunca respondió: el campo trae ese
        // valor por defecto y el resumen sólo miraba si estaba vacío.
        //
        // Las secciones sin paso son las que se dejaron de preguntar: pasan
        // el filtro y las frena el de abajo, que las esconde si están vacías.
        if (seccion.paso && !preguntados.has(seccion.paso)) return null;
        const visibles = seccion.filas.filter((f) => valorDe(f) !== '');
        if (visibles.length === 0) return null;
        return (
          <section key={seccion.titulo} className="tarjeta p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ciess-400">
              {seccion.titulo}
            </h3>
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {visibles.map((fila) => (
                <Dato key={fila.clave} etiqueta={fila.etiqueta} valor={valorDe(fila)} />
              ))}
            </dl>
          </section>
        );
      })}
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide tenue">{etiqueta}</dt>
      <dd className="mt-0.5 break-words text-sm">{valor}</dd>
    </div>
  );
}
