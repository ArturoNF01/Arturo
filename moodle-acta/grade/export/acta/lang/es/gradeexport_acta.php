<?php
defined('MOODLE_INTERNAL') || die();

$string['pluginname'] = 'Acta de calificaciones';
$string['acta:view'] = 'Usar el generador de actas de calificaciones';
$string['privacy:metadata'] = 'El plugin no guarda datos personales; solo lee el libro de calificaciones.';
$string['intro'] = 'El acta se genera en PDF con las calificaciones de este curso al abrir esta página; si las cambias, recárgala.';
$string['resumen_curso'] = 'Curso';
$string['resumen_docente'] = 'Docente';
$string['resumen_fecha'] = 'Fecha';
$string['resumen_estudiantes'] = 'Estudiantes';
$string['firma'] = 'Firma del docente (opcional, imagen PNG o JPG)';
$string['preparando'] = 'Preparando…';
$string['descargar'] = 'Descargar';
$string['generando'] = 'Generando el acta…';
$string['listo'] = 'Acta descargada: {$a}';
$string['error'] = 'No se pudo generar el acta.';
$string['firmainvalida'] = 'La firma debe ser una imagen PNG o JPG.';
$string['sinestudiantes'] = 'Este curso no tiene estudiantes con calificaciones para el acta.';
$string['noframe'] = 'No se pudo cargar el generador de actas.';
$string['sinlibreria'] = 'No se pudo cargar la librería de PDF. Verifica tu conexión a internet y recarga la página.';
$string['resumen_grupo'] = 'Grupo';
$string['singrupo'] = 'Este curso usa grupos separados y no perteneces a ningún grupo, por lo que no puedes generar el acta.';
$string['sinlogo'] = 'No se pudo cargar el logo; el acta salió sin él.';
$string['sinmodulo'] = 'No se encontró el módulo en el catálogo; el acta salió sin esa línea.';
$string['errorrecalculo'] = 'Las calificaciones de este curso necesitan recalcularse y Moodle no pudo hacerlo (por ejemplo, un cálculo del libro de calificaciones usa actividades que ya no existen). Pide a un administrador revisar Calificaciones > Configuración; mientras tanto, la exportación estándar de Moodle tampoco funciona en este curso.';
$string['errorlectura'] = 'No se pudieron leer las calificaciones del curso. Inténtalo de nuevo; si sigue igual, avisa a un administrador.';
