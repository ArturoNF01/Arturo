'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  IDIOMAS, IDIOMA_POR_DEFECTO, diccionarios, esIdiomaValido, interpolar,
  type Diccionario, type Idioma,
} from '@/i18n';

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
  const [idioma, setIdioma] = useState<Idioma>(idiomaInicial ?? IDIOMA_POR_DEFECTO);
  const [tema, setTema] = useState<Tema>('oscuro'); // modo oscuro activo por defecto

  useEffect(() => {
    const guardado = localStorage.getItem(CLAVE_IDIOMA);
    setIdioma(esIdiomaValido(guardado) ? guardado : idiomaInicial ?? idiomaDelNavegador());
    const temaGuardado = localStorage.getItem(CLAVE_TEMA);
    if (temaGuardado === 'claro' || temaGuardado === 'oscuro') setTema(temaGuardado);
  }, [idiomaInicial]);

  useEffect(() => {
    document.documentElement.lang = diccionarios[idioma].meta.codigo;
    document.cookie = `${CLAVE_IDIOMA}=${idioma}; path=/; max-age=31536000; samesite=lax`;
    localStorage.setItem(CLAVE_IDIOMA, idioma);
  }, [idioma]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'oscuro');
    document.documentElement.style.colorScheme = tema === 'oscuro' ? 'dark' : 'light';
    localStorage.setItem(CLAVE_TEMA, tema);
  }, [tema]);

  const cambiarIdioma = useCallback((nuevo: Idioma) => setIdioma(nuevo), []);
  const alternarTema = useCallback(
    () => setTema((actual) => (actual === 'oscuro' ? 'claro' : 'oscuro')),
    [],
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
