# Actas de calificaciones en Moodle

Hay dos plugins; el recomendado es `gradeexport_acta`. El primero (`local_actacalif`) se puede desinstalar
cuando el segundo funcione.

## gradeexport_acta 0.4.1 (recomendado): Calificaciones > Exportar > Acta de calificaciones
Aparece junto a las otras opciones de exportación. Muestra curso, docente, fecha y número de estudiantes, los
ítems de calificación a incluir (agrupados por módulo), la firma del docente y un botón **Descargar** que baja el
acta en PDF directamente (sin pantallas, sin CSV).
- Novedades de 0.4.1:
  - **Nueva plantilla del acta** (la del CIESS, archivo "Acta de calificaciones.ai"): franja azul y dorada arriba,
    título con ornamentos, logo a la derecha, filete azul, datos del acta (Actividad, Módulo si lo hay, Nombre del
    docente y Fecha) con filetes, tabla con encabezado azul y filas alternadas, "Calificación" en azul y negrita,
    firma con línea dorada, "Firma", nombre del docente y logo, y barra dorada y azul al pie de todas las hojas.
    Letra Work Sans (licencia OFL; en `fonts/` va una versión reducida a caracteres latinos y el plugin se la entrega
    al navegador desde `generador.php`); si no cargara, el acta sale igual en Helvetica. Los datos no cambian (mismos
    alumnos, columnas y valores); solo el diseño del PDF. Con pocas columnas el nombre del alumno tiene más ancho.
  - **La firma nunca queda sola**: si el bloque de firma no cabe en la hoja donde termina la tabla, pasa a una hoja
    nueva que repite el encabezado (título, actividad, módulo, docente y fecha) para saber a qué acta pertenece.
    Las hojas de continuación de la tabla siguen la plantilla (solo el encabezado de la tabla).
  - La vista previa de la firma en la pantalla usa los mismos colores (línea dorada, "Firma" y nombre en azul).
- Novedades de 0.4.0:
  - **Firma del docente destacada**: el título de la firma tiene la misma tipografía que los títulos de módulo y
    al elegir el archivo (PNG o JPG) se muestra una vista previa con la leyenda "Firma" y el nombre del docente,
    como saldrá en el PDF, con el botón "Quitar firma". La imagen se lee y se normaliza en el navegador (respeta la
    orientación de las fotos del celular, se reduce a 900×300 px como máximo y se aplana sobre fondo blanco si es
    JPG); la misma imagen se usa en la vista previa y en el PDF. Mientras se lee, Descargar queda desactivado; una
    imagen dañada o de otro formato se avisa y el acta sale sin firma.
  - **"Exportar" abre directo el generador de actas**: al instalar o actualizar, el plugin pone
    `gradeexport_default = acta` (Administración > Calificaciones > Ajustes generales > "Método de exportación de
    calificaciones por defecto"), así Moodle abre el acta a quien tiene el permiso; quien no lo tiene sigue cayendo
    en la primera opción que pueda usar. Moodle guarda el valor anterior (`exportpredeterminado_previo`) y al
    **desinstalar** el plugin lo restaura (solo si el ajuste sigue en `acta`; si un administrador lo cambió a mano, no
    se toca). El cambio queda en Administración > Informes > Cambios de configuración.
  - **Permiso automático para Docente y Docente de Módulo**: al instalar o actualizar, el plugin da
    `gradeexport/acta:view` en todo el sitio a los roles con nombre corto `docente` y `docente_modulo` (los del
    campus del CIESS) si existen y todavía no tienen una regla para esa capacidad; no pisa lo que un administrador
    ya hubiera definido. Los demás roles siguen sin permiso por defecto.
- Selección de ítems o módulos (nuevo en 0.3.0): como en Exportar > hoja de cálculo, hay una casilla por ítem y una
  por módulo (cada categoría del libro de calificaciones, con su total), más "Seleccionar todo" y "Quitar todo".
  Al abrir va todo marcado y el acta sale como en 0.2.2. Para un docente que da un solo módulo: marcar solo ese
  módulo; el acta trae sus actividades, el total del módulo como "Calificación" y la línea "Módulo: …". Con varios
  módulos sus totales salen como columnas y no hay calificación final (no se inventa un promedio); con ítems
  sueltos tampoco, salvo que se marque "Total del curso". Sin ningún ítem marcado, Descargar queda desactivado.
  Si el catálogo (Google Sheet) dice qué módulo(s) da el docente y su número coincide con una categoría del
  curso, se preselecciona y la pantalla lo avisa; se puede cambiar. Las categorías anidadas dentro de un módulo
  salen como bloque propio; las columnas con "Inducción" en el nombre siguen sin incluirse (regla del generador
  original). Es un filtro de comodidad para el acta: no limita lo que el docente puede ver en Moodle (eso lo
  deciden sus permisos y grupos).
- Curso y calificaciones: los de Moodle (solo lectura; se leen al abrir la página, se recalculan si estaban
  pendientes). Alumnos, columnas, orden y nombres son los mismos que da Exportar > Archivo en texto plano con sus
  valores por defecto: roles del libro de calificaciones con matrícula activa, totales de módulo y del curso con
  su nombre completo y en la posición configurada. Docente: quien inició sesión; si es administrador/coordinador no inscrito y el curso tiene un único
  profesor activo, ese profesor.
- Cursos con el idioma forzado (p. ej. inglés): la calificación final sigue siendo el total del curso aunque se llame
  "Course total"; los nombres de las actividades salen en ese idioma.
- Si Moodle no puede recalcular las calificaciones del curso (p. ej. un cálculo del libro de calificaciones que usa
  actividades ya borradas), la pantalla lo avisa enseguida con un mensaje claro; en ese curso la exportación
  estándar de Moodle falla igual y hay que corregir el cálculo en Calificaciones > Configuración.
- Línea "Módulo": si se marcó uno o varios módulos completos (o ítems de ellos), sale con sus nombres (con el título
  del catálogo cuando el número coincide). Con todo marcado, o si la selección incluye ítems sin módulo o el total
  del curso, sale la del catálogo (Google Sheet) solo si coincide con el curso (mismos números/numerales, nombre
  casi igual) y con el docente; si no, el acta sale sin esa línea y la pantalla lo avisa. El docente del PDF
  siempre es el de Moodle.
- Grupos: con grupos separados, quien no ve todos los grupos solo obtiene los de su grupo; sin grupo, se le niega.
- Permisos: la capacidad `gradeexport/acta:view` no tiene permisos por defecto (solo administradores); el plugin se
  la da solo a los roles `docente` y `docente_modulo` al instalar o actualizar (ver arriba). Para otros roles que
  ya pueden exportar calificaciones (en el campus del CIESS: Profesor, Profesor sin permiso de edición, Profesor
  presencial), darlo a mano en todo el sitio: Administración > Usuarios > Permisos > Definir roles; o solo en un
  curso: Curso > Participantes > Permisos. "Acta de calificaciones" queda como primera opción de "Exportar como".
- Instalar/actualizar: ZIP `gradeexport_acta.zip` (raíz `acta/`) en Administración > Extensiones > Instalar plugins
  (si ya está una versión anterior, Moodle ofrece actualizar a 2026100507). Hacerlo en horario tranquilo: durante la actualización
  de BD todo el sitio pide pasar por Notificaciones. Si el instalador no puede escribir en `grade/export`, copiar
  la carpeta `acta` a `<moodle>/grade/export/` (Moodle 5.1+: `public/grade/export/`).
- Respaldo y reversa: sin respaldo no hay vuelta atrás. NO restaurar archivos de una versión anterior sobre la
  nueva (Moodle bloquea el sitio por "downgrade"); para retirarlo, desinstalar el plugin desde Administración >
  Extensiones > Resumen de extensiones; Moodle ofrece entonces eliminar la carpeta (botón Continuar): hacerlo en ese
  momento, antes de abrir otras pantallas de actualización. Al desinstalar se restaura el método de exportación
  predeterminado (si la carpeta ya no está, esa restauración no corre y el ajuste queda en `acta`; se cambia a mano) y
  Moodle borra el permiso `gradeexport/acta:view` de todos los roles, también las reglas por curso: al reinstalar
  solo Docente y Docente de Módulo lo reciben de nuevo, a los demás roles hay que volver a darlo.
- Requiere internet en el navegador del docente (jsPDF desde cdnjs, catálogo desde Google Sheets); el logo se pide
  a home.ciess.org desde el servidor de Moodle y la letra (Work Sans) la entrega el propio plugin.
- Límites conocidos: con muchas actividades las columnas del PDF se vuelven pequeñas (igual que en el generador
  original): hasta ~25 se lee bien; con 30 los números casi se tocan y con 43 es ilegible (marcar solo un módulo
  reduce las columnas). Caracteres fuera del alfabeto latino (cirílico, griego, emoji) salen en blanco. Los encabezados de actividad
  se abrevian como en el generador original ("Act.M2. Ac.." si varios nombres comparten el inicio).

## local_actacalif (primer borrador)

Plugin local de Moodle 4.5+: agrega "Generar acta de calificaciones" al menú del curso
(solo con `local/actacalif:generate` y `moodle/grade:viewall`). Solo lee el libro de
calificaciones y carga el generador actual de actas, sin pedir el CSV/XLSX.

## Prueba acotada
Queda **inactivo en todos los cursos** hasta que un admin ponga IDs en
Administración > Plugins > Plugins locales > Acta de calificaciones > "IDs de cursos".
Para la prueba: solo el ID del curso "Diplomado test: Alta dirección en instituciones de
seguridad social" (categoría Test). En los demás cursos no aparece el menú y `index.php`
rechaza el acceso. Para apagarlo: vaciar ese ajuste.

## Instalar
1. Respaldo (BD + moodledata).
2. Administración > Plugins > Instalar plugins > subir `local_actacalif.zip` (raíz del zip: `actacalif/`).
   Sin instalador web: copiar `actacalif/` a `<moodle>/local/` (en Moodle 5.1+: `public/local/`).
3. Completar la actualización de base de datos y poner el ID del curso de prueba.
4. En el curso: menú "Más" > "Generar acta de calificaciones"
   (o directo: `/local/actacalif/index.php?id=<ID>`).

Desinstalar: Administración > Plugins > Plugins locales > Desinstalar.

## Qué se probó
`gradeexport_acta` se probó contra un clon real del campus (Moodle 5.1.1+, PHP 8.4, MariaDB 10.11), instalando el
ZIP con el instalador de Moodle (de la 0.1 a la 0.4.0). Se aplicó a los 94 cursos del clon (1.626 alumnos en 77 cursos):
- Datos: en 93 cursos la tabla que lee el plugin es idéntica (alumnos, orden, columnas, nombres y valores) a la de
  Exportar > Archivo en texto plano con los valores por defecto. En el curso restante Moodle no puede recalcular las
  calificaciones (un cálculo usa actividades borradas) y la exportación estándar también falla; el plugin lo avisa.
- PDF de punta a punta (pantalla del plugin y botón Descargar, con nombres de alumnos inventados) en los 77 cursos
  con alumnos y 4 de control (3 sin estudiantes y el del cálculo roto): salió el PDF en 74, de unos 100 KB, en menos
  de medio segundo y hasta 3 páginas (101 alumnos); las filas del PDF coinciden con los alumnos. En los otros 7 la
  pantalla avisa y no baja nada: los 3 sin estudiantes, 3 con estudiantes pero ninguna actividad con nota y el del
  cálculo roto (mensaje claro).
- Otros casos: curso con el idioma forzado a inglés, firma PNG, rol Docente con y sin el permiso (cambio de rol de un
  administrador), línea de módulo con catálogo simulado y paginación con 130 alumnos inventados.
- Diferencias que salieron en estas pruebas y ya están corregidas: docentes con el permiso `moodle/grade:view` que se
  colaban como alumnos, columnas fuera del orden del libro, totales de módulo llamados "Total categoría", espacios
  repetidos en los nombres, celdas de ítems sin calificación numérica ("-" en lugar de vacío) y la calificación final
  en cursos en inglés ("Course total"). El PDF pasó de 8,6 MB a unos 100 KB (logo reducido y compresión).
- Selección de ítems/módulos (0.3.0), sin Moodle y con datos inventados (83 comprobaciones: un módulo, varios, ítems
  sueltos, solo totales, categoría anidada, catálogo con uno o dos módulos, curso en inglés, curso sin módulos): con
  todo marcado el texto del PDF es el mismo que el de 0.2.2. En el clon, en los 94 cursos: con todo marcado la tabla
  del PDF coincide con lo esperado en 73 de los 74 cursos que dan PDF (en el curso 49, de 43 columnas, el texto del
  PDF no permite compararlo); al marcar solo el primer o el segundo módulo salen exactamente sus ítems, su total
  como "Calificación" y la línea "Módulo: …"; sin ítems marcados Descargar queda desactivado. Los 16 cursos sin alumnos y
  el del cálculo roto muestran su aviso; 3 cursos con alumnos pero sin actividades con nota avisan sin PDF, como
  antes. Con el cambio de rol a Docente, Docente de Módulo, Profesor, Profesor sin permiso de edición y Profesor
  presencial (permiso dado en el clon) la pantalla abre y el acta se genera.
- 0.4.0 (firma con vista previa, Exportar abre el acta, permiso automático): sin Moodle, 114 comprobaciones del
  generador y la pantalla (incluye fotos de celular giradas por EXIF, imágenes de 4000×1500 px, archivos dañados,
  Descargar mientras se lee la firma y fallos del lector de archivos) y 20 de las funciones de instalar, actualizar y
  desinstalar con un Moodle simulado. En el clon: instalar la 0.1 (la de producción) y actualizar a la 0.4.0 con el
  instalador; desinstalar y reinstalar (tres veces); `gradeexport_default` pasa a `acta` y vuelve al valor anterior al
  desinstalar; Docente y Docente de Módulo reciben el permiso solos; Exportar abre el acta para el administrador,
  Docente y Docente de Módulo y sigue abriendo OpenOffice para Profesor, Profesor sin permiso de edición y Profesor
  presencial (sin el permiso); regresión en los 94 cursos del clon con todo marcado y con el primer módulo.
- Corregido en 0.3.0 al probar en el clon: el texto de ayuda y el contador salían en blanco (el tema del campus
  pinta `text-muted` de blanco), "Calificación" se partía en dos líneas con pocas columnas y con solo el total la
  tabla quedaba a medias.
No se probó con un usuario docente real (solo cambio de rol de un administrador), ni con el catálogo real de Google
Sheets (el entorno de pruebas no alcanza googleusercontent.com; la preselección se probó con un catálogo simulado),
ni con grupos separados.
`local_actacalif` solo se probó con un Moodle simulado.
