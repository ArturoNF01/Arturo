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
$fuente = optional_param('fuente', '', PARAM_ALPHA);
if ($fuente !== '') {
    \gradeexport_acta\helper::enviar_fuente($fuente);
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
$gui = null;
try {
    $switch = grade_get_setting($courseid, 'aggregationposition', $CFG->grade_aggregationposition);
    $gseq = new grade_seq($courseid, $switch);
    $verocultos = has_capability('moodle/grade:viewhidden', $context);
    $items = [];
    $nombres = [];
    $columnas = [];
    $categorias = $DB->get_records('grade_categories', ['courseid' => $courseid], '', 'id, parent, fullname');
    $grupos = [];
    $indicetotal = null;
    foreach ($gseq->items as $item) {
        if ($item->is_hidden() && !$verocultos) {
            continue;
        }
        if ($item->itemtype === 'mod') {
            $nombre = get_string('modulename', $item->itemmodule) . get_string('labelsep', 'langconfig') . $item->get_name();
        } else {
            $nombre = $item->get_name(true);
        }
        // Cada columna dice a qué categoría (módulo) pertenece: los ítems, a la suya; el total de un módulo, al módulo
        // que totaliza; el total del curso, a ninguna.
        if ($item->itemtype === 'course') {
            // El generador usa esta columna como calificación final aunque el curso fuerce otro idioma
            // (en inglés se llama "Course total", no "Total del curso").
            $indicetotal = 3 + count($items);
            $tipo = 'curso';
            $grupo = null;
        } else if ($item->itemtype === 'category') {
            $tipo = 'categoria';
            $grupo = (int) $item->iteminstance;
        } else {
            $tipo = 'item';
            $grupo = (int) $item->categoryid;
        }
        if ($grupo !== null && !isset($grupos[$grupo])) {
            $cat = $categorias[$grupo] ?? null;
            $raiz = !$cat || $cat->parent === null;
            $grupos[$grupo] = [
                'id' => $grupo,
                'raiz' => $raiz,
                'nombre' => $raiz ? get_string('gruposinmodulo', 'gradeexport_acta')
                    : html_to_text(format_string($cat->fullname, true, ['context' => $context]), 0, false),
            ];
        }
        $items[$item->id] = $item;
        $columnas[] = ['id' => (int) $item->id, 'tipo' => $tipo, 'grupo' => $grupo, 'nombre' => html_to_text($nombre, 0, false)];
        // Igual que grade_export::format_column_name(): texto plano, sin espacios repetidos.
        $nombres[] = html_to_text($nombre . ' (Real)', 0, false);
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
            // Mismo texto que la exportación: "-" si no hay nota, vacío en los ítems sin calificación numérica.
            $fila[] = grade_format_gradevalue($g ? $g->finalgrade : null, $item, false, GRADE_DISPLAY_TYPE_REAL, 2);
        }
        $matriz[] = $fila;
    }
    $gui->close();
} catch (\Throwable $e) {
    if ($gui) {
        $gui->close();
    }
    \gradeexport_acta\helper::responder_error($e);
}

$datos = [
    'curso' => format_string($course->fullname, true, ['context' => $context, 'escape' => false]),
    'docente' => \gradeexport_acta\helper::docente($context),
    'total' => $indicetotal,
    'columnas' => $columnas,
    'grupos' => array_values($grupos),
    'matriz' => $matriz,
];
$logourl = (new moodle_url('/grade/export/acta/generador.php', ['id' => $courseid, 'logo' => 1]))->out(false);
$fuentes = [
    'normal' => (new moodle_url('/grade/export/acta/generador.php', ['id' => $courseid, 'fuente' => 'normal']))->out(false),
    'negrita' => (new moodle_url('/grade/export/acta/generador.php', ['id' => $courseid, 'fuente' => 'negrita']))->out(false),
];

$html = file_get_contents(__DIR__ . '/templates/generador.html');
// Modo directo: la interfaz del generador queda oculta; index.php maneja el botón y la descarga.
$inyeccion = '<style>#acta-app{display:none!important}</style>'
    . '<script>window.ACTA_DIRECTO = true;window.ACTA_DATOS = ' . json_encode($datos, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE) . ';'
    . 'window.ACTA_LOGO_URL = ' . json_encode($logourl, JSON_HEX_TAG | JSON_HEX_AMP) . ';'
    . 'window.ACTA_FUENTES = ' . json_encode($fuentes, JSON_HEX_TAG | JSON_HEX_AMP) . ';</script>';
$html = str_replace('<body>', '<body>' . $inyeccion, $html);
// La lectura de CSV/XLSX no se usa en modo directo: no se carga la librería XLSX (900 KB de terceros en el sitio).
$html = preg_replace('#<script src="[^"]*xlsx[^"]*"></script>#i', '', $html);

header('Content-Type: text/html; charset=utf-8');
echo $html;
