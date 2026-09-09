// Banco de reactivos del cuestionario final.
// La clave de respuestas vive solo en el servidor: el cliente recibe las
// preguntas a través de `preguntasPublicas()`, sin el campo `correcta`.

export const CONFIG = {
  titulo: 'Cuestionario final',
  modulo: 'Bases de datos para programas sociales',
  minutos: 60,
  intentos: 1,
  ponderacion: '50% del módulo',
  aprobatoria: 7,
  disponibleDesde: '29 de septiembre',
  disponibleHasta: '01 de octubre, 23:59 (horario de la Cd. de México)'
};

export const PREGUNTAS = [
  {
    pregunta: 'En la tabla <code>BENEFICIARIO</code>, ¿qué garantiza la clave primaria <code>id_beneficiario</code>?',
    opciones: [
      'Que cada registro se identifica de forma única y el campo no admite valores nulos',
      'Que el campo se ordena alfabéticamente al consultar la tabla',
      'Que el valor puede repetirse siempre que no sea nulo',
      'Que el campo se copia automáticamente a las demás tablas'
    ],
    correcta: 0,
    explicacion: 'La clave primaria identifica unívocamente cada fila: es única y no admite nulos.'
  },
  {
    pregunta: 'La tabla <code>BENEFICIARIO</code> incluye <code>id_banco</code>, que apunta al <code>id_banco</code> de la tabla <code>BANCO</code>. ¿Qué tipo de clave es?',
    opciones: ['Clave candidata', 'Clave foránea', 'Clave primaria compuesta', 'Índice único'],
    correcta: 1,
    explicacion: 'Una clave foránea referencia la clave primaria de otra tabla y sostiene la integridad referencial.'
  },
  {
    pregunta: '¿Cuál de estas instrucciones pertenece al DDL (lenguaje de definición de datos)?',
    opciones: ['<code>SELECT</code>', '<code>UPDATE</code>', '<code>CREATE TABLE</code>', '<code>INSERT</code>'],
    correcta: 2,
    explicacion: 'El DDL define estructuras: CREATE, ALTER y DROP. Las demás son instrucciones DML.'
  },
  {
    pregunta: 'Se requiere registrar el monto del apoyo con centavos exactos, sin errores de redondeo. ¿Qué tipo de dato es el adecuado?',
    opciones: ['<code>DECIMAL(10,2)</code>', '<code>FLOAT</code>', '<code>VARCHAR(10)</code>', '<code>INT</code>'],
    correcta: 0,
    explicacion: 'DECIMAL almacena valores exactos con la escala definida; FLOAT introduce error de redondeo en importes.'
  },
  {
    pregunta: '¿Qué devuelve esta consulta?',
    codigo: 'SELECT nombre, monto\nFROM apoyo\nWHERE monto > 5000;',
    opciones: [
      'Todos los apoyos ordenados por monto',
      'Únicamente las filas cuyo monto es mayor a 5000',
      'La suma de los montos mayores a 5000',
      'Las filas cuyo monto es mayor o igual a 5000'
    ],
    correcta: 1,
    explicacion: 'WHERE filtra filas individuales antes de cualquier agrupación; el operador > excluye el valor 5000.'
  },
  {
    pregunta: '¿Qué tipo de JOIN devuelve exclusivamente las filas con coincidencia en ambas tablas?',
    opciones: ['<code>LEFT JOIN</code>', '<code>RIGHT JOIN</code>', '<code>FULL OUTER JOIN</code>', '<code>INNER JOIN</code>'],
    correcta: 3,
    explicacion: 'INNER JOIN conserva solo las coincidencias; los OUTER conservan además las filas sin pareja.'
  },
  {
    pregunta: 'Se necesita listar a <em>todos</em> los beneficiarios, incluso a quienes aún no tienen un pago registrado. ¿Qué JOIN completa la consulta?',
    codigo: 'SELECT b.nombre, p.monto\nFROM beneficiario b\n___ JOIN pago p ON p.id_beneficiario = b.id_beneficiario;',
    opciones: ['<code>INNER</code>', '<code>LEFT</code>', '<code>CROSS</code>', '<code>NATURAL</code>'],
    correcta: 1,
    explicacion: 'LEFT JOIN conserva todas las filas de la tabla izquierda y deja en NULL las columnas sin coincidencia.'
  },
  {
    pregunta: '¿Qué consulta cuenta cuántos beneficiarios tiene cada programa?',
    opciones: [
      '<code>SELECT id_programa, COUNT(*) FROM beneficiario GROUP BY id_programa;</code>',
      '<code>SELECT COUNT(id_programa) FROM beneficiario;</code>',
      '<code>SELECT id_programa, COUNT(*) FROM beneficiario;</code>',
      '<code>SELECT id_programa FROM beneficiario ORDER BY COUNT(*);</code>'
    ],
    correcta: 0,
    explicacion: 'Al combinar una columna con una función de agregación, esa columna debe aparecer en el GROUP BY.'
  },
  {
    pregunta: '¿Cuál es la diferencia entre <code>WHERE</code> y <code>HAVING</code>?',
    opciones: [
      'Son equivalentes; HAVING solo funciona en vistas',
      'WHERE filtra grupos y HAVING filtra filas',
      'WHERE filtra filas antes de agrupar y HAVING filtra los grupos ya agregados',
      'HAVING únicamente admite comparaciones de texto'
    ],
    correcta: 2,
    explicacion: 'HAVING actúa después del GROUP BY, por eso puede comparar resultados de SUM, COUNT o AVG.'
  },
  {
    pregunta: '¿Qué función obtiene el importe total dispersado por programa?',
    opciones: ['<code>COUNT()</code>', '<code>SUM()</code>', '<code>AVG()</code>', '<code>MAX()</code>'],
    correcta: 1,
    explicacion: 'SUM acumula los valores numéricos de cada grupo; COUNT cuenta filas y AVG promedia.'
  },
  {
    pregunta: '¿Qué obtiene <code>COUNT(DISTINCT id_beneficiario)</code> sobre la tabla de pagos?',
    opciones: [
      'El número de pagos registrados',
      'El número de beneficiarios distintos que recibieron algún pago',
      'El monto total pagado',
      'El número de filas, incluidas las nulas'
    ],
    correcta: 1,
    explicacion: 'DISTINCT elimina repeticiones antes de contar, de modo que cada beneficiario cuenta una sola vez.'
  },
  {
    pregunta: 'Un banco tiene beneficiarios asociados mediante clave foránea y se intenta eliminar ese banco. ¿Qué ocurre por integridad referencial?',
    opciones: [
      'Se eliminan también los beneficiarios sin aviso',
      'La operación se rechaza, o se aplica la acción referencial definida',
      'El campo id_banco cambia a cero automáticamente',
      'La tabla se bloquea de forma permanente'
    ],
    correcta: 1,
    explicacion: 'La restricción impide dejar referencias huérfanas: rechaza el borrado salvo que se declare ON DELETE CASCADE o SET NULL.'
  },
  {
    pregunta: 'La columna <code>telefonos</code> guarda «55-1234, 55-9876» en una sola celda. ¿Qué regla de normalización se incumple?',
    opciones: [
      'Primera forma normal: los valores deben ser atómicos',
      'Segunda forma normal: dependencia parcial de la clave',
      'Tercera forma normal: dependencia transitiva',
      'Ninguna, es una práctica recomendada'
    ],
    correcta: 0,
    explicacion: 'La 1FN exige un solo valor por celda; los teléfonos múltiples requieren una tabla relacionada.'
  },
  {
    pregunta: 'Un beneficiario puede estar inscrito en varios programas y un programa tiene muchos beneficiarios. ¿Cómo se modela esa relación?',
    opciones: [
      'Repitiendo columnas programa_1, programa_2, programa_3',
      'Con una tabla intermedia que contenga las claves foráneas de ambas tablas',
      'Guardando los programas separados por comas',
      'Creando una vista con los dos identificadores'
    ],
    correcta: 1,
    explicacion: 'Toda relación muchos a muchos se resuelve con una tabla puente cuyas claves foráneas apuntan a las dos entidades.'
  },
  {
    pregunta: '¿Qué cláusula muestra los montos del mayor al menor?',
    opciones: ['<code>ORDER BY monto ASC</code>', '<code>GROUP BY monto DESC</code>', '<code>ORDER BY monto DESC</code>', '<code>SORT BY monto</code>'],
    correcta: 2,
    explicacion: 'ORDER BY ordena el resultado; DESC invierte el orden ascendente que se aplica por omisión.'
  },
  {
    pregunta: '¿Cómo se localizan los beneficiarios sin CURP registrada?',
    opciones: ['<code>WHERE curp = NULL</code>', '<code>WHERE curp IS NULL</code>', "<code>WHERE curp = ''</code>", '<code>WHERE curp != TRUE</code>'],
    correcta: 1,
    explicacion: 'NULL representa ausencia de valor y no es comparable con =; se usa IS NULL / IS NOT NULL.'
  },
  {
    pregunta: '¿Qué cláusula acota el resultado a los primeros 10 registros en MySQL o PostgreSQL?',
    opciones: ['<code>LIMIT 10</code>', '<code>ONLY 10</code>', '<code>FIRST 10 ROWS</code>', '<code>CUT 10</code>'],
    correcta: 0,
    explicacion: 'LIMIT restringe el número de filas devueltas; en SQL Server el equivalente es TOP.'
  },
  {
    pregunta: "¿Cuál es el efecto de ejecutar <code>UPDATE beneficiario SET estatus = 'BAJA';</code> sin cláusula <code>WHERE</code>?",
    opciones: [
      'No se ejecuta por falta de condición',
      'Actualiza únicamente el primer registro',
      'Actualiza todas las filas de la tabla',
      'Crea una copia de la tabla con el nuevo valor'
    ],
    correcta: 2,
    explicacion: 'Sin WHERE el UPDATE alcanza toda la tabla: es el error más costoso en operaciones de padrón.'
  },
  {
    pregunta: '¿Qué es una vista (<code>VIEW</code>) en una base de datos relacional?',
    opciones: [
      'Una copia física de la tabla que ocupa el mismo espacio',
      'Una consulta almacenada que se comporta como tabla virtual',
      'Un respaldo automático programado',
      'Un índice sobre la clave primaria'
    ],
    correcta: 1,
    explicacion: 'La vista guarda la definición de la consulta, no los datos: se recalcula cada vez que se consulta.'
  },
  {
    pregunta: '¿Qué indicador entrega esta consulta?',
    codigo: 'SELECT p.nombre, AVG(a.monto) AS promedio\nFROM apoyo a\nJOIN programa p ON p.id_programa = a.id_programa\nGROUP BY p.nombre\nHAVING AVG(a.monto) > 3000;',
    opciones: [
      'El monto total por programa sin filtrar',
      'El promedio de apoyo por programa, solo cuando ese promedio supera 3000',
      'Los apoyos individuales mayores a 3000',
      'El número de programas con apoyos mayores a 3000'
    ],
    correcta: 1,
    explicacion: 'El JOIN cruza apoyo con programa, GROUP BY agrupa por nombre y HAVING filtra los promedios ya calculados.'
  }
];

export const TOTAL = PREGUNTAS.length;
export const PUNTOS_POR_REACTIVO = 10 / TOTAL;

/** Preguntas tal como las recibe el navegador: sin la clave de respuestas. */
export function preguntasPublicas() {
  return PREGUNTAS.map(({ pregunta, codigo, opciones }) => ({ pregunta, codigo, opciones }));
}

/** Califica un arreglo de respuestas (índice elegido, o -1 si no contestó). */
export function calificar(respuestas) {
  const normalizadas = PREGUNTAS.map((_, i) => {
    const v = Array.isArray(respuestas) ? respuestas[i] : -1;
    return Number.isInteger(v) && v >= 0 && v < PREGUNTAS[i].opciones.length ? v : -1;
  });
  const detalle = PREGUNTAS.map((q, i) => ({
    elegida: normalizadas[i],
    correcta: q.correcta,
    acierto: normalizadas[i] === q.correcta,
    explicacion: q.explicacion
  }));
  const aciertos = detalle.filter((d) => d.acierto).length;
  const calificacion = Math.round(aciertos * PUNTOS_POR_REACTIVO * 10) / 10;
  return {
    respuestas: normalizadas,
    detalle,
    aciertos,
    total: TOTAL,
    calificacion,
    aprobado: calificacion >= CONFIG.aprobatoria
  };
}

/** Clave estable de participante: sin acentos, espacios extra ni mayúsculas. */
export function normalizaNombre(nombre) {
  return String(nombre || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
