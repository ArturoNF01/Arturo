'use client';

import { useEffect, useState } from 'react';
import { useApp } from '../proveedores';
import { interpolar } from '@/i18n';

interface Estado {
  pendientes: { folio: string; sheets_error: string | null }[];
  sinAcuse: { folio: string; correo: string; correo_error: string | null }[];
  correoConfigurado: boolean;
  presencial: { libres: number | null; agotado: boolean; enListaEspera: number };
}

/**
 * Lo que el comité tiene que saber al entrar al panel.
 *
 * Tres avisos que antes no existían y que compartían el mismo defecto: la
 * información estaba en la base y nadie la miraba. Alguien se registraba, su
 * fila no llegaba a la hoja o su acuse no salía, y el problema se descubría
 * cuando otra área echaba en falta a una persona. Y los lugares presenciales
 * se agotaban sin que nadie se enterara hasta contar filas.
 */
export function AvisoHoja() {
  const { t } = useApp();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [copiando, setCopiando] = useState(false);
  const [resultado, setResultado] = useState('');
  const [reenviando, setReenviando] = useState(false);
  const [resultadoAcuses, setResultadoAcuses] = useState('');

  async function revisar() {
    try {
      const respuesta = await fetch('/api/sincronizar');
      if (!respuesta.ok) return;
      setEstado(await respuesta.json());
    } catch {
      // Sin red no hay nada que avisar; el propio panel ya lo dirá.
    }
  }

  useEffect(() => {
    // La primera consulta sale de un temporizador a cero, no del propio
    // efecto: así el panel termina de pintarse antes de que llegue nada.
    const primera = setTimeout(() => void revisar(), 0);
    // Y luego cada cinco minutos: lo normal es que no haya nada, y preguntar
    // más a menudo sólo añadiría ruido.
    const reloj = setInterval(() => void revisar(), 5 * 60 * 1000);
    return () => {
      clearTimeout(primera);
      clearInterval(reloj);
    };
  }, []);

  if (!estado) return null;

  const { pendientes = [], sinAcuse = [], presencial } = estado;
  const hayAvisos = pendientes.length > 0 || sinAcuse.length > 0 || presencial?.agotado;
  if (!hayAvisos) return null;

  async function copiarAhora() {
    setCopiando(true);
    setResultado('');
    try {
      const respuesta = await fetch('/api/sincronizar', { method: 'POST' });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        setResultado(datos.mensaje ?? t.estados.error);
        return;
      }
      setResultado(interpolar(t.panel.hoja.copiados, { n: datos.sincronizados ?? 0 }));
      await revisar();
    } catch {
      setResultado(t.estados.error);
    } finally {
      setCopiando(false);
    }
  }

  async function reenviarAcuses() {
    setReenviando(true);
    setResultadoAcuses('');
    try {
      const respuesta = await fetch('/api/acuses', { method: 'POST' });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        setResultadoAcuses(datos.mensaje ?? t.estados.error);
        return;
      }
      setResultadoAcuses(interpolar(t.panel.hoja.acusesEnviados, { n: datos.enviados ?? 0 }));
      await revisar();
    } catch {
      setResultadoAcuses(t.estados.error);
    } finally {
      setReenviando(false);
    }
  }

  return (
    <div className="border-b" style={{ borderColor: 'var(--borde)' }}>
      {/* El cupo va arriba: es el que cambia lo que el comité hace hoy. */}
      {presencial?.agotado && (
        <Franja tono="#3b82f6">
          <p className="font-semibold">{t.panel.hoja.cupoAgotado}</p>
          <span className="tenue">
            {presencial.enListaEspera > 0
              ? interpolar(t.panel.hoja.enListaEspera, { n: presencial.enListaEspera })
              : t.panel.hoja.sinListaEspera}
          </span>
        </Franja>
      )}

      {pendientes.length > 0 && (
        <Franja tono="#f59e0b">
          <p className="font-semibold">
            {interpolar(t.panel.hoja.pendientes, { n: pendientes.length })}
          </p>
          <button
            type="button"
            className="boton-secundario !py-1.5 !text-xs"
            onClick={() => void copiarAhora()}
            disabled={copiando}
          >
            {copiando ? t.estados.enviando : t.panel.hoja.copiarAhora}
          </button>
          {resultado && <span className="tenue">{resultado}</span>}
          <Motivo texto={pendientes.find((p) => p.sheets_error)?.sheets_error} />
        </Franja>
      )}

      {sinAcuse.length > 0 && (
        <Franja tono="#ef4444">
          <p className="font-semibold">
            {interpolar(t.panel.hoja.sinAcuse, { n: sinAcuse.length })}
          </p>
          {estado.correoConfigurado ? (
            // El botón sólo aparece cuando hay con qué enviar: ofrecer
            // reintentar sin clave configurada es prometer algo que no va a
            // pasar, y el fallo se repetiría igual.
            <button
              type="button"
              className="boton-secundario !py-1.5 !text-xs"
              onClick={() => void reenviarAcuses()}
              disabled={reenviando}
            >
              {reenviando ? t.estados.enviando : t.panel.hoja.reenviarAcuses}
            </button>
          ) : (
            <span className="tenue">{t.panel.hoja.correoSinConfigurar}</span>
          )}
          {resultadoAcuses && <span className="tenue">{resultadoAcuses}</span>}
          <Motivo texto={sinAcuse.find((s) => s.correo_error)?.correo_error} />
        </Franja>
      )}
    </div>
  );
}

function Franja({ tono, children }: { tono: string; children: React.ReactNode }) {
  return (
    <div
      className="px-6 py-3 text-sm"
      style={{ backgroundColor: `color-mix(in srgb, ${tono} 12%, transparent)` }}
      role="status"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">{children}</div>
    </div>
  );
}

/** El motivo del primero basta: cuando falla, suele fallar igual para todos. */
function Motivo({ texto }: { texto?: string | null }) {
  if (!texto) return null;
  return <span className="ayuda w-full">{texto}</span>;
}
