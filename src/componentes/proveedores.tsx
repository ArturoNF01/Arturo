'use client';

import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import {
  IDIOMAS, IDIOMA_POR_DEFECTO, diccionarios, esIdiomaValido, interpolar,
  type Diccionario, type Idioma,
} from '@/i18n';
import { useAlmacenLocal } from './usar-almacen-local';

type Tema = 'oscuro' | 'claro';

interface ContextoApp {
  idioma: Idioma;
  cambiarIdioma: (idioma: Idioma) => void;
  t: Diccionario;
  tt: (plantilla: string, valores: Record<string, string | number>) => string;
  tema: Tema;
  alternarTema: () => void;
}

const Contexto = createContext<ContextoApp | null>(null);

const CLAVE_IDIOMA = 'congreso.idioma';
const CLAVE_TEMA = 'congreso.tema';

function idiomaDelNavegador(): Idioma {
  if (typeof navigator === 'undefined') return IDIOMA_POR_DEFECTO;
  const preferido = navigator.languages?.map((l) => l.slice(0, 2)) ?? [];
  return (preferido.find((l): l is Idioma => IDIOMAS.includes(l as Idioma)) ?? IDIOMA_POR_DEFECTO);
}

export function Proveedores({
  children,
  idiomaInicial,
}: {
  children: React.ReactNode;
  idiomaInicial?: Idioma;
}) {
  const respaldoIdioma = idiomaInicial ?? IDIOMA_POR_DEFECTO;
  const [idiomaGuardado, guardarIdioma] = useAlmacenLocal(
    CLAVE_IDIOMA,
    respaldoIdioma,
    idiomaDelNavegador,
  );
  // Modo oscuro activo por defecto.
  const [temaGuardado, guardarTema] = useAlmacenLocal(CLAVE_TEMA, 'oscuro');

  const idioma: Idioma = esIdiomaValido(idiomaGuardado) ? idiomaGuardado : respaldoIdioma;
  const tema: Tema = temaGuardado === 'claro' ? 'claro' : 'oscuro';

  // Estos efectos sólo escriben en sistemas externos (documento y cookie),
  // que es justo para lo que sirven.
  useEffect(() => {
    document.documentElement.lang = diccionarios[idioma].meta.codigo;
    document.cookie = `${CLAVE_IDIOMA}=${idioma}; path=/; max-age=31536000; samesite=lax`;
  }, [idioma]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'oscuro');
    document.documentElement.style.colorScheme = tema === 'oscuro' ? 'dark' : 'light';
  }, [tema]);

  const cambiarIdioma = useCallback((nuevo: Idioma) => guardarIdioma(nuevo), [guardarIdioma]);
  const alternarTema = useCallback(
    () => guardarTema(tema === 'oscuro' ? 'claro' : 'oscuro'),
    [guardarTema, tema],
  );

  const valor = useMemo<ContextoApp>(
    () => ({
      idioma,
      cambiarIdioma,
      t: diccionarios[idioma],
      tt: (plantilla, valores) => interpolar(plantilla, valores),
      tema,
      alternarTema,
    }),
    [idioma, tema, cambiarIdioma, alternarTema],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useApp(): ContextoApp {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useApp debe usarse dentro de <Proveedores>.');
  return contexto;
}

/** Atajo para acceder sólo al diccionario. */
export function useT(): Diccionario {
  return useApp().t;
}
