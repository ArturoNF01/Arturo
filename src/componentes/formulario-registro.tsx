'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApp } from './proveedores';
import {
  CampoCasillas, CampoInterruptor, CampoOpcionUnica,
  CampoSeleccion, CampoTexto,
} from './campos';
import {
  PASO_DE_CAMPO, PERFILES, campoVisible, pasosVisibles, perfilPorClave,
  type ClavePerfil, type Modalidad, type PasoFormulario,
} from '@/lib/perfiles';
import { ZONAS_HORARIAS } from '@/lib/husos';
import type { ConfiguracionPublica } from '@/lib/servidor/configuracion';
import { opciones } from '@/lib/opciones';
import { type DatosCongreso } from '@/lib/contenido';
import { interpolar } from '@/i18n';

type Valores = Record<string, string | boolean | string[]>;

const VALORES_INICIALES: Valores = {
  perfil: '', modalidad: 'presencial',
  apellidos: '', nombres: '', nombre_constancia: '', genero: '',
  correo: '', telefono_whatsapp: '', institucion: '', cargo: '', procedencia: '',
  pais_residencia: '', entidad_federativa: '', ciudad_residencia: '', nacionalidad: '', orcid: '',
  modalidad_participacion: '', titulo_ponencia: '', resumen_ponencia: '',
  palabras_clave: '', coautoria: '',
  semblanza_url: '', semblanza_drive_id: '', foto_url: '', foto_drive_id: '',
  documentacion_solicitada: [], nombre_pasaporte: '', destinatario_oficio: '',
  documentacion_otra: '', boleto_url: '', boleto_drive_id: '', autorizaciones: [],
  requerimientos_tecnicos: [], requerimientos_accesibilidad: '',
  placa_vehiculo: '', modelo_vehiculo: '', color_vehiculo: '',
  requiere_alojamiento: false, fecha_entrada_hotel: '', fecha_salida_hotel: '',
  // Vacío, no 'no': estos campos ya no se preguntan, y un valor por defecto
  // los deja guardados como si alguien los hubiera contestado. Siguen en la
  // lista para que al editar un registro viejo sus respuestas vuelvan tal
  // cual, en vez de borrarse al guardar.
  requiere_traslado: '', _alojamiento: '', medio_arribo: '', ciudad_origen: '', terminal_origen: '',
  fecha_llegada: '', hora_llegada: '', aerolinea_llegada: '', vuelo_llegada: '',
  fecha_salida: '', hora_salida: '', aerolinea_salida: '', vuelo_salida: '',
  observaciones_traslado: '',
  regimen_alimentario: '', condicion_alimentaria: false, condicion_alimentaria_detalle: '',
  _condicion_alimentaria: '', contacto_emergencia: '',
  apoyo_traslado: false, datos_viatico: '', requiere_factura: false, datos_facturacion: '',
  comentarios: '',
  consentimiento_datos: false, consentimiento_comunicaciones: false,
};

export function FormularioRegistro({
  configuracion,
  congreso,
  registroExistente,
  token,
}: {
  configuracion: ConfiguracionPublica;
  congreso: DatosCongreso;
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
    inicial._alojamiento = registroExistente.requiere_alojamiento ? 'si' : '';
    return inicial;
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [indicePaso, setIndicePaso] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState('');
  // Señuelo: un campo que ninguna persona ve. Si llega lleno, quien envió el
  // formulario fue un programa.
  const [senuelo, setSenuelo] = useState('');
  const abiertoEn = useRef<number | null>(null);
  // El reloj se toma al montar, no durante el render, que debe ser puro.
  useEffect(() => {
    abiertoEn.current ??= Date.now();
  }, []);

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
      // Se exige lo que se enseña. Al público en línea no se le pide ni
      // institución ni país, y sin este filtro el botón de seguir no
      // avanzaba: marcaba como vacíos dos campos que no están en pantalla.
      ['apellidos', 'nombres', 'correo', 'institucion', 'pais_residencia']
        .filter((c) => visible(c))
        .forEach(obligatorio);
      if (texto('correo') && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(texto('correo'))) {
        nuevos.correo = t.formulario.validacion.correo;
      }
    }

    if (paso === 'ponencia' && texto('resumen_ponencia').length > congreso.limite_resumen_caracteres) {
      nuevos.resumen_ponencia = interpolar(t.formulario.validacion.resumenLargo, {
        max: congreso.limite_resumen_caracteres,
      });
    }
    // Estas tres las exigía sólo el servidor, y su aviso llegaba al final,
    // cuando el campo ya no estaba en pantalla.
    if (paso === 'ponencia') obligatorio('titulo_ponencia');
    if (paso === 'conexion') obligatorio('zona_horaria');

    if (paso === 'privacidad' && perfil?.enPrograma && !valores.autoriza_grabacion) {
      nuevos.autoriza_grabacion = t.formulario.validacion.requerido;
    }
    if (paso === 'privacidad' && !valores.consentimiento_datos) {
      nuevos.consentimiento_datos = t.formulario.validacion.consentimiento;
    }

    // Los errores de este paso se reemplazan, no se acumulan: si no, un campo
    // que el servidor marcó en un envío anterior se queda en rojo aunque ya
    // esté corregido, y quien se registra ve señalado algo que acaba de
    // arreglar. Los de los demás pasos se conservan.
    setErrores((antes) => {
      const quedan = Object.fromEntries(
        Object.entries(antes).filter(([campo]) => PASO_DE_CAMPO[campo] !== paso),
      );
      return { ...quedan, ...nuevos };
    });
    if (Object.keys(nuevos).length > 0) enfocarPrimerError(nuevos);
    return Object.keys(nuevos).length === 0;
  }

  /** El rótulo con el que se le preguntó, para poder nombrarlo en el aviso. */
  function nombreDeCampo(campo: string): string {
    const campos = t.formulario.campos as unknown as Record<string, string>;
    const enCamello = campo.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    if (typeof campos[enCamello] === 'string') return campos[enCamello];
    if (campo === 'consentimiento_datos') return t.privacidad.titulo;
    if (campo === 'perfil') return t.formulario.pasos.perfil;
    return campo.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  }

  /** Lleva el cursor al primer campo con problema, para no tener que buscarlo. */
  function enfocarPrimerError(fallos: Record<string, string>) {
    const primero = Object.keys(fallos)[0];
    requestAnimationFrame(() => {
      const campo = document.querySelector<HTMLElement>(`[name="${primero}"], #${CSS.escape(primero)}`);
      campo?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      campo?.focus?.();
    });
  }

  /**
   * Lleva al paso donde está el primer campo que el servidor rechazó.
   *
   * El aviso salía en el último paso y los campos marcados quedaban varias
   * pantallas atrás: se leía «revise los campos marcados» sin ver ninguno.
   */
  function irAlPrimerFallo(fallos: Record<string, string>) {
    for (const campo of Object.keys(fallos)) {
      const paso = PASO_DE_CAMPO[campo];
      const indice = paso ? pasos.indexOf(paso) : -1;
      if (indice >= 0) {
        setIndicePaso(indice);
        enfocarPrimerError(fallos);
        return true;
      }
    }
    return false;
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
    // Y se parte de cero: lo que el servidor rechazó la vez anterior no tiene
    // por qué seguir rechazándolo ahora, y dejarlo puesto hace creer que el
    // envío nuevo falló por lo mismo aunque haya fallado por otra cosa —o
    // aunque no haya fallado.
    setErrores({});
    try {
      const cuerpo = {
        ...valores,
        idioma,
        // Señuelo y momento de apertura: el servidor los usa para distinguir a
        // una persona de un programa. Se descartan antes de guardar.
        sitio_web: senuelo,
        abierto_en: abiertoEn.current,
      };
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
        if (datos.errores) {
          setErrores(datos.errores);
          irAlPrimerFallo(datos.errores);
        }
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
      {/* Señuelo. Fuera de la pantalla y fuera del recorrido del teclado y de
          los lectores de pantalla: nadie que se registre lo encuentra. */}
      <div aria-hidden className="pointer-events-none absolute left-[-9999px] h-px w-px overflow-hidden">
        <label htmlFor="sitio_web">Sitio web</label>
        <input
          id="sitio_web"
          name="sitio_web"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={senuelo}
          onChange={(e) => setSenuelo(e.target.value)}
        />
      </div>

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
              <CampoTexto campo="apellidos" etiqueta={t.formulario.campos.apellidos} requerido valor={texto('apellidos')} onChange={(v) => fijar('apellidos', v)} error={errores.apellidos} />
              <CampoTexto campo="nombres" etiqueta={t.formulario.campos.nombres} requerido valor={texto('nombres')} onChange={(v) => fijar('nombres', v)} error={errores.nombres} />
            </div>
            {visible('nombre_constancia') && (
              <CampoTexto campo="nombre_constancia" etiqueta={t.formulario.campos.nombreConstancia} ayuda={t.formulario.campos.nombreConstanciaAyuda} valor={texto('nombre_constancia')} onChange={(v) => fijar('nombre_constancia', v)} />
            )}
            {visible('genero') && (
              <CampoSeleccion etiqueta={t.formulario.campos.genero} opciones={opciones('genero', t)} valor={texto('genero')} onChange={(v) => fijar('genero', v)} />
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              <CampoTexto campo="correo" etiqueta={t.formulario.campos.correo} tipo="email" requerido valor={texto('correo')} onChange={(v) => fijar('correo', v)} error={errores.correo} />
              {visible('telefono_whatsapp') && (
                <CampoTexto campo="telefono_whatsapp" etiqueta={t.formulario.campos.telefono} ayuda={t.formulario.campos.telefonoAyuda} tipo="tel" valor={texto('telefono_whatsapp')} onChange={(v) => fijar('telefono_whatsapp', v)} />
              )}
            </div>
            {visible('institucion') && (
              <div className="grid gap-5 sm:grid-cols-2">
                <CampoTexto campo="institucion" etiqueta={t.formulario.campos.institucion} requerido valor={texto('institucion')} onChange={(v) => fijar('institucion', v)} error={errores.institucion} />
                <CampoTexto campo="cargo" etiqueta={t.formulario.campos.cargo} valor={texto('cargo')} onChange={(v) => fijar('cargo', v)} />
              </div>
            )}
            {visible('procedencia') && (
              <CampoOpcionUnica etiqueta={t.formulario.campos.procedencia} ayuda={t.formulario.campos.procedenciaAyuda} opciones={opciones('procedencia', t)} valor={texto('procedencia')} onChange={(v) => fijar('procedencia', v)} />
            )}
            {visible('pais_residencia') && (
              <CampoTexto campo="pais_residencia" etiqueta={t.formulario.campos.pais} requerido valor={texto('pais_residencia')} onChange={(v) => fijar('pais_residencia', v)} error={errores.pais_residencia} />
            )}
          </section>
        )}

        {pasoActual === 'ponencia' && (
          <section className="space-y-5">
            {/* La convocatoria ya cerró y el comité dictaminó: aquí no se
                propone nada, se confirma cómo debe salir en el programa. */}
            <Cabecera titulo={t.formulario.secciones.ponencia} ayuda={t.formulario.secciones.ponenciaAyuda} />
            <CampoTexto campo="titulo_ponencia" etiqueta={t.formulario.campos.tituloPonencia} ayuda={t.formulario.campos.tituloPonenciaAyuda} requerido valor={texto('titulo_ponencia')} onChange={(v) => fijar('titulo_ponencia', v)} error={errores.titulo_ponencia} />
            <CampoOpcionUnica etiqueta={t.formulario.campos.idiomaPonencia} ayuda={t.formulario.campos.idiomaPonenciaAyuda} opciones={[{ valor: 'es', etiqueta: 'Español' }, { valor: 'pt', etiqueta: 'Português' }, { valor: 'en', etiqueta: 'English' }]} valor={texto('idioma_ponencia')} onChange={(v) => fijar('idioma_ponencia', v)} columnas={2} />
          </section>
        )}

        {pasoActual === 'conexion' && (
          <section className="space-y-5">
            <Cabecera titulo={t.formulario.secciones.conexion} ayuda={t.formulario.secciones.conexionAyuda} />
            {/* Sin huso horario, un aviso «a las 9:00» llega mal a media
                región: el congreso se sigue desde todo el continente. */}
            <CampoSeleccion etiqueta={t.formulario.campos.zonaHoraria} ayuda={t.formulario.campos.zonaHorariaAyuda} requerido opciones={ZONAS_HORARIAS} valor={texto('zona_horaria')} onChange={(v) => fijar('zona_horaria', v)} error={errores.zona_horaria} />
            <CampoCasillas etiqueta={t.formulario.campos.requerimientosTecnicos} opciones={opciones('tecnicos', t)} valores={lista('requerimientos_tecnicos')} onChange={(v) => fijar('requerimientos_tecnicos', v)} />
            {perfil?.enPrograma && (
              <CampoInterruptor etiqueta={t.formulario.campos.pruebaConexion} ayuda={t.formulario.campos.pruebaConexionAyuda} valor={Boolean(valores.prueba_conexion)} onChange={(v) => fijar('prueba_conexion', v)} />
            )}
          </section>
        )}

        {pasoActual === 'sala' && (
          <section className="space-y-5">
            <Cabecera titulo={t.formulario.secciones.sala} />
            {/* Quince minutos condicionan lo que cabe en una ponencia. Se dice
                aquí, donde se piden los apoyos, y no en un correo posterior. */}
            {perfil?.presentaPonencia && (
              <p className="rounded-lg border-l-4 border-ciess-500 py-2 pl-4 text-sm font-medium">
                {t.formulario.secciones.salaNotaPonente}
              </p>
            )}
            <CampoCasillas etiqueta={t.formulario.campos.requerimientosTecnicos} opciones={opciones('tecnicos', t)} valores={lista('requerimientos_tecnicos')} onChange={(v) => fijar('requerimientos_tecnicos', v)} />
          </section>
        )}

        {pasoActual === 'alojamiento' && (
          <section className="space-y-5">
            <Cabecera titulo={t.formulario.secciones.alojamiento} ayuda={t.formulario.secciones.alojamientoAyuda} />
            <CampoInterruptor
              campo="requiere_alojamiento"
              etiqueta={t.formulario.campos.requiereAlojamiento}
              valor={Boolean(valores.requiere_alojamiento)}
              onChange={(v) => fijar('requiere_alojamiento', v)}
            />
            {/* El aviso sale sólo si marcó que sí. Puesto siempre, se lee como
                una promesa a todo el mundo; puesto aquí, contesta la pregunta
                que viene justo después de marcar: «¿y ahora qué pasa?». */}
            {Boolean(valores.requiere_alojamiento) && (
              <p className="rounded-lg border-l-4 border-ciess-500 py-2 pl-4 text-sm font-medium">
                {t.formulario.secciones.alojamientoAviso}
              </p>
            )}
          </section>
        )}

        {pasoActual === 'traslados' && (
          <section className="space-y-5">
            <Cabecera titulo={t.formulario.secciones.traslados} ayuda={t.formulario.secciones.trasladosAyuda} />
            {/* Tres campos: de dónde viene y qué días está. Con eso el comité
                sabe cuánta gente hay en la sede cada día, que es lo único que
                necesita de quien viene al público. La hora del vuelo, la
                aerolínea y el número de corrida sólo hacían falta cuando la
                organización iba a recogerle al aeropuerto, y ese servicio no
                se le ofrece. */}
            <CampoTexto campo="ciudad_origen" etiqueta={t.formulario.campos.ciudadOrigen} valor={texto('ciudad_origen')} onChange={(v) => fijar('ciudad_origen', v)} />
            <div className="grid gap-5 sm:grid-cols-2">
              <CampoTexto campo="fecha_llegada" etiqueta={t.formulario.campos.fechaLlegada} tipo="date" valor={texto('fecha_llegada')} onChange={(v) => fijar('fecha_llegada', v)} />
              <CampoTexto campo="fecha_salida" etiqueta={t.formulario.campos.fechaSalida} tipo="date" valor={texto('fecha_salida')} onChange={(v) => fijar('fecha_salida', v)} />
            </div>
          </section>
        )}

        {pasoActual === 'privacidad' && (
          <section className="space-y-5">
            <Cabecera titulo={t.privacidad.titulo} />
            <div className="rounded-lg border p-4 text-sm" style={{ borderColor: 'var(--borde)' }}>
              {/* Sin esta autorización no se puede transmitir ni grabar a
                  quien sale en el programa. Vivía en la sección de semblanza;
                  al retirarse esa sección se trae aquí, junto a los demás
                  consentimientos, que es donde le corresponde estar. */}
              {perfil?.enPrograma && (
                <div className="mb-4">
                  <CampoInterruptor
                    campo="autoriza_grabacion"
                    etiqueta={t.formulario.campos.autorizaGrabacion}
                    ayuda={t.formulario.campos.autorizaGrabacionAyuda}
                    valor={Boolean(valores.autoriza_grabacion)}
                    onChange={(v) => fijar('autoriza_grabacion', v)}
                    error={errores.autoriza_grabacion}
                  />
                </div>
              )}
              <CampoInterruptor campo="consentimiento_datos" etiqueta={t.privacidad.aceptar} valor={valores.consentimiento_datos as boolean} onChange={(v) => fijar('consentimiento_datos', v)} />
              {errores.consentimiento_datos && <p className="error">{errores.consentimiento_datos}</p>}
              <div className="mt-4">
                <CampoInterruptor etiqueta={t.privacidad.comunicaciones} valor={valores.consentimiento_comunicaciones as boolean} onChange={(v) => fijar('consentimiento_comunicaciones', v)} />
              </div>
              <Link href="/aviso-privacidad" target="_blank" className="mt-4 inline-block text-sm font-medium text-ciess-400 underline">
                {t.privacidad.leerCompleto}
              </Link>
            </div>
            {errorGeneral && (
              <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-500" role="alert">
                <p className="font-semibold">{errorGeneral}</p>
                {/* Con los nombres de los campos y un enlace a cada uno: el
                    aviso a secas obligaba a recorrer diez pasos buscando. */}
                {Object.keys(errores).length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {Object.entries(errores).map(([campo, mensaje]) => (
                      <li key={campo}>
                        <button
                          type="button"
                          className="text-left underline underline-offset-2"
                          onClick={() => irAlPrimerFallo({ [campo]: mensaje })}
                        >
                          {nombreDeCampo(campo)}: {mensaje}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
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
    fijar('perfil', clave);
    // Todos los perfiles admiten las dos modalidades. Se propone presencial,
    // salvo que ya no queden lugares.
    const modalidad: Modalidad = presencialAgotado ? 'en_linea' : 'presencial';
    fijar('modalidad', modalidad);
  }

  return (
    <section className="space-y-6">
      <Cabecera titulo={t.perfiles.titulo} ayuda={t.perfiles.ayuda} />

      {/* Sin grupos: lo que distingue a un perfil de otro es qué viene a
          hacer, y cada uno lleva la línea que lo aclara para que nadie
          tenga que adivinar cuál le toca. */}
      <div className="grid gap-2 sm:grid-cols-2">
        {PERFILES.map((p) => (
          <button
            key={p.clave}
            type="button"
            onClick={() => elegirPerfil(p.clave)}
            aria-pressed={valores.perfil === p.clave}
            className={`rounded-lg border p-3.5 text-left transition ${
              valores.perfil === p.clave
                ? 'border-ciess-400 bg-ciess-500/10'
                : 'hover:bg-black/5 dark:hover:bg-white/5'
            }`}
            style={{ borderColor: valores.perfil === p.clave ? undefined : 'var(--borde)' }}
          >
            <span className="block text-sm font-medium">{nombres[p.clave]}</span>
            <span className="mt-0.5 block text-xs tenue">{nombres[`${p.clave}Ayuda`]}</span>
          </button>
        ))}
      </div>

      {errores.perfil && <p className="error">{errores.perfil}</p>}

      {perfilSeleccionado && (
        <div className="border-t pt-5" style={{ borderColor: 'var(--borde)' }}>
          <h3 className="etiqueta">{t.modalidad.titulo}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['presencial', 'en_linea'] as const)
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
