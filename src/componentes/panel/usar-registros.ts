'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { crearClienteNavegador } from '@/lib/supabase/cliente';

/** Proyección ligera de la tabla `registros` para el dashboard. */
export interface RegistroPanel {
  id: string;
  folio: string;
  creado_en: string;
  perfil: string;
  grupo: 'interno' | 'externo';
  modalidad: 'presencial' | 'en_linea';
  idioma: string;
  estado: string;
  nombres: string;
  apellidos: string;
  correo: string;
  institucion: string | null;
  cargo: string | null;
  pais_residencia: string | null;
  entidad_federativa: string | null;
  ciudad_residencia: string | null;
  procedencia: string | null;
  eje_tematico: string | null;
  modalidad_participacion: string | null;
  regimen_alimentario: string | null;
  requiere_alojamiento: boolean;
  requiere_traslado: string | null;
}

const COLUMNAS =
  'id, folio, creado_en, perfil, grupo, modalidad, idioma, estado, nombres, apellidos, correo, ' +
  'institucion, cargo, pais_residencia, entidad_federativa, ciudad_residencia, procedencia, ' +
  'eje_tematico, modalidad_participacion, regimen_alimentario, requiere_alojamiento, requiere_traslado';

/**
 * Carga los registros visibles para el rol de la sesión (RLS) y se mantiene
 * al día con los cambios en tiempo real de Supabase.
 */
export function useRegistros() {
  const [registros, setRegistros] = useState<RegistroPanel[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = useMemo(() => crearClienteNavegador(), []);

  const cargar = useCallback(async () => {
    const { data, error: fallo } = await supabase
      .from('registros')
      .select(COLUMNAS)
      .order('creado_en', { ascending: false });

    if (fallo) setError(fallo.message);
    else setRegistros((data ?? []) as unknown as RegistroPanel[]);
    setCargando(false);
  }, [supabase]);

  useEffect(() => {
  // La regla no distingue la frontera asíncrona: `cargar` es una promesa y su
  // setState ocurre después del efecto, no de forma síncrona dentro de él.
  // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
  }, [cargar]);

  useEffect(() => {
    const canal = supabase
      .channel('registros-panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registros' }, () => {
        void cargar();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [supabase, cargar]);

  return { registros, cargando, error, recargar: cargar };
}

export interface Filtros {
  desde: string;
  hasta: string;
  pais: string;
  perfil: string;
  institucion: string;
  modalidad: string;
  estado: string;
  texto: string;
}

export const FILTROS_VACIOS: Filtros = {
  desde: '', hasta: '', pais: '', perfil: '', institucion: '', modalidad: '', estado: '', texto: '',
};

export function aplicarFiltros(registros: RegistroPanel[], filtros: Filtros): RegistroPanel[] {
  const texto = filtros.texto.trim().toLowerCase();

  return registros.filter((r) => {
    const dia = r.creado_en.slice(0, 10);
    if (filtros.desde && dia < filtros.desde) return false;
    if (filtros.hasta && dia > filtros.hasta) return false;
    if (filtros.pais && (r.pais_residencia ?? '') !== filtros.pais) return false;
    if (filtros.perfil && r.perfil !== filtros.perfil) return false;
    if (filtros.modalidad && r.modalidad !== filtros.modalidad) return false;
    if (filtros.estado && r.estado !== filtros.estado) return false;
    if (
      filtros.institucion &&
      !(r.institucion ?? '').toLowerCase().includes(filtros.institucion.toLowerCase())
    ) {
      return false;
    }
    if (texto) {
      const bolsa = [
        r.folio, r.nombres, r.apellidos, r.correo, r.institucion, r.pais_residencia,
        r.ciudad_residencia,
      ]
        .join(' ')
        .toLowerCase();
      if (!bolsa.includes(texto)) return false;
    }
    return true;
  });
}
