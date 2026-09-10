'use client';

import { useApp } from './proveedores';
import { etiquetaDe, type GrupoOpciones } from '@/lib/opciones';
import { nombrePerfil } from '@/lib/perfiles';
import { traducir, type EjeTematico } from '@/lib/contenido';

type Registro = Record<string, unknown>;

interface Fila {
  clave: string;
  etiqueta: string;
  grupo?: GrupoOpciones;
  lista?: boolean;
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

  const secciones: { titulo: string; filas: Fila[] }[] = [
    {
      titulo: t.formulario.secciones.identificacion,
      filas: [
        { clave: 'apellidos', etiqueta: c.apellidos },
        { clave: 'nombres', etiqueta: c.nombres },
        { clave: 'nombre_personificador', etiqueta: c.nombrePersonificador },
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
      titulo: t.formulario.secciones.academico,
      filas: [
        { clave: 'modalidad_participacion', etiqueta: c.modalidadParticipacion, grupo: 'roles' },
        { clave: 'eje_tematico', etiqueta: c.ejeTematico },
        { clave: 'titulo_ponencia', etiqueta: c.tituloPonencia },
        { clave: 'resumen_ponencia', etiqueta: c.resumen },
        { clave: 'palabras_clave', etiqueta: c.palabrasClave },
        { clave: 'coautoria', etiqueta: c.coautoria },
      ],
    },
    {
      titulo: t.formulario.secciones.semblanza,
      filas: [
        { clave: 'semblanza', etiqueta: c.semblanza },
        { clave: 'linea_investigacion', etiqueta: c.lineaInvestigacion },
        { clave: 'foto_url', etiqueta: c.foto },
        { clave: 'autorizaciones', etiqueta: c.autorizaciones, grupo: 'autorizaciones', lista: true },
      ],
    },
    {
      titulo: t.formulario.secciones.documentacion,
      filas: [
        { clave: 'documentacion_solicitada', etiqueta: c.documentacionSolicitada, grupo: 'documentacion', lista: true },
        { clave: 'nombre_pasaporte', etiqueta: c.nombrePasaporte },
        { clave: 'destinatario_oficio', etiqueta: c.destinatarioOficio },
      ],
    },
    {
      titulo: t.formulario.secciones.sala,
      filas: [
        { clave: 'requerimientos_tecnicos', etiqueta: c.requerimientosTecnicos, grupo: 'tecnicos', lista: true },
        { clave: 'requerimientos_accesibilidad', etiqueta: c.accesibilidad },
      ],
    },
    {
      titulo: t.formulario.secciones.alojamiento,
      filas: [
        { clave: 'fecha_entrada_hotel', etiqueta: c.fechaEntradaHotel },
        { clave: 'fecha_salida_hotel', etiqueta: c.fechaSalidaHotel },
        { clave: 'tipo_habitacion', etiqueta: c.tipoHabitacion, grupo: 'habitacion' },
        { clave: 'comparte_habitacion_con', etiqueta: c.comparteCon },
      ],
    },
    {
      titulo: t.formulario.secciones.traslados,
      filas: [
        { clave: 'requiere_traslado', etiqueta: c.requiereTraslado, grupo: 'traslado' },
        { clave: 'medio_arribo', etiqueta: c.medioArribo, grupo: 'medioArribo' },
        { clave: 'ciudad_origen', etiqueta: c.ciudadOrigen },
        { clave: 'terminal_origen', etiqueta: c.terminalOrigen },
        { clave: 'fecha_llegada', etiqueta: c.fechaLlegada },
        { clave: 'hora_llegada', etiqueta: c.horaLlegada },
        { clave: 'aerolinea_llegada', etiqueta: c.aerolineaLlegada },
        { clave: 'vuelo_llegada', etiqueta: c.vueloLlegada },
        { clave: 'fecha_salida', etiqueta: c.fechaSalida },
        { clave: 'hora_salida', etiqueta: c.horaSalida },
        { clave: 'aerolinea_salida', etiqueta: c.aerolineaSalida },
        { clave: 'vuelo_salida', etiqueta: c.vueloSalida },
        { clave: 'observaciones_traslado', etiqueta: c.observacionesTraslado },
      ],
    },
    {
      titulo: t.formulario.secciones.cierre,
      filas: [
        { clave: 'regimen_alimentario', etiqueta: c.regimenAlimentario, grupo: 'regimen' },
        { clave: 'alergias', etiqueta: c.alergias },
        { clave: 'contacto_emergencia', etiqueta: c.contactoEmergencia },
        { clave: 'datos_viatico', etiqueta: c.datosViatico },
        { clave: 'datos_facturacion', etiqueta: c.datosFacturacion },
        { clave: 'comentarios', etiqueta: c.comentarios },
      ],
    },
  ];

  function valorDe(fila: Fila): string {
    const bruto = registro[fila.clave];
    if (bruto === null || bruto === undefined || bruto === '') return '';
    if (fila.clave === 'eje_tematico') {
      const eje = ejes.find((e) => e.clave === bruto);
      return eje ? traducir(eje.nombre, idioma) : String(bruto);
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
