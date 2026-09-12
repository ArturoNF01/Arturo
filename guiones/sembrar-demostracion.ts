/**
 * Genera registros de demostración para poder evaluar el panel antes de abrir
 * el formulario al público.
 *
 *   npm run sembrar 120
 *   npm run sembrar -- --borrar
 *
 * Los registros llevan el folio marcado con DEMO, de modo que `--borrar` los
 * elimina sin tocar ningún registro real.
 *
 * Sembrar es repetible: antes de insertar barre los DEMO que hubiera. Si una
 * corrida anterior se quedó a medias —y eso pasa— la siguiente no choca contra
 * el folio ya usado, y al terminar hay exactamente la cantidad pedida.
 */
import { armarInsercion, consultar } from '../src/lib/bd/conexion';
import { PERFILES } from '../src/lib/perfiles';
import { OPCIONES } from '../src/lib/opciones';
import { EJES_POR_DEFECTO } from '../src/lib/contenido';

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL.');
  process.exit(1);
}

/**
 * Procedencia de los registros de demostración, con su peso.
 *
 * No se reparte al azar por igual: un congreso del CIESS en Ciudad de México
 * llena de mexicanos, y un tablero que muestre catorce países empatados no
 * se parece a nada. Europa aparece como lo que será: una presencia mínima.
 */
const PAISES: [string, string, string, number][] = [
  ['México', 'Ciudad de México', 'nacional', 26],
  ['México', 'Guadalajara', 'nacional', 7],
  ['México', 'Monterrey', 'nacional', 6],
  ['México', 'Mérida', 'nacional', 4],
  ['Brasil', 'Brasilia', 'internacional', 6],
  ['Brasil', 'São Paulo', 'internacional', 5],
  ['Argentina', 'Buenos Aires', 'internacional', 6],
  ['Colombia', 'Bogotá', 'internacional', 6],
  ['Chile', 'Santiago', 'internacional', 5],
  ['Perú', 'Lima', 'internacional', 4],
  ['Uruguay', 'Montevideo', 'internacional', 3],
  ['Costa Rica', 'San José', 'internacional', 3],
  ['Ecuador', 'Quito', 'internacional', 3],
  ['Panamá', 'Ciudad de Panamá', 'internacional', 3],
  ['República Dominicana', 'Santo Domingo', 'internacional', 3],
  ['Guatemala', 'Guatemala', 'internacional', 2],
  ['El Salvador', 'San Salvador', 'internacional', 2],
  ['Estados Unidos', 'Washington', 'internacional', 3],
  ['Canadá', 'Ottawa', 'internacional', 2],
  ['España', 'Madrid', 'internacional', 1],
];

/** Elige respetando los pesos de arriba. */
function azarPonderado<T extends readonly [string, string, string, number]>(lista: readonly T[]): T {
  const total = lista.reduce((suma, fila) => suma + fila[3], 0);
  let punto = Math.random() * total;
  for (const fila of lista) {
    punto -= fila[3];
    if (punto <= 0) return fila;
  }
  return lista[lista.length - 1];
}

const INSTITUCIONES = [
  'CIESS', 'CISS', 'Instituto Mexicano del Seguro Social',
  'Universidad Nacional Autónoma de México', 'Universidade de São Paulo',
  'Universidad de Buenos Aires', 'Organización Internacional del Trabajo',
  'Ministerio de Trabajo', 'Universidad de Chile', 'CEPAL',
];

const NOMBRES = ['Ana', 'Carlos', 'María', 'João', 'Lucía', 'Pedro', 'Sofía', 'Miguel', 'Camila', 'Rafael'];
const APELLIDOS = ['Ruiz', 'Silva', 'Martínez', 'Oliveira', 'González', 'Pereira', 'Torres', 'Ramírez'];
const EJES = EJES_POR_DEFECTO.map((e) => e.clave);

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
  const [pais, ciudad, procedencia] = azarPonderado(PAISES);
  // Todos los perfiles admiten ambas; se reparte 60/40 hacia lo presencial.
  const modalidad = Math.random() < 0.6 ? 'presencial' : 'en_linea';
  const nombres = azar(NOMBRES);
  const apellidos = `${azar(APELLIDOS)} ${azar(APELLIDOS)}`;
  const creado = fechaAleatoria(21);

  return {
    folio: `REG-DEMO-${String(indice).padStart(4, '0')}`,
    perfil: perfil.clave,
    modalidad,
    idioma: azar(['es', 'es', 'es', 'en', 'pt']),
    apellidos,
    nombres,
    nombre_personificador: perfil.enPrograma ? `Dr. ${nombres} ${apellidos}` : null,
    correo: `demo${indice}@ejemplo.org`,
    telefono_whatsapp: '+52 55 0000 0000',
    institucion: azar(INSTITUCIONES),
    cargo: azar(['Investigador', 'Directora', 'Analista', 'Coordinadora', 'Consultor']),
    procedencia: azar(OPCIONES.procedencia) === 'local' ? 'local' : procedencia,
    pais_residencia: pais,
    ciudad_residencia: ciudad,
    eje_tematico: perfil.presentaPonencia ? azar(EJES) : null,
    modalidad_participacion: perfil.presentaPonencia ? azar(OPCIONES.roles) : null,
    semblanza: perfil.enPrograma
      ? 'Persona investigadora especializada en seguridad social, con trabajo sobre cobertura y sostenibilidad de los sistemas de pensiones en América Latina.'
      : null,
    regimen_alimentario: modalidad === 'presencial' ? azar(OPCIONES.regimen) : null,
    requiere_alojamiento: perfil.invitado && modalidad === 'presencial' && Math.random() < 0.5,
    requiere_traslado: perfil.invitado && modalidad === 'presencial'
      ? azar(OPCIONES.traslado)
      : 'no',
    medio_arribo: azar(OPCIONES.medioArribo),
    estado: 'en_proceso',
    consentimiento_datos: true,
    consentimiento_fecha: creado.toISOString(),
    creado_en: creado.toISOString(),
  };
}

/** Quita los de demostración y devuelve cuántos eran. Nunca toca un registro real. */
async function borrar(): Promise<number> {
  const borrados = await consultar<{ id: string }>(
    `delete from registros where folio like 'REG-DEMO-%' returning id`,
  );
  return borrados.length;
}

async function sembrar(cantidad: number) {
  const previos = await borrar();
  if (previos > 0) {
    console.log(`Se retiraron ${previos} registros de demostración anteriores.`);
  }

  const filas = Array.from({ length: cantidad }, (_, i) => construir(i + 1));

  for (const [indice, fila] of filas.entries()) {
    const { columnas, marcadores, valores } = armarInsercion(fila as Record<string, unknown>);
    await consultar(`insert into registros (${columnas}) values (${marcadores})`, valores);
    if ((indice + 1) % 25 === 0 || indice + 1 === filas.length) {
      console.log(`Insertados ${indice + 1} de ${filas.length}…`);
    }
  }
  console.log(`Listo: ${cantidad} registros de demostración.`);
}

const argumento = process.argv[2] ?? '100';

(async () => {
  try {
    if (argumento === '--borrar') {
      console.log(`Eliminados ${await borrar()} registros de demostración.`);
    } else await sembrar(Math.min(Math.max(Number(argumento) || 100, 1), 2000));
  } catch (error) {
    console.error('Falló el sembrado:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
})();
