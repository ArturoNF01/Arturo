# Actas de calificaciones en Moodle

Hay dos plugins; el recomendado es `gradeexport_acta`. El primero (`local_actacalif`) se puede desinstalar
cuando el segundo funcione.

## gradeexport_acta 0.2.1 (recomendado): Calificaciones > Exportar > Acta de calificaciones
Aparece junto a las otras opciones de exportación. Muestra curso, docente, fecha y número de estudiantes, y un
botón **Descargar** que baja el acta en PDF directamente (sin pantallas, sin CSV). Firma opcional (PNG/JPG).
- Curso y calificaciones: los de Moodle (solo lectura; se leen al abrir la página, se recalculan si estaban
  pendientes). Alumnos, columnas, orden y nombres son los mismos que da Exportar > Archivo en texto plano con sus
  valores por defecto: roles del libro de calificaciones con matrícula activa, totales de módulo y del curso con
  su nombre completo y en la posición configurada. Docente: quien inició sesión; si es administrador/coordinador no inscrito y el curso tiene un único
  profesor activo, ese profesor.
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
  (si ya está la 0.1, Moodle ofrece actualizar a 2026100503). Hacerlo en horario tranquilo: durante la actualización
  de BD todo el sitio pide pasar por Notificaciones. Si el instalador no puede escribir en `grade/export`, copiar
  la carpeta `acta` a `<moodle>/grade/export/` (Moodle 5.1+: `public/grade/export/`).
- Respaldo y reversa: sin respaldo no hay vuelta atrás. NO restaurar archivos de una versión anterior sobre la
  nueva (Moodle bloquea el sitio por "downgrade"); para retirarlo, desinstalar el plugin desde Administración >
  Extensiones > Resumen de extensiones y borrar la carpeta.
- Requiere internet en el navegador del docente (jsPDF desde cdnjs, catálogo desde Google Sheets); el logo se pide
  a home.ciess.org desde el servidor de Moodle.
- Límites conocidos: con muchas actividades las columnas del PDF se vuelven pequeñas (igual que en el generador
  original); caracteres fuera de Latin-1 (emoji, ć, ł) pueden salir mal.

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
`gradeexport_acta` se probó contra un clon real del campus (Moodle 5.1.1+, PHP 8.4, MariaDB 10.11, plugin 0.1
actualizado a 0.2.1 con el instalador de ZIP): descarga del PDF, firma PNG, línea de módulo (con catálogo
simulado), rol Docente con y sin el permiso, y paginación con 130 alumnos inventados. La tabla que lee el plugin
es idéntica (alumnos, orden, columnas, nombres y valores) a la de Exportar > Archivo en texto plano con los
valores por defecto. En esa prueba salieron tres diferencias que ya están corregidas en 0.2.1: se colaban
docentes con el permiso `moodle/grade:view`, las columnas no seguían el orden del libro y los totales de módulo se
llamaban "Total categoría". El PDF pasó de 8,6 MB a unos 100 KB (logo reducido y compresión).
No se probó con un usuario docente real (solo cambio de rol de un administrador), ni con el catálogo real
de Google Sheets (el entorno de pruebas no alcanza googleusercontent.com), ni con grupos separados.
`local_actacalif` solo se probó con un Moodle simulado.
