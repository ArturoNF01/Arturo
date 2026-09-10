'use client';

import { useContextoRegistros } from './proveedor-registros';

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

/**
 * Registros del panel, ya cargados por el proveedor que envuelve al panel
 * entero. Se mantiene el nombre del gancho para que los componentes que lo
 * usan no cambien.
 */
export function useRegistros() {
  const { registros, cargando, error, recargar } = useContextoRegistros();
  return { registros, cargando, error, recargar };
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
