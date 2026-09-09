/**
 * Genera registros de demostración en Supabase para poder evaluar el panel
 * antes de abrir el formulario al público.
 *
 *   npx tsx guiones/sembrar-demostracion.ts 120
 *   npx tsx guiones/sembrar-demostracion.ts --borrar
 *
 * Los registros llevan el folio marcado con DEMO, de modo que `--borrar` los
 * elimina sin tocar ningún registro real.
 */
import { createClient } from '@supabase/supabase-js';
import { PERFILES } from '../src/lib/perfiles';
import { OPCIONES } from '../src/lib/opciones';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CLAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !CLAVE) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(URL, CLAVE, { auth: { persistSession: false } });

const PAISES: [string, string, string][] = [
  ['México', 'Ciudad de México', 'nacional'],
  ['México', 'Guadalajara', 'nacional'],
  ['Brasil', 'Brasilia', 'internacional'],
  ['Brasil', 'São Paulo', 'internacional'],
  ['Argentina', 'Buenos Aires', 'internacional'],
  ['Colombia', 'Bogotá', 'internacional'],
  ['Chile', 'Santiago', 'internacional'],
  ['Perú', 'Lima', 'internacional'],
  ['Uruguay', 'Montevideo', 'internacional'],
  ['Costa Rica', 'San José', 'internacional'],
  ['Estados Unidos', 'Washington', 'internacional'],
  ['España', 'Madrid', 'internacional'],
  ['Canadá', 'Ottawa', 'internacional'],
  ['Ecuador', 'Quito', 'internacional'],
];

const INSTITUCIONES = [
  'CIESS', 'CISS', 'Instituto Mexicano del Seguro Social',
  'Universidad Nacional Autónoma de México', 'Universidade de São Paulo',
  'Universidad de Buenos Aires', 'Organización Internacional del Trabajo',
  'Ministerio de Trabajo', 'Universidad de Chile', 'CEPAL',
];

const NOMBRES = ['Ana', 'Carlos', 'María', 'João', 'Lucía', 'Pedro', 'Sofía', 'Miguel', 'Camila', 'Rafael'];
const APELLIDOS = ['Ruiz', 'Silva', 'Martínez', 'Oliveira', 'González', 'Pereira', 'Torres', 'Ramírez'];
const EJES = [
  'Eje 1 · Cobertura y suficiencia de la protección social',
  'Eje 2 · Sostenibilidad financiera de los sistemas de pensiones',
  'Eje 3 · Salud, cuidados y envejecimiento',
  'Eje 4 · Trabajo, informalidad y nuevas formas de empleo',
];

const azar = <T,>(lista: readonly T[]): T => lista[Math.floor(Math.random() * lista.length)];

/**
 * Fecha dentro de los últimos días, con más peso en horario de oficina para
 * que el heatmap de actividad tenga una forma realista.
 */
function fechaAleatoria(diasAtras: number): Date {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - Math.floor(Math.random() * diasAtras));
  const horaLaboral = Math.random() < 0.75;
  fecha.setHours(
    horaLaboral ? 9 + Math.floor(Math.random() * 9) : Math.floor(Math.random() * 24),
    Math.floor(Math.random() * 60),
    0,
    0,
  );
  return fecha;
}

function construir(indice: number) {
  const perfil = azar(PERFILES);
  const [pais, ciudad, procedencia] = azar(PAISES);
  const modalidad = perfil.permitePresencial && (Math.random() < 0.6 || !perfil.permiteEnLinea)
    ? 'presencial'
    : 'en_linea';
  const nombres = azar(NOMBRES);
  const apellidos = `${azar(APELLIDOS)} ${azar(APELLIDOS)}`;
  const creado = fechaAleatoria(21);

  return {
    folio: `REG-DEMO-${String(indice).padStart(4, '0')}`,
    perfil: perfil.clave,
    grupo: perfil.grupo,
    modalidad,
    idioma: azar(['es', 'es', 'es', 'en', 'pt']),
    apellidos,
    nombres,
    nombre_personificador: perfil.requiereSemblanza ? `Dr. ${nombres} ${apellidos}` : null,
    correo: `demo${indice}@ejemplo.org`,
    telefono_whatsapp: '+52 55 0000 0000',
    institucion: azar(INSTITUCIONES),
    cargo: azar(['Investigador', 'Directora', 'Analista', 'Coordinadora', 'Consultor']),
    procedencia: azar(OPCIONES.procedencia) === 'local' ? 'local' : procedencia,
    pais_residencia: pais,
    ciudad_residencia: ciudad,
    eje_tematico: perfil.requiereAcademico ? azar(EJES) : null,
    modalidad_participacion: perfil.requiereAcademico ? azar(OPCIONES.roles) : null,
    semblanza: perfil.requiereSemblanza
      ? 'Persona investigadora especializada en seguridad social, con trabajo sobre cobertura y sostenibilidad de los sistemas de pensiones en América Latina.'
      : null,
    regimen_alimentario: modalidad === 'presencial' ? azar(OPCIONES.regimen) : null,
    requiere_alojamiento: perfil.requiereLogistica && modalidad === 'presencial' && Math.random() < 0.5,
    requiere_traslado: perfil.requiereLogistica && modalidad === 'presencial'
      ? azar(OPCIONES.traslado)
      : 'no',
    medio_arribo: azar(OPCIONES.medioArribo),
    estado: 'en_proceso',
    consentimiento_datos: true,
    consentimiento_fecha: creado.toISOString(),
    creado_en: creado.toISOString(),
  };
}

async function borrar() {
  const { error, count } = await supabase
    .from('registros')
    .delete({ count: 'exact' })
    .like('folio', 'REG-DEMO-%');
  if (error) throw error;
  console.log(`Eliminados ${count ?? 0} registros de demostración.`);
}

async function sembrar(cantidad: number) {
  const filas = Array.from({ length: cantidad }, (_, i) => construir(i + 1));
  // En lotes para no exceder el tamaño de petición de PostgREST.
  for (let inicio = 0; inicio < filas.length; inicio += 50) {
    const lote = filas.slice(inicio, inicio + 50);
    const { error } = await supabase.from('registros').insert(lote);
    if (error) throw error;
    console.log(`Insertados ${Math.min(inicio + lote.length, filas.length)} de ${filas.length}…`);
  }
  console.log(`Listo: ${cantidad} registros de demostración.`);
}

const argumento = process.argv[2] ?? '80';

(async () => {
  try {
    if (argumento === '--borrar') await borrar();
    else await sembrar(Math.min(Math.max(Number(argumento) || 80, 1), 2000));
  } catch (error) {
    console.error('Falló el sembrado:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
})();
