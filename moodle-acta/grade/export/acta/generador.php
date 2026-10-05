<?php
// Solo lectura: arma la misma tabla que el CSV/XLSX de exportación y la entrega al generador de actas.
// Se muestra dentro del iframe de index.php.
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->libdir . '/gradelib.php');
require_once($CFG->libdir . '/grouplib.php');

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
$groupid = groups_get_course_group($course, true);
$users = get_enrolled_users($context, 'moodle/grade:view', $groupid, 'u.id, u.firstname, u.lastname, u.email',
    'u.lastname, u.firstname', 0, 0, true);

// Misma regla de nombres de columna que la exportación de Moodle.
$items = [];
foreach (grade_item::fetch_all(['courseid' => $courseid]) ?: [] as $item) {
    if ($item->itemtype === 'mod') {
        $nombre = get_string('modulename', $item->itemmodule) . get_string('labelsep', 'langconfig') . $item->get_name();
    } else {
        $nombre = $item->get_name();
    }
    $nombre = html_entity_decode(strip_tags($nombre), ENT_QUOTES, 'UTF-8');
    $items[] = ['item' => $item, 'nombre' => $nombre . ' (Real)'];
}
usort($items, function ($a, $b) {
    return $a['item']->sortorder <=> $b['item']->sortorder;
});

// Una consulta por ítem (no una por alumno y ítem).
$notas = [];
foreach ($items as $k => $it) {
    foreach (grade_grade::fetch_all(['itemid' => $it['item']->id]) ?: [] as $g) {
        $notas[$k][$g->userid] = $g;
    }
}

$matriz = [array_merge(['Nombre', 'Apellido(s)', 'Correo'], array_column($items, 'nombre'))];
foreach ($users as $u) {
    $fila = [$u->firstname, $u->lastname, $u->email];
    foreach ($items as $k => $it) {
        $g = $notas[$k][$u->id] ?? null;
        $valor = ($g && $g->finalgrade !== null)
            ? grade_format_gradevalue($g->finalgrade, $it['item'], false, GRADE_DISPLAY_TYPE_REAL, 2)
            : null;
        $fila[] = ($valor === null || $valor === '') ? '-' : $valor;
    }
    $matriz[] = $fila;
}

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

header('Content-Type: text/html; charset=utf-8');
echo $html;
