'use client';

import Link from 'next/link';
import { VideoFondo } from '@/componentes/video-fondo';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { BotonTema, SelectorIdioma } from '@/componentes/controles';
import { useApp } from '@/componentes/proveedores';
import { ProveedorRegistros } from './proveedor-registros';
import type { Permisos, UsuarioPanel } from '@/lib/servidor/sesion';
import { AvisosRegistros } from './avisos-registros';
import { ProveedorContenidoPanel } from './contexto-panel';
import type { DatosCongreso, EjeTematico } from '@/lib/contenido';

export function MarcoPanel({
  usuario, permisos, congreso, ejes, urlVideo, children,
}: {
  usuario: UsuarioPanel;
  permisos: Permisos;
  congreso: DatosCongreso;
  ejes: EjeTematico[];
  urlVideo: string;
  children: React.ReactNode;
}) {
  const { t, tt } = useApp();
  const ruta = usePathname();
  const router = useRouter();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const secciones = [
    { href: '/panel', texto: t.panel.secciones.dashboard, visible: true, icono: 'grafica' },
    { href: '/panel/registros', texto: t.panel.secciones.registros, visible: permisos.verRegistros, icono: 'lista' },
    { href: '/panel/analitica', texto: t.panel.secciones.analitica, visible: permisos.verRegistros, icono: 'analitica' },
    { href: '/panel/dictamen', texto: t.panel.secciones.dictamen, visible: permisos.editarRegistros, icono: 'dictamen' },
    { href: '/panel/sql', texto: t.panel.secciones.sql, visible: permisos.consultarSql, icono: 'sql' },
    { href: '/panel/plantillas', texto: t.panel.secciones.plantillas, visible: permisos.editarPlantillas, icono: 'correo' },
    { href: '/panel/cupos', texto: t.panel.secciones.cupos, visible: permisos.editarConfiguracion, icono: 'ajustes' },
    { href: '/panel/contenido', texto: t.panel.secciones.contenido, visible: permisos.editarConfiguracion, icono: 'texto' },
    { href: '/panel/auditoria', texto: t.panel.secciones.auditoria, visible: permisos.verAuditoria, icono: 'escudo' },
    { href: '/panel/usuarios', texto: t.panel.secciones.usuarios, visible: permisos.gestionarUsuarios, icono: 'personas' },
    { href: '/diagnostico', texto: 'Diagnóstico', visible: usuario.rol === 'superadmin', icono: 'pulso' },
  ].filter((s) => s.visible);

  async function salir() {
    await fetch('/api/acceso', { method: 'DELETE' });
    router.push('/login');
    router.refresh();
  }

  const activa = (href: string) => (href === '/panel' ? ruta === href : ruta.startsWith(href));

  return (
    <ProveedorContenidoPanel congreso={congreso} ejes={ejes}>
    <ProveedorRegistros>
    {/* Más tenue que en el login: aquí hay gráficas y tablas que leer, y
        el video no debe competir con ellas. */}
    <VideoFondo url={urlVideo} opacidad={0.08} />
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside
        className="sticky top-0 z-40 border-b lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r"
        style={{ borderColor: 'var(--borde)', backgroundColor: 'var(--fondo-tarjeta)' }}
      >
        <div className="flex items-center gap-3 p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ciess-500 text-sm font-bold text-white">C</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{t.panel.titulo}</p>
            <p className="truncate text-xs tenue">{t.panel.roles[usuario.rol]}</p>
          </div>
          <button
            type="button"
            className="boton-secundario !px-2 !py-1.5 lg:hidden"
            aria-expanded={menuAbierto}
            onClick={() => setMenuAbierto((v) => !v)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
        </div>

        <nav className={`px-2 pb-3 lg:block ${menuAbierto ? 'block' : 'hidden'}`}>
          {secciones.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              onClick={() => setMenuAbierto(false)}
              aria-current={activa(s.href) ? 'page' : undefined}
              className={`mb-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                activa(s.href) ? 'bg-ciess-500/15 text-ciess-400' : 'hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <Icono nombre={s.icono} />
              {s.texto}
            </Link>
          ))}
        </nav>

        <div
          className={`border-t p-3 lg:mt-auto lg:block ${menuAbierto ? 'block' : 'hidden'}`}
          style={{ borderColor: 'var(--borde)' }}
        >
          <p className="mb-3 truncate text-xs tenue">
            {tt(t.panel.bienvenida, { nombre: usuario.nombre ?? usuario.correo })}
          </p>
          <div className="flex items-center gap-2">
            <SelectorIdioma compacto />
            <BotonTema />
            <button type="button" onClick={salir} className="boton-secundario ml-auto !px-2.5 !py-2 !text-xs">
              {t.nav.salir}
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <AvisosRegistros />
        {children}
      </main>
    </div>
    </ProveedorRegistros>
    </ProveedorContenidoPanel>
  );
}

function Icono({ nombre }: { nombre: string }) {
  const trazos: Record<string, string> = {
    grafica: 'M3 3v18h18M7 15l4-4 3 3 5-6',
    lista: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    analitica: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
    dictamen: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6M9 15l2 2 4-4',
    sql: 'M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
    correo: 'M3 7l9 6 9-6M3 7h18v10H3z',
    ajustes: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 11-4 0v-.1A1.6 1.6 0 006 19.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 003 14a2 2 0 110-4 1.6 1.6 0 001.1-2.7l-.1-.1a2 2 0 112.8-2.8l.1.1A1.6 1.6 0 0110 3a2 2 0 114 0 1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1A1.6 1.6 0 0021 10a2 2 0 110 4 1.6 1.6 0 00-1.6 1z',
    escudo: 'M12 3l8 3v6c0 5-3.4 8.3-8 9-4.6-.7-8-4-8-9V6l8-3z',
    texto: 'M4 7V5h16v2M9 20h6M12 5v15',
    pulso: 'M3 12h4l3 8 4-16 3 8h4',
    personas: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8',
  };
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      <path d={trazos[nombre] ?? trazos.grafica} />
    </svg>
  );
}
