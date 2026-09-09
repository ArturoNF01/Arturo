import { CONFIG, preguntasPublicas } from '../../lib/cuestionario.js';
import { json } from '../../lib/sesion.js';

export function onRequestGet() {
  return json({ config: CONFIG, preguntas: preguntasPublicas() });
}
