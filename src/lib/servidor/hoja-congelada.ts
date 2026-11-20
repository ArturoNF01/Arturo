import 'server-only';
import { conActor, consultar } from '@/lib/bd/conexion';

/**
 * «Congelar» la pestaña «Asistencia por persona»: mientras esté congelada el sistema no escribe en ella ni mueve nada, porque
 * quien hace las constancias la está editando a mano.
 *
 * Por qué hace falta: la pestaña es una copia de la base, y cada pasada (al escanear, cada diez minutos por cron, en cada despliegue
 * y con el botón del panel) compara fila por fila y, desde la primera que difiere de la base, reescribe hacia abajo sus diez primeras
 * columnas. Un nombre corregido a mano, una casilla de «Con registro» que se cambió, una fila borrada, insertada o reordenada: todo
 * eso lo deshace la pasada siguiente, y si cambió el orden de las filas deja las constancias (a la derecha, que no se tocan) en la
 * fila de otra persona. Con la pestaña congelada, lo que está en la hoja es lo que vale.
 *
 * Es una fila de `configuracion` (se cambia desde el panel, en Asistencia, o con `npm run congelar-hoja`). Nace congelada: terminó el
 * evento y desde ahora la hoja es el documento de trabajo.
 */
export const CLAVE_HOJA_CONGELADA = 'hoja_personas_congelada';

export const TEXTO_HOJA_CONGELADA =
  'La pestaña «Asistencia por persona» está congelada: el sistema no la toca y lo que está en la hoja es lo que vale. Se descongela desde el panel (Asistencia) o con npm run congelar-hoja -- --descongelar.';

/** ¿Está congelada? Sin la fila (una base que no ha recibido el esquema todavía) cuenta como no congelada: el comportamiento de siempre. */
export async function hojaCongelada(): Promise<boolean> {
  const filas = await consultar<{ valor: unknown }>('select valor from configuracion where clave = $1', [CLAVE_HOJA_CONGELADA]);
  return filas.length > 0 && filas[0].valor === true;
}

/** Congela o descongela la pestaña; queda en la auditoría con quien lo hizo (nadie: el sistema, si viene de un guion). */
export async function ponerHojaCongelada(congelada: boolean, usuarioId: string | null): Promise<void> {
  await conActor(
    usuarioId,
    `insert into configuracion (clave, valor, descripcion)
     values ($1, $2::jsonb, 'La pestaña «Asistencia por persona» se edita a mano: el sistema no la escribe')
     on conflict (clave) do update set valor = excluded.valor, actualizado_por = $3`,
    [CLAVE_HOJA_CONGELADA, JSON.stringify(congelada), usuarioId],
  );
}

/**
 * Para los guiones que cambian la base y esperan que la hoja los siga (quitar filas, ligar asistencias, cambiar perfiles): con la
 * pestaña congelada no la siguen, y la base y la hoja quedarían distintas. Se niegan a seguir y dicen cómo descongelar.
 */
export async function exigirHojaLibre(): Promise<void> {
  if (await hojaCongelada()) {
    throw new Error(`${TEXTO_HOJA_CONGELADA}\nEste guion cambia la base y la hoja no recibiría el cambio. Si es lo que se quiere, descongele primero.`);
  }
}
