'use client';

import { useEffect, useState } from 'react';
import { useApp } from '../proveedores';
import { interpolar } from '@/i18n';

interface Pendiente {
  folio: string;
  sheets_error: string | null;
}

/**
 * Avisa, en todo el panel, cuando hay registros que no llegaron a la hoja.
 *
 * Existe por un caso concreto: alguien se registró, el sitio le dio su folio,
 * y su fila nunca apareció en la hoja. El error quedaba guardado en una
 * columna de la base que nadie mira, así que el problema sólo se descubría
 * cuando otra área echaba en falta a una persona. Ahora se ve al entrar, con
 * el motivo delante: casi siempre dice exactamente qué hay que hacer.
 */
export function AvisoHoja() {
  const { t } = useApp();
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [copiando, setCopiando] = useState(false);
  const [resultado, setResultado] = useState('');

  async function revisar() {
    try {
      const respuesta = await fetch('/api/sincronizar');
      if (!respuesta.ok) return;
      const datos = await respuesta.json();
      setPendientes(datos.pendientes ?? []);
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

  if (pendientes.length === 0) return null;

  // El motivo del primero basta: cuando falla, falla igual para todos.
  const motivo = pendientes.find((p) => p.sheets_error)?.sheets_error ?? '';

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
      setResultado(
        interpolar(t.panel.hoja.copiados, { n: datos.sincronizados ?? 0 }),
      );
      await revisar();
    } catch {
      setResultado(t.estados.error);
    } finally {
      setCopiando(false);
    }
  }

  return (
    <div
      className="border-b px-6 py-3 text-sm"
      style={{
        borderColor: 'var(--borde)',
        backgroundColor: 'color-mix(in srgb, #f59e0b 12%, transparent)',
      }}
      role="status"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
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
      </div>
      {motivo && <p className="ayuda mt-1.5">{motivo}</p>}
    </div>
  );
}
