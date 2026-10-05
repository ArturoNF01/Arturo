# Actas de calificaciones en Moodle (borradores probados solo con simulación)

Hay dos plugins; el recomendado es `gradeexport_acta`. El primero (`local_actacalif`) se puede desinstalar
cuando el segundo funcione.

## gradeexport_acta (recomendado): Calificaciones > Exportar > Acta de calificaciones
Aparece junto a las otras opciones de exportación (archivo de texto, Excel...) y abre el generador de
actas con las calificaciones del curso ya cargadas: no hay que descargar ni subir ningún CSV.
- Sin permisos por defecto: solo los administradores lo ven. Para los docentes, dar el permiso
  `gradeexport/acta:view` al rol Profesor (en todo el sitio: Administración > Usuarios > Permisos > Definir roles;
  o solo en un curso: Curso > Participantes > Permisos).
- Instalar: ZIP `gradeexport_acta.zip` (raíz `acta/`) en Administración > Extensiones > Instalar plugins. Si el
  instalador no puede escribir en `grade/export`, copiar la carpeta `acta` a `<moodle>/grade/export/`
  (Moodle 5.1+: `public/grade/export/`) y entrar a Administración > Notificaciones.
- Solo lectura; respeta el modo de grupos del curso.
- Desinstalar: Administración > Extensiones > Resumen de extensiones > Desinstalar (y borrar la carpeta).

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
Con un Moodle simulado (no hay Moodle real en el entorno de desarrollo): lectura de notas y
armado de la tabla, bloqueo en cursos no habilitados, y el generador en un navegador con datos
de ejemplo hasta el paso de generar el PDF (jsPDF simulado). No probado contra un Moodle real.
