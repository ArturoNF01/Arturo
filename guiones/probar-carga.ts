/**
 * Prueba de carga del alta de registros.
 *
 *   npm run probar-carga                  # 1000 altas, 50 a la vez
 *   npm run probar-carga -- 2000 100      # cuántas y cuántas simultáneas
 *   SITIO=https://… npm run probar-carga  # contra otro sitio
 *
 * No mide por deporte. Mide lo único que de verdad importa el día que se
 * publica la convocatoria: que ninguna alta se pierda y que no haya dos
 * registros con el mismo folio. El ritmo depende de la máquina, y la máquina
 * donde se mide no suele ser la del servidor; la pérdida y la duplicación,
 * no: ésas son del código y se reproducen en cualquier parte.
 *
 * Deja el sitio como lo encontró: los registros que crea llevan el folio
 * marcado y se borran al terminar.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarEntorno } from './entorno';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
cargarEntorno(resolve(RAIZ, '.env'));

const SITIO = process.env.SITIO ?? 'http://localhost:3000';
const MARCA = `carga-${Date.now()}`;

function entero(indice: number, porDefecto: number): number {
  const valor = Number(process.argv[2 + indice]);
  return Number.isFinite(valor) && valor > 0 ? Math.floor(valor) : porDefecto;
}

const TOTAL = Math.min(entero(0, 1000), 20_000);
const SIMULTANEAS = Math.min(entero(1, 50), 500);

interface Resultado { estado: number; folio?: string; ms: number }

async function alta(i: number): Promise<Resultado> {
  const comienzo = performance.now();
  try {
    const respuesta = await fetch(`${SITIO}/api/registros`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        perfil: 'publico_general',
        modalidad: i % 2 === 0 ? 'en_linea' : 'presencial',
        apellidos: 'Prueba', nombres: `Carga ${i}`,
        correo: `${MARCA}-${i}@ejemplo.invalid`,
        institucion: 'Institución de prueba',
        pais_residencia: 'México',
        procedencia: 'nacional',
        consentimiento_datos: true,
        idioma: 'es',
      }),
    });
    const datos = await respuesta.json().catch(() => ({}));
    return { estado: respuesta.status, folio: datos.folio, ms: performance.now() - comienzo };
  } catch {
    return { estado: 0, ms: performance.now() - comienzo };
  }
}

function percentil(ordenados: number[], p: number): number {
  if (ordenados.length === 0) return 0;
  return ordenados[Math.min(ordenados.length - 1, Math.floor(ordenados.length * p))];
}

async function principal() {
  console.log(`Sitio: ${SITIO}`);
  console.log(`Altas: ${TOTAL}, de ${SIMULTANEAS} en ${SIMULTANEAS}.\n`);

  const resultados: Resultado[] = [];
  let siguiente = 0;
  const comienzo = performance.now();

  // Un carril por cada alta simultánea: toma la siguiente en cuanto termina
  // la suya. Mantiene la presión constante, que es lo que hace una apertura
  // de convocatoria, en vez de llegar a ráfagas.
  await Promise.all(
    Array.from({ length: SIMULTANEAS }, async () => {
      while (siguiente < TOTAL) {
        const mio = siguiente++;
        resultados.push(await alta(mio));
        if (resultados.length % 100 === 0) {
          process.stdout.write(`  ${resultados.length} de ${TOTAL}…\n`);
        }
      }
    }),
  );

  const segundos = (performance.now() - comienzo) / 1000;
  const aceptadas = resultados.filter((r) => r.estado === 201);
  const folios = aceptadas.map((r) => r.folio).filter(Boolean) as string[];
  const repetidos = folios.length - new Set(folios).size;
  const tiempos = resultados.map((r) => r.ms).sort((a, b) => a - b);

  const otros = new Map<number, number>();
  for (const r of resultados) {
    if (r.estado !== 201) otros.set(r.estado, (otros.get(r.estado) ?? 0) + 1);
  }

  console.log(`\nAceptadas:        ${aceptadas.length} de ${TOTAL}`);
  console.log(`Folios repetidos: ${repetidos}`);
  console.log(`Ritmo:            ${(TOTAL / segundos).toFixed(0)} altas por segundo`);
  console.log(`Tiempo de alta:   ${percentil(tiempos, 0.5).toFixed(0)} ms la mitad, `
    + `${percentil(tiempos, 0.9).toFixed(0)} ms nueve de cada diez, `
    + `${percentil(tiempos, 0.99).toFixed(0)} ms el peor uno por ciento`);
  if (otros.size > 0) {
    console.log('\nNo aceptadas, por respuesta del servidor:');
    for (const [estado, cuantas] of otros) console.log(`  ${estado || 'sin respuesta'}: ${cuantas}`);
  }

  const { consultar } = await import('../src/lib/bd/conexion');
  const borrados = await consultar(
    'delete from registros where correo like $1 returning id',
    [`${MARCA}-%`],
  );
  console.log(`\nSe retiraron ${borrados.length} registros de la prueba.`);

  const malas = aceptadas.length < TOTAL || repetidos > 0;
  process.exit(malas ? 1 : 0);
}

principal().catch((error) => {
  console.error('Falló la prueba de carga:', error instanceof Error ? error.message : error);
  process.exit(1);
});
