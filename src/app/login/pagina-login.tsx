'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LogoCiess } from '@/componentes/logo';
import { useRouter, useSearchParams } from 'next/navigation';
import { BotonTema, SelectorIdioma } from '@/componentes/controles';
import { useApp } from '@/componentes/proveedores';
import { VideoFondo } from '@/componentes/video-fondo';

export function PaginaLogin({
  urlVideo,
  configurado,
}: {
  urlVideo: string;
  /** Sin base de datos el acceso al panel no puede funcionar. */
  configurado: boolean;
}) {
  const { t } = useApp();
  const router = useRouter();
  const parametros = useSearchParams();

  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [cargando, setCargando] = useState(false);

  async function entrar(evento: React.FormEvent) {
    evento.preventDefault();
    setError('');
    setAviso('');
    setCargando(true);
    try {
      const respuesta = await fetch('/api/acceso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo: 'clave', correo: correo.trim(), clave: contrasena }),
      });
      if (!respuesta.ok) {
        setError(t.login.error);
        return;
      }
      router.push(parametros.get('destino') ?? '/panel');
      router.refresh();
    } catch {
      setError(t.login.error);
    } finally {
      setCargando(false);
    }
  }

  async function enlaceMagico() {
    if (!correo.trim()) {
      setError(t.login.error);
      return;
    }
    setError('');
    setCargando(true);
    try {
      const respuesta = await fetch('/api/acceso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo: 'enlace', correo: correo.trim() }),
      });
      // La respuesta es la misma exista o no la cuenta: decir «ese correo no
      // está dado de alta» delataría quién forma parte del comité.
      if (respuesta.ok) setAviso(t.login.enlaceEnviado);
      else setError(t.login.error);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-ciess-50 dark:bg-ciess-950">
      {/* El velo lo pone el tema: en claro aclara, en oscuro oscurece. */}
      <VideoFondo url={urlVideo} />

      <header className="relative z-10 flex items-center justify-end gap-2 p-4">
        <SelectorIdioma compacto />
        <BotonTema />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center text-slate-900 dark:text-white">
            <LogoCiess className="mx-auto h-14 sm:h-16" />
            <h1 className="mt-4 text-xl font-bold leading-tight">{t.congreso.titulo}</h1>
            <p className="mt-2 text-sm italic text-ciess-700 dark:text-ciess-200">{t.congreso.subtitulo}</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-white/70">{t.login.subtitulo}</p>
          </div>

          {!configurado && (
            <div className="mb-4 rounded-xl border border-amber-500/50 bg-amber-500/15 p-4 text-sm text-amber-900 dark:border-amber-400/40 dark:text-amber-100">
              <p className="font-semibold">El panel todavía no está conectado.</p>
              <p className="mt-1 text-amber-900/85 dark:text-amber-100/85">
                Falta configurar la base de datos en las variables de entorno del despliegue. El formulario
                de registro funciona con normalidad mientras tanto.
              </p>
              <p className="mt-2">
                <Link href="/diagnostico" className="font-medium underline underline-offset-4">
                  Ver qué falta
                </Link>
              </p>
            </div>
          )}

          <form
            onSubmit={entrar}
            className="rounded-xl border border-black/10 bg-white/85 p-6 shadow-2xl backdrop-blur-md dark:border-white/15 dark:bg-black/45"
          >
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t.login.titulo}</h2>

            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="correo" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-white/85">
                  {t.login.correo}
                </label>
                <input
                  id="correo"
                  type="email"
                  autoComplete="email"
                  required
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  className="w-full rounded-lg border border-black/15 dark:border-white/20 bg-white/70 dark:bg-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white
                             placeholder-slate-400 dark:placeholder-white/40 focus:border-ciess-300 focus:outline-none focus:ring-2 focus:ring-ciess-300/40"
                />
              </div>
              <div>
                <label htmlFor="contrasena" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-white/85">
                  {t.login.contrasena}
                </label>
                <input
                  id="contrasena"
                  type="password"
                  autoComplete="current-password"
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                  className="w-full rounded-lg border border-black/15 dark:border-white/20 bg-white/70 dark:bg-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white
                             placeholder-slate-400 dark:placeholder-white/40 focus:border-ciess-300 focus:outline-none focus:ring-2 focus:ring-ciess-300/40"
                />
              </div>
            </div>

            {error && (
              <p className="mt-4 rounded-lg bg-red-500/20 p-2.5 text-sm text-red-200" role="alert">{error}</p>
            )}
            {aviso && (
              <p className="mt-4 rounded-lg bg-emerald-500/20 p-2.5 text-sm text-emerald-200">{aviso}</p>
            )}

            <button type="submit" className="boton-primario mt-5 w-full" disabled={cargando || !configurado}>
              {cargando ? t.estados.cargando : t.login.entrar}
            </button>

            <button
              type="button"
              onClick={enlaceMagico}
              disabled={cargando || !configurado}
              className="mt-3 w-full rounded-lg border border-black/15 dark:border-white/20 px-4 py-2.5 text-sm font-medium
                         text-slate-700 dark:text-white/85 transition hover:bg-white/70 dark:bg-white/10 disabled:opacity-50"
            >
              {t.login.enlaceMagico}
            </button>
          </form>

          <p className="mt-6 text-center text-sm">
            <Link href="/registro" className="text-slate-600 underline hover:text-slate-900 dark:text-white/70 dark:hover:text-white">
              {t.login.volverRegistro}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
