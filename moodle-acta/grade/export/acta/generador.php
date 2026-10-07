<?php
// Solo lectura: arma la misma tabla que el CSV/XLSX de exportación y la entrega al generador de actas.
// Se muestra dentro del iframe de index.php.
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->libdir . '/gradelib.php');
require_once($CFG->libdir . '/grouplib.php');
require_once($CFG->dirroot . '/grade/lib.php');
require_once($CFG->dirroot . '/grade/export/lib.php');

$courseid = required_param('id', PARAM_INT);
$logo = optional_param('logo', 0, PARAM_BOOL);

$PAGE->set_url('/grade/export/acta/generador.php', ['id' => $courseid]);
$course = get_course($courseid);
require_login($course);
$context = context_course::instance($courseid);
require_capability('moodle/grade:export', $context);
require_capability('moodle/grade:viewall', $context);
require_capability('gradeexport/acta:view', $context);

if ($logo) {
    \gradeexport_acta\helper::enviar_logo();
}

// Respeta el modo de grupos del curso (con grupos separados, solo los alumnos del grupo del docente).
$groupid = \gradeexport_acta\helper::grupo($course, $context);

// Igual que las exportaciones de Moodle: si hay notas pendientes de recalcular, se recalculan antes de leerlas.
ob_start();
try {
    grade_regrade_final_grades_if_required($course);
} catch (\Throwable $e) {
    debugging($e->getMessage(), DEBUG_DEVELOPER);
}
ob_end_clean();

// Mismas columnas, mismo orden y mismos nombres que el formulario de exportación de Moodle
// (los totales respetan la posición configurada en el curso; los ítems ocultos solo los ve quien puede verlos).
$switch = grade_get_setting($courseid, 'aggregationposition', $CFG->grade_aggregationposition);
$gseq = new grade_seq($courseid, $switch);
$verocultos = has_capability('moodle/grade:viewhidden', $context);
$items = [];
$nombres = [];
foreach ($gseq->items as $item) {
    if ($item->is_hidden() && !$verocultos) {
        continue;
    }
    if ($item->itemtype === 'mod') {
        $nombre = get_string('modulename', $item->itemmodule) . get_string('labelsep', 'langconfig') . $item->get_name();
    } else {
        $nombre = $item->get_name(true);
    }
    $items[$item->id] = $item;
    $nombres[] = html_entity_decode(strip_tags($nombre), ENT_QUOTES, 'UTF-8') . ' (Real)';
}

// Mismos alumnos que la exportación de Moodle: roles del libro de calificaciones con matrícula activa
// (y, si el curso usa grupos, solo los del grupo elegido).
$gui = new graded_users_iterator($course, $items, $groupid);
$gui->require_active_enrolment(true);
if (!$gui->init()) {
    throw new moodle_exception('gradesneedregrading', 'grades');
}
$matriz = [array_merge(['Nombre', 'Apellido(s)', 'Correo'], $nombres)];
while ($alumno = $gui->next_user()) {
    $u = $alumno->user;
    $fila = [$u->firstname, $u->lastname, $u->email];
    foreach ($items as $id => $item) {
        $g = $alumno->grades[$id] ?? null;
        $valor = ($g && $g->finalgrade !== null)
            ? grade_format_gradevalue($g->finalgrade, $item, false, GRADE_DISPLAY_TYPE_REAL, 2)
            : null;
        $fila[] = ($valor === null || $valor === '') ? '-' : $valor;
    }
    $matriz[] = $fila;
}
$gui->close();

$datos = [
    'curso' => format_string($course->fullname, true, ['context' => $context, 'escape' => false]),
    'docente' => \gradeexport_acta\helper::docente($context),
    'matriz' => $matriz,
];
$logourl = (new moodle_url('/grade/export/acta/generador.php', ['id' => $courseid, 'logo' => 1]))->out(false);

$html = file_get_contents(__DIR__ . '/templates/generador.html');
// Modo directo: la interfaz del generador queda oculta; index.php maneja el botón y la descarga.
$inyeccion = '<style>#acta-app{display:none!important}</style>'
    . '<script>window.ACTA_DIRECTO = true;window.ACTA_DATOS = ' . json_encode($datos, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE) . ';'
    . 'window.ACTA_LOGO_URL = ' . json_encode($logourl, JSON_HEX_TAG | JSON_HEX_AMP) . ';</script>';
$html = str_replace('<body>', '<body>' . $inyeccion, $html);
// La lectura de CSV/XLSX no se usa en modo directo: no se carga la librería XLSX (900 KB de terceros en el sitio).
$html = preg_replace('#<script src="[^"]*xlsx[^"]*"></script>#i', '', $html);

header('Content-Type: text/html; charset=utf-8');
echo $html;
