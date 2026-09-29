'use client';

import { useState } from 'react';
import { useApp } from '@/componentes/proveedores';
import type { RolPanel } from '@/lib/servidor/sesion';

/**
 * La propia cuenta: quién es uno en el panel y cómo cambiar su contraseña.
 *
 * Existe porque cambiar la contraseña era cosa de quien gestionaba usuarios,
 * y eso obligaba a pedírsela a otra persona —dictándole la nueva por algún
 * canal— justo en el momento en que uno sospecha que la suya se vio. Aquí no
 * pasa por nadie más.
 */
export function MiCuenta({
  correo,
  nombre,
  rol,
  tieneClave,
}: {
  correo: string;
  nombre: string | null;
  rol: RolPanel;
  tieneClave: boolean;
}) {
  const { t } = useApp();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    setError('');
    setMensaje('');

    // Se comprueba aquí antes de mandar nada: escribir mal la nueva dos veces
    // distintas y enterarse por un error del servidor es perder el texto.
    if (nueva !== repetida) {
      setError('Las dos contraseñas nuevas no coinciden.');
      return;
    }
    if (nueva.length < 10) {
      setError('La contraseña nueva va de 10 caracteres en adelante.');
      return;
    }

    setOcupado(true);
    try {
      const respuesta = await fetch('/api/cuenta', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave_actual: actual || undefined, clave_nueva: nueva }),
      });
      const datos = await respuesta.json().catch(() => ({ mensaje: '' }));
      if (!respuesta.ok) {
        setError(datos.mensaje || t.estados.error);
        return;
      }
      setActual('');
      setNueva('');
      setRepetida('');
      setMensaje(
        datos.sesionesCerradas > 0
          ? `Contraseña cambiada. Se cerraron ${datos.sesionesCerradas} sesión(es) abiertas en otros equipos.`
          : 'Contraseña cambiada.',
      );
    } catch {
      setError(t.estados.error);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="p-4 sm:p-6">
      <header className="mb-5">
        <h1 className="text-xl font-bold">Mi cuenta</h1>
        <p className="ayuda !mt-1">Sus datos de acceso al panel.</p>
      </header>

      <div className="tarjeta mb-6 p-5">
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-3">
          <Dato etiqueta="Correo" valor={correo} />
          <Dato etiqueta="Nombre" valor={nombre ?? '—'} />
          <Dato etiqueta={t.panel.auditoria.columnas.rol} valor={t.panel.roles[rol]} />
        </dl>
      </div>

      <form onSubmit={guardar} className="tarjeta max-w-md p-5">
        <h2 className="font-semibold">
          {tieneClave ? 'Cambiar mi contraseña' : 'Ponerme una contraseña'}
        </h2>
        <p className="ayuda mt-1">
          {tieneClave
            ? 'Al cambiarla se cierran las sesiones abiertas en otros equipos. La de aquí sigue abierta.'
            : 'Hasta ahora entra por el enlace que le llega al correo. Si se pone una contraseña, podrá entrar con ella además del enlace.'}
        </p>

        {tieneClave && (
          <label className="mt-4 block">
            <span className="etiqueta">Contraseña actual</span>
            <input
              type="password"
              className="campo"
              autoComplete="current-password"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              required
            />
          </label>
        )}

        <label className="mt-4 block">
          <span className="etiqueta">Contraseña nueva</span>
          <input
            type="password"
            className="campo"
            autoComplete="new-password"
            minLength={10}
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            required
          />
          <span className="ayuda">Diez caracteres o más.</span>
        </label>

        <label className="mt-4 block">
          <span className="etiqueta">Repita la contraseña nueva</span>
          <input
            type="password"
            className="campo"
            autoComplete="new-password"
            value={repetida}
            onChange={(e) => setRepetida(e.target.value)}
            required
          />
        </label>

        {error && <p className="error mt-3">{error}</p>}
        {mensaje && <p className="mt-3 text-sm text-emerald-500">{mensaje}</p>}

        <button type="submit" className="boton-primario mt-5" disabled={ocupado}>
          {ocupado ? t.estados.enviando : 'Guardar'}
        </button>
      </form>
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
