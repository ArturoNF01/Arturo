'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { BotonTema, SelectorIdioma } from '@/componentes/controles';
import { useApp } from '@/componentes/proveedores';
import { crearClienteNavegador } from '@/lib/supabase/cliente';
import { VideoFondo } from '@/componentes/video-fondo';

export function PaginaLogin({
  urlVideo,
  configurado,
}: {
  urlVideo: string;
  /** Sin credenciales de Supabase el acceso al panel no puede funcionar. */
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
      const supabase = crearClienteNavegador();
      const { error: fallo } = await supabase.auth.signInWithPassword({
        email: correo.trim(),
        password: contrasena,
      });
      if (fallo) {
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
      const supabase = crearClienteNavegador();
      const { error: fallo } = await supabase.auth.signInWithOtp({
        email: correo.trim(),
        options: { emailRedirectTo: `${window.location.origin}/panel` },
      });
      if (fallo) setError(t.login.error);
      else setAviso(t.login.enlaceEnviado);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-ciess-950">
      <VideoFondo url={urlVideo} variante="oscuro" />

      <header className="relative z-10 flex items-center justify-end gap-2 p-4">
        <SelectorIdioma compacto />
        <BotonTema />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ciess-300">
              CIESS · CISS
            </p>
            <h1 className="mt-3 text-xl font-bold leading-tight">{t.congreso.tituloCorto}</h1>
            <p className="mt-2 text-sm text-white/70">{t.login.subtitulo}</p>
          </div>

          {!configurado && (
            <div className="mb-4 rounded-xl border border-amber-400/40 bg-amber-500/15 p-4 text-sm text-amber-100">
              <p className="font-semibold">El panel todavía no está conectado.</p>
              <p className="mt-1 text-amber-100/85">
                Falta configurar Supabase en las variables de entorno del despliegue. El formulario
                de registro funciona con normalidad mientras tanto.
              </p>
            </div>
          )}

          <form
            onSubmit={entrar}
            className="rounded-xl border border-white/15 bg-black/45 p-6 shadow-2xl backdrop-blur-md"
          >
            <h2 className="text-lg font-semibold text-white">{t.login.titulo}</h2>

            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="correo" className="mb-1.5 block text-sm font-medium text-white/85">
                  {t.login.correo}
                </label>
                <input
                  id="correo"
                  type="email"
                  autoComplete="email"
                  required
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white
                             placeholder-white/40 focus:border-ciess-300 focus:outline-none focus:ring-2 focus:ring-ciess-300/40"
                />
              </div>
              <div>
                <label htmlFor="contrasena" className="mb-1.5 block text-sm font-medium text-white/85">
                  {t.login.contrasena}
                </label>
                <input
                  id="contrasena"
                  type="password"
                  autoComplete="current-password"
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                  className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white
                             placeholder-white/40 focus:border-ciess-300 focus:outline-none focus:ring-2 focus:ring-ciess-300/40"
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
              className="mt-3 w-full rounded-lg border border-white/20 px-4 py-2.5 text-sm font-medium
                         text-white/85 transition hover:bg-white/10 disabled:opacity-50"
            >
              {t.login.enlaceMagico}
            </button>
          </form>

          <p className="mt-6 text-center text-sm">
            <Link href="/registro" className="text-white/70 underline hover:text-white">
              {t.login.volverRegistro}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
