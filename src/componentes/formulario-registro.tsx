'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApp } from './proveedores';
import {
  CampoCasillas, CampoInterruptor, CampoOpcionUnica, CampoParrafo,
  CampoSeleccion, CampoTexto,
} from './campos';
import { SubidaFotografia } from './subida-fotografia';
import {
  PERFILES, campoVisible, pasosVisibles, perfilPorClave,
  type ClavePerfil, type Modalidad, type PasoFormulario,
} from '@/lib/perfiles';
import type { ConfiguracionPublica } from '@/lib/servidor/configuracion';
import { opciones } from '@/lib/opciones';
import { traducir, type DatosCongreso, type EjeTematico } from '@/lib/contenido';
import { interpolar } from '@/i18n';

type Valores = Record<string, string | boolean | string[]>;

const VALORES_INICIALES: Valores = {
  perfil: '', modalidad: 'presencial',
  apellidos: '', nombres: '', nombre_personificador: '', nombre_constancia: '', genero: '',
  correo: '', telefono_whatsapp: '', institucion: '', cargo: '', procedencia: '',
  pais_residencia: '', entidad_federativa: '', ciudad_residencia: '', nacionalidad: '', orcid: '',
  modalidad_participacion: '', eje_tematico: '', titulo_ponencia: '', resumen_ponencia: '',
  palabras_clave: '', coautoria: '',
  semblanza: '', linea_investigacion: '', foto_url: '', foto_drive_id: '',
  documentacion_solicitada: [], nombre_pasaporte: '', destinatario_oficio: '', autorizaciones: [],
  requerimientos_tecnicos: [], requerimientos_accesibilidad: '',
  requiere_alojamiento: false, fecha_entrada_hotel: '', fecha_salida_hotel: '',
  tipo_habitacion: '', comparte_habitacion_con: '',
  requiere_traslado: 'no', _alojamiento: '', medio_arribo: '', ciudad_origen: '', terminal_origen: '',
  fecha_llegada: '', hora_llegada: '', aerolinea_llegada: '', vuelo_llegada: '',
  fecha_salida: '', hora_salida: '', aerolinea_salida: '', vuelo_salida: '',
  observaciones_traslado: '',
  regimen_alimentario: '', alergias: '', contacto_emergencia: '',
  apoyo_traslado: false, datos_viatico: '', requiere_factura: false, datos_facturacion: '',
  comentarios: '',
  consentimiento_datos: false, consentimiento_comunicaciones: false,
};

export function FormularioRegistro({
  configuracion,
  congreso,
  ejes,
  registroExistente,
  token,
}: {
  configuracion: ConfiguracionPublica;
  congreso: DatosCongreso;
  ejes: EjeTematico[];
  registroExistente?: Record<string, unknown>;
  token?: string;
}) {
  const { t, idioma, tt } = useApp();
  const router = useRouter();

  const [valores, setValores] = useState<Valores>(() => {
    if (!registroExistente) return { ...VALORES_INICIALES };
    const inicial = { ...VALORES_INICIALES };
    for (const clave of Object.keys(inicial)) {
      const v = registroExistente[clave];
      if (v === null || v === undefined) continue;
      inicial[clave] = Array.isArray(inicial[clave]) ? (v as string[]) ?? [] : (v as string | boolean);
    }
    inicial.consentimiento_datos = true;
    inicial._alojamiento = registroExistente.requiere_alojamiento ? 'si' : 'no';
    return inicial;
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [indicePaso, setIndicePaso] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState('');

  const perfil = perfilPorClave(valores.perfil as string);
  const modalidad = valores.modalidad as Modalidad;
  const pasos = useMemo(() => pasosVisibles(perfil, modalidad), [perfil, modalidad]);
  const pasoActual = pasos[Math.min(indicePaso, pasos.length - 1)];
  // Sin perfil elegido sólo existe el primer paso: el botón principal debe
  // invitar a continuar, no a enviar un registro que aún no tiene datos.
  const esUltimo = pasos.length > 1 && indicePaso >= pasos.length - 1;

  const restantes =
    configuracion.cupos_presenciales === null
      ? null
      : Math.max(0, configuracion.cupos_presenciales - configuracion.ocupado_presencial);
  const presencialAgotado = restantes !== null && restantes <= 0;

  const fijar = (clave: string, valor: string | boolean | string[]) => {
    setValores((v) => ({ ...v, [clave]: valor }));
    setErrores((e) => (e[clave] ? { ...e, [clave]: '' } : e));
  };
  const texto = (clave: string) => (valores[clave] as string) ?? '';
  const lista = (clave: string) => (valores[clave] as string[]) ?? [];
  const visible = (clave: string) => campoVisible(clave, perfil, modalidad);

  function validarPaso(paso: PasoFormulario): boolean {
    const nuevos: Record<string, string> = {};
    const obligatorio = (clave: string) => {
      if (!texto(clave).trim()) nuevos[clave] = t.formulario.validacion.requerido;
    };

    if (paso === 'perfil' && !valores.perfil) nuevos.perfil = t.formulario.validacion.requerido;

    if (paso === 'identificacion') {
      ['apellidos', 'nombres', 'correo', 'institucion', 'pais_residencia'].forEach(obligatorio);
      if (texto('correo') && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(texto('correo'))) {
        nuevos.correo = t.formulario.validacion.correo;
      }
      if (texto('orcid') && !/^\d{4}-\d{4}-\d{4}-\d{3}[\dXx]$/.test(texto('orcid'))) {
        nuevos.orcid = t.formulario.validacion.orcid;
      }
      if (perfil?.requiereSemblanza) obligatorio('nombre_personificador');
    }

    if (paso === 'semblanza' && texto('semblanza').length > congreso.limite_semblanza_caracteres) {
      nuevos.semblanza = interpolar(t.formulario.validacion.semblanzaLarga, {
        max: congreso.limite_semblanza_caracteres,
      });
    }
    if (paso === 'academico' && texto('resumen_ponencia').length > congreso.limite_resumen_caracteres) {
      nuevos.resumen_ponencia = interpolar(t.formulario.validacion.resumenLargo, {
        max: congreso.limite_resumen_caracteres,
      });
    }
    if (paso === 'privacidad' && !valores.consentimiento_datos) {
      nuevos.consentimiento_datos = t.formulario.validacion.consentimiento;
    }

    setErrores((e) => ({ ...e, ...nuevos }));
    return Object.keys(nuevos).length === 0;
  }

  function avanzar() {
    if (!validarPaso(pasoActual)) return;
    setIndicePaso((i) => Math.min(i + 1, pasos.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function retroceder() {
    setIndicePaso((i) => Math.max(i - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function enviar() {
    if (!validarPaso('privacidad')) return;
    setEnviando(true);
    setErrorGeneral('');
    try {
      const cuerpo = { ...valores, idioma };
      const respuesta = await fetch(
        registroExistente ? `/api/registros/${registroExistente.id}` : '/api/registros',
        {
          method: registroExistente ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(token ? { ...cuerpo, token } : cuerpo),
        },
      );
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        setErrorGeneral(datos.mensaje ?? t.estados.error);
        if (datos.errores) setErrores(datos.errores);
        return;
      }
      router.push(`/confirmacion/${datos.id}?token=${datos.token_edicion}`);
    } catch {
      setErrorGeneral(t.estados.error);
    } finally {
      setEnviando(false);
    }
  }

  if (!configuracion.registro_abierto) {
    return (
      <div className="tarjeta mx-auto max-w-2xl p-8 text-center">
        <p className="text-lg font-semibold">{t.formulario.cerrado}</p>
        <p className="ayuda mt-2">{configuracion.correo_contacto}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
      <ProgresoPasos pasos={pasos} indice={indicePaso} onIr={setIndicePaso} />

      <div className="tarjeta mt-6 p-5 sm:p-8">
        {pasoActual === 'perfil' && (
          <PasoPerfil
            valores={valores}
            fijar={fijar}
            errores={errores}
            restantes={restantes}
            presencialAgotado={presencialAgotado}
          />
        )}

        {pasoActual === 'identificacion' && (
          <section className="space-y-5">
            <Cabecera titulo={t.formulario.secciones.identificacion} ayuda={t.formulario.secciones.identificacionAyuda} />
            <div className="grid gap-5 sm:grid-cols-2">
              <CampoTexto etiqueta={t.formulario.campos.apellidos} requerido valor={texto('apellidos')} onChange={(v) => fijar('apellidos', v)} error={errores.apellidos} />
              <CampoTexto etiqueta={t.formulario.campos.nombres} requerido valor={texto('nombres')} onChange={(v) => fijar('nombres', v)} error={errores.nombres} />
            </div>
            {visible('nombre_personificador') && (
              <CampoTexto etiqueta={t.formulario.campos.nombrePersonificador} ayuda={t.formulario.campos.nombrePersonificadorAyuda} requerido valor={texto('nombre_personificador')} onChange={(v) => fijar('nombre_personificador', v)} error={errores.nombre_personificador} />
            )}
            {visible('nombre_constancia') && (
              <CampoTexto etiqueta={t.formulario.campos.nombreConstancia} ayuda={t.formulario.campos.nombreConstanciaAyuda} valor={texto('nombre_constancia')} onChange={(v) => fijar('nombre_constancia', v)} />
            )}
            <CampoSeleccion etiqueta={t.formulario.campos.genero} opciones={opciones('genero', t)} valor={texto('genero')} onChange={(v) => fijar('genero', v)} />
            <div className="grid gap-5 sm:grid-cols-2">
              <CampoTexto etiqueta={t.formulario.campos.correo} tipo="email" requerido valor={texto('correo')} onChange={(v) => fijar('correo', v)} error={errores.correo} />
              <CampoTexto etiqueta={t.formulario.campos.telefono} ayuda={t.formulario.campos.telefonoAyuda} tipo="tel" valor={texto('telefono_whatsapp')} onChange={(v) => fijar('telefono_whatsapp', v)} />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <CampoTexto etiqueta={t.formulario.campos.institucion} requerido valor={texto('institucion')} onChange={(v) => fijar('institucion', v)} error={errores.institucion} />
              <CampoTexto etiqueta={t.formulario.campos.cargo} valor={texto('cargo')} onChange={(v) => fijar('cargo', v)} />
            </div>
            {visible('procedencia') && (
              <CampoOpcionUnica etiqueta={t.formulario.campos.procedencia} ayuda={t.formulario.campos.procedenciaAyuda} opciones={opciones('procedencia', t)} valor={texto('procedencia')} onChange={(v) => fijar('procedencia', v)} />
            )}
            <div className="grid gap-5 sm:grid-cols-3">
              <CampoTexto etiqueta={t.formulario.campos.pais} requerido valor={texto('pais_residencia')} onChange={(v) => fijar('pais_residencia', v)} error={errores.pais_residencia} />
              <CampoTexto etiqueta={t.formulario.campos.entidad} ayuda={t.formulario.campos.entidadAyuda} valor={texto('entidad_federativa')} onChange={(v) => fijar('entidad_federativa', v)} />
              <CampoTexto etiqueta={t.formulario.campos.ciudad} valor={texto('ciudad_residencia')} onChange={(v) => fijar('ciudad_residencia', v)} />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {visible('nacionalidad') && (
                <CampoTexto etiqueta={t.formulario.campos.nacionalidad} ayuda={t.formulario.campos.nacionalidadAyuda} valor={texto('nacionalidad')} onChange={(v) => fijar('nacionalidad', v)} />
              )}
              {visible('orcid') && (
                <CampoTexto etiqueta={t.formulario.campos.orcid} ayuda={t.formulario.campos.orcidAyuda} marcador="0000-0000-0000-0000" valor={texto('orcid')} onChange={(v) => fijar('orcid', v)} error={errores.orcid} />
              )}
            </div>
          </section>
        )}

        {pasoActual === 'academico' && (
          <section className="space-y-5">
            <Cabecera titulo={t.formulario.secciones.academico} />
            <CampoOpcionUnica etiqueta={t.formulario.campos.modalidadParticipacion} opciones={opciones('roles', t)} valor={texto('modalidad_participacion')} onChange={(v) => fijar('modalidad_participacion', v)} error={errores.modalidad_participacion} columnas={2} />
            <CampoSeleccion etiqueta={t.formulario.campos.ejeTematico} opciones={ejes.map((e) => ({ valor: e.clave, etiqueta: traducir(e.nombre, idioma) }))} valor={texto('eje_tematico')} onChange={(v) => fijar('eje_tematico', v)} />
            <CampoTexto etiqueta={t.formulario.campos.tituloPonencia} ayuda={t.formulario.campos.tituloPonenciaAyuda} valor={texto('titulo_ponencia')} onChange={(v) => fijar('titulo_ponencia', v)} />
            <CampoParrafo
              etiqueta={t.formulario.campos.resumen}
              ayuda={interpolar(t.formulario.campos.resumenAyuda, { max: congreso.limite_resumen_caracteres })}
              filas={7}
              maximo={congreso.limite_resumen_caracteres}
              contador
              textoContador={interpolar(t.formulario.validacion.caracteres, {
                n: texto('resumen_ponencia').length, max: congreso.limite_resumen_caracteres,
              })}
              valor={texto('resumen_ponencia')}
              onChange={(v) => fijar('resumen_ponencia', v)}
              error={errores.resumen_ponencia}
            />
            <CampoTexto etiqueta={t.formulario.campos.palabrasClave} valor={texto('palabras_clave')} onChange={(v) => fijar('palabras_clave', v)} />
            <CampoParrafo etiqueta={t.formulario.campos.coautoria} ayuda={t.formulario.campos.coautoriaAyuda} filas={3} valor={texto('coautoria')} onChange={(v) => fijar('coautoria', v)} />
          </section>
        )}

        {pasoActual === 'semblanza' && (
          <section className="space-y-5">
            <Cabecera titulo={t.formulario.secciones.semblanza} ayuda={t.formulario.secciones.semblanzaAyuda} />
            <CampoParrafo
              etiqueta={t.formulario.campos.semblanza}
              ayuda={interpolar(t.formulario.campos.semblanzaAyuda, {
                palabras: congreso.limite_semblanza_palabras,
                caracteres: congreso.limite_semblanza_caracteres,
              })}
              filas={6}
              maximo={congreso.limite_semblanza_caracteres}
              contador
              textoContador={`${interpolar(t.formulario.validacion.semblanzaPalabras, {
                n: texto('semblanza').trim() ? texto('semblanza').trim().split(/\s+/).length : 0,
                max: congreso.limite_semblanza_palabras,
              })} · ${interpolar(t.formulario.validacion.caracteres, {
                n: texto('semblanza').length, max: congreso.limite_semblanza_caracteres,
              })}`}
              valor={texto('semblanza')}
              onChange={(v) => fijar('semblanza', v)}
              error={errores.semblanza}
            />
            <CampoTexto etiqueta={t.formulario.campos.lineaInvestigacion} valor={texto('linea_investigacion')} onChange={(v) => fijar('linea_investigacion', v)} />
            <SubidaFotografia
              megabytesMaximo={congreso.foto_megabytes_maximo}
              valorUrl={texto('foto_url')}
              onSubida={(url, id) => { fijar('foto_url', url); fijar('foto_drive_id', id); }}
              onQuitar={() => { fijar('foto_url', ''); fijar('foto_drive_id', ''); }}
            />
            <CampoCasillas etiqueta={t.formulario.campos.autorizaciones} opciones={opciones('autorizaciones', t)} valores={lista('autorizaciones')} onChange={(v) => fijar('autorizaciones', v)} />
          </section>
        )}

        {pasoActual === 'documentacion' && (
          <section className="space-y-5">
            <Cabecera titulo={t.formulario.secciones.documentacion} ayuda={t.formulario.secciones.documentacionAyuda} />
            <CampoCasillas etiqueta={t.formulario.campos.documentacionSolicitada} opciones={opciones('documentacion', t)} valores={lista('documentacion_solicitada')} onChange={(v) => fijar('documentacion_solicitada', v)} />
            <CampoTexto etiqueta={t.formulario.campos.nombrePasaporte} ayuda={t.formulario.campos.nombrePasaporteAyuda} valor={texto('nombre_pasaporte')} onChange={(v) => fijar('nombre_pasaporte', v)} />
            <CampoParrafo etiqueta={t.formulario.campos.destinatarioOficio} ayuda={t.formulario.campos.destinatarioOficioAyuda} filas={3} valor={texto('destinatario_oficio')} onChange={(v) => fijar('destinatario_oficio', v)} />
          </section>
        )}

        {pasoActual === 'sala' && (
          <section className="space-y-5">
            <Cabecera titulo={t.formulario.secciones.sala} />
            <CampoCasillas etiqueta={t.formulario.campos.requerimientosTecnicos} opciones={opciones('tecnicos', t)} valores={lista('requerimientos_tecnicos')} onChange={(v) => fijar('requerimientos_tecnicos', v)} />
            <CampoParrafo etiqueta={t.formulario.campos.accesibilidad} ayuda={t.formulario.campos.accesibilidadAyuda} filas={3} valor={texto('requerimientos_accesibilidad')} onChange={(v) => fijar('requerimientos_accesibilidad', v)} />
          </section>
        )}

        {pasoActual === 'alojamiento' && (
          <section className="space-y-5">
            <Cabecera titulo={t.formulario.secciones.alojamiento} ayuda={t.formulario.secciones.alojamientoAyuda} />
            <CampoOpcionUnica
              etiqueta={t.formulario.campos.requiereAlojamiento}
              opciones={opciones('alojamiento', t)}
              valor={texto('_alojamiento')}
              onChange={(v) => {
                fijar('_alojamiento', v);
                fijar('requiere_alojamiento', v === 'si');
              }}
            />
            {valores.requiere_alojamiento && (
              <>
                <div className="grid gap-5 sm:grid-cols-2">
                  <CampoTexto etiqueta={t.formulario.campos.fechaEntradaHotel} tipo="date" valor={texto('fecha_entrada_hotel')} onChange={(v) => fijar('fecha_entrada_hotel', v)} />
                  <CampoTexto etiqueta={t.formulario.campos.fechaSalidaHotel} tipo="date" valor={texto('fecha_salida_hotel')} onChange={(v) => fijar('fecha_salida_hotel', v)} error={errores.fecha_salida_hotel} />
                </div>
                <CampoSeleccion etiqueta={t.formulario.campos.tipoHabitacion} opciones={opciones('habitacion', t)} valor={texto('tipo_habitacion')} onChange={(v) => fijar('tipo_habitacion', v)} />
                <CampoTexto etiqueta={t.formulario.campos.comparteCon} valor={texto('comparte_habitacion_con')} onChange={(v) => fijar('comparte_habitacion_con', v)} />
              </>
            )}
          </section>
        )}

        {pasoActual === 'traslados' && (
          <section className="space-y-5">
            <Cabecera titulo={t.formulario.secciones.traslados} ayuda={t.formulario.secciones.trasladosAyuda} />
            <CampoOpcionUnica etiqueta={t.formulario.campos.requiereTraslado} opciones={opciones('traslado', t)} valor={texto('requiere_traslado')} onChange={(v) => fijar('requiere_traslado', v)} columnas={2} />
            {texto('requiere_traslado') && texto('requiere_traslado') !== 'no' && (
              <>
                <CampoOpcionUnica etiqueta={t.formulario.campos.medioArribo} ayuda={t.formulario.campos.medioArriboAyuda} opciones={opciones('medioArribo', t)} valor={texto('medio_arribo')} onChange={(v) => fijar('medio_arribo', v)} />
                <div className="grid gap-5 sm:grid-cols-2">
                  <CampoTexto etiqueta={t.formulario.campos.ciudadOrigen} valor={texto('ciudad_origen')} onChange={(v) => fijar('ciudad_origen', v)} />
                  <CampoTexto etiqueta={t.formulario.campos.terminalOrigen} valor={texto('terminal_origen')} onChange={(v) => fijar('terminal_origen', v)} />
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <CampoTexto etiqueta={t.formulario.campos.fechaLlegada} tipo="date" valor={texto('fecha_llegada')} onChange={(v) => fijar('fecha_llegada', v)} />
                  <CampoTexto etiqueta={t.formulario.campos.horaLlegada} tipo="time" valor={texto('hora_llegada')} onChange={(v) => fijar('hora_llegada', v)} />
                  <CampoTexto etiqueta={t.formulario.campos.aerolineaLlegada} valor={texto('aerolinea_llegada')} onChange={(v) => fijar('aerolinea_llegada', v)} />
                  <CampoTexto etiqueta={t.formulario.campos.vueloLlegada} valor={texto('vuelo_llegada')} onChange={(v) => fijar('vuelo_llegada', v)} />
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <CampoTexto etiqueta={t.formulario.campos.fechaSalida} tipo="date" valor={texto('fecha_salida')} onChange={(v) => fijar('fecha_salida', v)} />
                  <CampoTexto etiqueta={t.formulario.campos.horaSalida} tipo="time" valor={texto('hora_salida')} onChange={(v) => fijar('hora_salida', v)} />
                  <CampoTexto etiqueta={t.formulario.campos.aerolineaSalida} valor={texto('aerolinea_salida')} onChange={(v) => fijar('aerolinea_salida', v)} />
                  <CampoTexto etiqueta={t.formulario.campos.vueloSalida} valor={texto('vuelo_salida')} onChange={(v) => fijar('vuelo_salida', v)} />
                </div>
                <CampoParrafo etiqueta={t.formulario.campos.observacionesTraslado} ayuda={t.formulario.campos.observacionesTrasladoAyuda} filas={3} valor={texto('observaciones_traslado')} onChange={(v) => fijar('observaciones_traslado', v)} />
              </>
            )}
          </section>
        )}

        {pasoActual === 'cierre' && (
          <section className="space-y-5">
            <Cabecera titulo={t.formulario.secciones.cierre} />
            {visible('regimen_alimentario') && (
              <>
                <CampoOpcionUnica etiqueta={t.formulario.campos.regimenAlimentario} opciones={opciones('regimen', t)} valor={texto('regimen_alimentario')} onChange={(v) => fijar('regimen_alimentario', v)} columnas={2} />
                <CampoParrafo etiqueta={t.formulario.campos.alergias} ayuda={t.formulario.campos.alergiasAyuda} filas={2} valor={texto('alergias')} onChange={(v) => fijar('alergias', v)} />
              </>
            )}
            {visible('contacto_emergencia') && (
              <CampoTexto etiqueta={t.formulario.campos.contactoEmergencia} valor={texto('contacto_emergencia')} onChange={(v) => fijar('contacto_emergencia', v)} />
            )}
            {visible('apoyo_traslado') && (
              <>
                <CampoInterruptor etiqueta={t.formulario.campos.apoyoTraslado} ayuda={t.formulario.campos.apoyoTrasladoAyuda} valor={valores.apoyo_traslado as boolean} onChange={(v) => fijar('apoyo_traslado', v)} />
                {(valores.apoyo_traslado as boolean) && (
                  <CampoParrafo etiqueta={t.formulario.campos.datosViatico} ayuda={t.formulario.campos.datosViaticoAyuda} filas={3} valor={texto('datos_viatico')} onChange={(v) => fijar('datos_viatico', v)} />
                )}
              </>
            )}
            <CampoInterruptor etiqueta={t.formulario.campos.requiereFactura} valor={valores.requiere_factura as boolean} onChange={(v) => fijar('requiere_factura', v)} />
            {(valores.requiere_factura as boolean) && (
              <CampoParrafo etiqueta={t.formulario.campos.datosFacturacion} filas={3} valor={texto('datos_facturacion')} onChange={(v) => fijar('datos_facturacion', v)} />
            )}
            <CampoParrafo etiqueta={t.formulario.campos.comentarios} filas={3} valor={texto('comentarios')} onChange={(v) => fijar('comentarios', v)} />
          </section>
        )}

        {pasoActual === 'privacidad' && (
          <section className="space-y-5">
            <Cabecera titulo={t.privacidad.titulo} ayuda={t.privacidad.marcoLegal} />
            <div className="rounded-lg border p-4 text-sm" style={{ borderColor: 'var(--borde)' }}>
              <CampoInterruptor etiqueta={t.privacidad.aceptar} valor={valores.consentimiento_datos as boolean} onChange={(v) => fijar('consentimiento_datos', v)} />
              {errores.consentimiento_datos && <p className="error">{errores.consentimiento_datos}</p>}
              <div className="mt-4">
                <CampoInterruptor etiqueta={t.privacidad.comunicaciones} valor={valores.consentimiento_comunicaciones as boolean} onChange={(v) => fijar('consentimiento_comunicaciones', v)} />
              </div>
              <Link href="/aviso-privacidad" target="_blank" className="mt-4 inline-block text-sm font-medium text-ciess-400 underline">
                {t.privacidad.leerCompleto}
              </Link>
            </div>
            {errorGeneral && (
              <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-500" role="alert">{errorGeneral}</p>
            )}
          </section>
        )}
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button type="button" className="boton-secundario" onClick={retroceder} disabled={indicePaso === 0}>
          {t.acciones.anterior}
        </button>
        {esUltimo ? (
          <button type="button" className="boton-primario" onClick={enviar} disabled={enviando}>
            {enviando ? t.estados.enviando : registroExistente ? t.acciones.guardar : t.acciones.enviar}
          </button>
        ) : (
          <button type="button" className="boton-primario" onClick={avanzar} disabled={!valores.perfil && pasoActual === 'perfil'}>
            {t.acciones.siguiente}
          </button>
        )}
      </div>

      <p className="mt-4 text-center text-xs tenue">
        {tt('{paso} {i} {de} {n}', { paso: t.formulario.paso, i: indicePaso + 1, de: t.formulario.de, n: pasos.length })}
      </p>
    </div>
  );
}

function Cabecera({ titulo, ayuda }: { titulo: string; ayuda?: string }) {
  return (
    <header className="border-b pb-4" style={{ borderColor: 'var(--borde)' }}>
      <h2 className="titulo-seccion">{titulo}</h2>
      {ayuda && <p className="ayuda !mt-2">{ayuda}</p>}
    </header>
  );
}

function ProgresoPasos({
  pasos, indice, onIr,
}: {
  pasos: PasoFormulario[];
  indice: number;
  onIr: (i: number) => void;
}) {
  const { t } = useApp();
  const nombres = t.formulario.pasos as unknown as Record<string, string>;
  return (
    <nav className="desplazable -mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label={t.formulario.paso}>
      {pasos.map((paso, i) => (
        <button
          key={paso}
          type="button"
          onClick={() => i <= indice && onIr(i)}
          disabled={i > indice}
          aria-current={i === indice ? 'step' : undefined}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
            i === indice
              ? 'bg-ciess-500 text-white'
              : i < indice
                ? 'bg-ciess-500/15 text-ciess-400'
                : 'tenue opacity-60'
          }`}
        >
          {i + 1}. {nombres[paso] ?? paso}
        </button>
      ))}
    </nav>
  );
}

function PasoPerfil({
  valores, fijar, errores, restantes, presencialAgotado,
}: {
  valores: Valores;
  fijar: (clave: string, valor: string | boolean | string[]) => void;
  errores: Record<string, string>;
  restantes: number | null;
  presencialAgotado: boolean;
}) {
  const { t } = useApp();
  const nombres = t.perfiles as unknown as Record<string, string>;
  const perfilSeleccionado = perfilPorClave(valores.perfil as string);

  function elegirPerfil(clave: ClavePerfil) {
    const definicion = PERFILES.find((p) => p.clave === clave)!;
    fijar('perfil', clave);
    let modalidad: Modalidad = definicion.modalidadDefault;
    if (modalidad === 'presencial' && (presencialAgotado || !definicion.permitePresencial)) {
      modalidad = definicion.permiteEnLinea ? 'en_linea' : 'presencial';
    }
    fijar('modalidad', modalidad);
  }

  return (
    <section className="space-y-6">
      <Cabecera titulo={t.perfiles.titulo} ayuda={t.perfiles.ayuda} />

      {(['interno', 'externo'] as const).map((grupo) => (
        <div key={grupo}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide tenue">
            {t.perfiles.grupos[grupo]}
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {PERFILES.filter((p) => p.grupo === grupo).map((p) => (
              <button
                key={p.clave}
                type="button"
                onClick={() => elegirPerfil(p.clave)}
                aria-pressed={valores.perfil === p.clave}
                className={`rounded-lg border p-3.5 text-left text-sm font-medium transition ${
                  valores.perfil === p.clave
                    ? 'border-ciess-400 bg-ciess-500/10'
                    : 'hover:bg-black/5 dark:hover:bg-white/5'
                }`}
                style={{ borderColor: valores.perfil === p.clave ? undefined : 'var(--borde)' }}
              >
                {nombres[p.clave]}
              </button>
            ))}
          </div>
        </div>
      ))}
      {errores.perfil && <p className="error">{errores.perfil}</p>}

      {perfilSeleccionado && (
        <div className="border-t pt-5" style={{ borderColor: 'var(--borde)' }}>
          <h3 className="etiqueta">{t.modalidad.titulo}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['presencial', 'en_linea'] as const)
              .filter((m) =>
                m === 'presencial' ? perfilSeleccionado.permitePresencial : perfilSeleccionado.permiteEnLinea,
              )
              .map((m) => {
                const bloqueado = m === 'presencial' && presencialAgotado;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => fijar('modalidad', m)}
                    aria-pressed={valores.modalidad === m}
                    className={`rounded-lg border p-3.5 text-left text-sm font-medium transition ${
                      valores.modalidad === m ? 'border-ciess-400 bg-ciess-500/10' : 'hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                    style={{ borderColor: valores.modalidad === m ? undefined : 'var(--borde)' }}
                  >
                    {t.modalidad[m]}
                    {m === 'presencial' && (
                      <span className="ayuda block">
                        {restantes === null
                          ? t.modalidad.sinLimite
                          : `${t.modalidad.cuposDisponibles}: ${restantes}`}
                      </span>
                    )}
                    {bloqueado && <span className="ayuda block !text-amber-500">{t.modalidad.cuposAgotados}</span>}
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </section>
  );
}
