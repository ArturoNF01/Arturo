# Actas de calificaciones en Moodle

Hay dos plugins; el recomendado es `gradeexport_acta`. El primero (`local_actacalif`) se puede desinstalar
cuando el segundo funcione.

## gradeexport_acta 0.2.2 (recomendado): Calificaciones > Exportar > Acta de calificaciones
Aparece junto a las otras opciones de exportación. Muestra curso, docente, fecha y número de estudiantes, y un
botón **Descargar** que baja el acta en PDF directamente (sin pantallas, sin CSV). Firma opcional (PNG/JPG).
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
- Línea "Módulo": solo si el catálogo (Google Sheet) coincide con el curso (mismos números/numerales, nombre casi
  igual) y con el docente. Si no, el acta sale sin esa línea y la pantalla lo avisa. El docente del PDF siempre es
  el de Moodle.
- Grupos: con grupos separados, quien no ve todos los grupos solo obtiene los de su grupo; sin grupo, se le niega.
- Sin permisos por defecto: solo los administradores lo ven. Para los docentes, dar el permiso
  `gradeexport/acta:view` al rol que usan para calificar (en el campus del CIESS: "Docente", y los demás roles que
  ya pueden exportar calificaciones) (en todo el sitio: Administración > Usuarios > Permisos > Definir roles;
  o solo en un curso: Curso > Participantes > Permisos). Al ordenar alfabéticamente, "Acta" queda primero entre las
  exportaciones; si Moodle abre la primera al entrar a Exportar, los docentes con el permiso caerán directo aquí.
- Instalar/actualizar: ZIP `gradeexport_acta.zip` (raíz `acta/`) en Administración > Extensiones > Instalar plugins
  (si ya está una versión anterior, Moodle ofrece actualizar a 2026100504). Hacerlo en horario tranquilo: durante la actualización
  de BD todo el sitio pide pasar por Notificaciones. Si el instalador no puede escribir en `grade/export`, copiar
  la carpeta `acta` a `<moodle>/grade/export/` (Moodle 5.1+: `public/grade/export/`).
- Respaldo y reversa: sin respaldo no hay vuelta atrás. NO restaurar archivos de una versión anterior sobre la
  nueva (Moodle bloquea el sitio por "downgrade"); para retirarlo, desinstalar el plugin desde Administración >
  Extensiones > Resumen de extensiones y borrar la carpeta.
- Requiere internet en el navegador del docente (jsPDF desde cdnjs, catálogo desde Google Sheets); el logo se pide
  a home.ciess.org desde el servidor de Moodle.
- Límites conocidos: con muchas actividades las columnas del PDF se vuelven pequeñas (igual que en el generador
  original): hasta ~25 se lee bien; con 30 los números casi se tocan y con 43 es ilegible. Caracteres fuera de
  Latin-1 (emoji, ć, ł) pueden salir mal.

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
ZIP con el instalador de Moodle (de la 0.1 a la 0.2.2). Se aplicó a los 94 cursos del clon (1.626 alumnos en 77 cursos):
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
No se probó con un usuario docente real (solo cambio de rol de un administrador), ni con el catálogo real de Google
Sheets (el entorno de pruebas no alcanza googleusercontent.com), ni con grupos separados.
`local_actacalif` solo se probó con un Moodle simulado.
