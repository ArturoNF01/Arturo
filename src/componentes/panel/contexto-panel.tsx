'use client';

import { createContext, useContext, useMemo } from 'react';
import { useApp } from '@/componentes/proveedores';
import { traducir, type DatosCongreso, type EjeTematico } from '@/lib/contenido';

interface ContenidoPanel {
  ejes: EjeTematico[];
  congreso: DatosCongreso;
  /** Nombre traducido de un eje a partir de su clave. */
  nombreEje: (clave: string | null | undefined) => string;
}

const Contexto = createContext<ContenidoPanel | null>(null);

export function ProveedorContenidoPanel({
  ejes,
  congreso,
  children,
}: {
  ejes: EjeTematico[];
  congreso: DatosCongreso;
  children: React.ReactNode;
}) {
  const { idioma } = useApp();

  const valor = useMemo<ContenidoPanel>(
    () => ({
      ejes,
      congreso,
      nombreEje: (clave) => {
        if (!clave) return '';
        const eje = ejes.find((e) => e.clave === clave);
        return eje ? traducir(eje.nombre, idioma) : clave;
      },
    }),
    [ejes, congreso, idioma],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useContenidoPanel(): ContenidoPanel {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useContenidoPanel debe usarse dentro del panel.');
  return contexto;
}
