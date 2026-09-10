'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/componentes/proveedores';
import type { RolPanel } from '@/lib/servidor/sesion';

export interface UsuarioFila {
  id: string;
  correo: string;
  nombre: string | null;
  rol: RolPanel;
  activo: boolean;
  creado_en: string;
  ultimo_acceso: string | null;
  /** Sin contraseña, la persona entra por enlace de acceso. */
  tiene_clave: boolean;
}

const ROLES: RolPanel[] = ['superadmin', 'organizador', 'cientifico_datos', 'lector'];

export function GestionUsuarios({ usuarios }: { usuarios: UsuarioFila[] }) {
  const { t, idioma } = useApp();
  const router = useRouter();
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function actualizar(id: string, cambios: Partial<UsuarioFila>) {
    setOcupado(true);
    setMensaje('');
    const respuesta = await fetch(`/api/usuarios/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cambios),
    });
    const error = respuesta.ok ? null : await respuesta.json().catch(() => ({ mensaje: '' }));
    setMensaje(error ? error.mensaje || t.estados.error : t.estados.guardado);
    if (!error) router.refresh();
    setOcupado(false);
  }

  return (
    <div className="p-4 sm:p-6">
      <header className="mb-5">
        <h1 className="text-xl font-bold">{t.panel.secciones.usuarios}</h1>
        <p className="ayuda !mt-1">
          Aquí se dan de alta las cuentas, se asigna el rol y se activa o desactiva el acceso.
          Cada cambio queda asentado en la auditoría.
        </p>
      </header>

      <NuevaCuenta
        onCreada={(aviso) => {
          setMensaje(aviso);
          router.refresh();
        }}
      />

      {mensaje && <p className="mb-4 text-sm tenue">{mensaje}</p>}

      <div className="tarjeta desplazable overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--borde)' }}>
              {['Correo', 'Nombre', t.panel.auditoria.columnas.rol, 'Activo', 'Último acceso'].map((c) => (
                <th key={c} className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wide tenue">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-b" style={{ borderColor: 'var(--borde)' }}>
                <td className="px-3 py-2.5">{u.correo}</td>
                <td className="px-3 py-2.5">{u.nombre ?? '—'}</td>
                <td className="px-3 py-2.5">
                  <select
                    className="campo !py-1"
                    value={u.rol}
                    disabled={ocupado}
                    onChange={(e) => void actualizar(u.id, { rol: e.target.value as RolPanel })}
                  >
                    {ROLES.map((rol) => (
                      <option key={rol} value={rol}>{t.panel.roles[rol]}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-ciess-500"
                    checked={u.activo}
                    disabled={ocupado}
                    onChange={(e) => void actualizar(u.id, { activo: e.target.checked })}
                    aria-label={u.correo}
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums tenue">
                  {u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleString(idioma) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {usuarios.length === 0 && <p className="py-10 text-center text-sm tenue">{t.estados.sinDatos}</p>}
    </div>
  );
}

/**
 * Alta de una cuenta del panel.
 *
 * Se puede dejar la contraseña vacía: entonces se envía un enlace de acceso
 * al correo y la persona elige después cómo entrar. Es lo preferible para
 * alguien a quien no se le puede dictar una contraseña por un canal seguro.
 */
function NuevaCuenta({ onCreada }: { onCreada: (aviso: string) => void }) {
  const { t } = useApp();
  const [abierto, setAbierto] = useState(false);
  const [correo, setCorreo] = useState('');
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<RolPanel>('lector');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function crear(evento: React.FormEvent) {
    evento.preventDefault();
    setError('');
    setOcupado(true);
    try {
      const respuesta = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correo: correo.trim(),
          nombre: nombre.trim() || undefined,
          rol,
          clave: clave || undefined,
        }),
      });
      const resultado = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok) {
        setError(resultado.mensaje ?? t.estados.error);
        return;
      }

      onCreada(
        resultado.enlaceEnviado
          ? `Cuenta creada. Se envió el enlace de acceso a ${correo.trim()}.`
          : 'Cuenta creada.',
      );
      setCorreo('');
      setNombre('');
      setClave('');
      setRol('lector');
      setAbierto(false);
    } finally {
      setOcupado(false);
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        className="boton-secundario mb-4 !py-2 !text-sm"
        onClick={() => setAbierto(true)}
      >
        Dar de alta una cuenta
      </button>
    );
  }

  return (
    <form className="tarjeta mb-5 max-w-2xl p-5" onSubmit={crear}>
      <h2 className="titulo-seccion mb-4">Nueva cuenta</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="etiqueta">Correo</span>
          <input
            type="email" className="campo" required value={correo}
            onChange={(e) => setCorreo(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="etiqueta">Nombre</span>
          <input
            type="text" className="campo" value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="etiqueta">{t.panel.filtros.perfil}</span>
          <select
            className="campo" value={rol}
            onChange={(e) => setRol(e.target.value as RolPanel)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{t.panel.roles[r]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="etiqueta">Contraseña</span>
          <input
            type="password" className="campo" minLength={10} value={clave}
            autoComplete="new-password"
            onChange={(e) => setClave(e.target.value)}
          />
          <span className="ayuda">
            Desde 10 caracteres. Si se deja vacía, se le envía un enlace de acceso al correo.
          </span>
        </label>
      </div>

      {error && <p className="error mt-3">{error}</p>}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="submit" className="boton-primario !py-2 !text-sm" disabled={ocupado}>
          {ocupado ? t.estados.enviando : t.acciones.guardar}
        </button>
        <button
          type="button" className="boton-secundario !py-2 !text-sm"
          onClick={() => setAbierto(false)}
        >
          {t.acciones.cancelar}
        </button>
      </div>
    </form>
  );
}
