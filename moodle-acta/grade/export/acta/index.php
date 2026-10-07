<?php
// Pantalla "Calificaciones > Exportar > Acta de calificaciones": un solo botón, "Descargar", que baja el acta en PDF
// con el curso y el docente de Moodle. El generador corre en un iframe oculto (evita que las librerías de PDF
// choquen con requirejs de Moodle) y esta página solo recibe el archivo y lo descarga.
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/grade/lib.php');
require_once($CFG->libdir . '/grouplib.php');

$id = required_param('id', PARAM_INT);
$PAGE->set_url('/grade/export/acta/index.php', ['id' => $id]);
$course = get_course($id);
require_login($course);
$context = context_course::instance($id);
require_capability('moodle/grade:export', $context);
require_capability('gradeexport/acta:view', $context);

$titulo = get_string('pluginname', 'gradeexport_acta');
try {
    $actionbar = new \core_grades\output\export_action_bar($context, null, 'acta');
    print_grade_page_head($id, 'export', 'acta', $titulo, false, false, true, null, null, null, $actionbar);
} catch (\Throwable $e) {
    debugging($e->getMessage(), DEBUG_DEVELOPER);
    if ($PAGE->state < moodle_page::STATE_IN_BODY) {
        $PAGE->set_title($titulo);
        $PAGE->set_heading($course->fullname);
        echo $OUTPUT->header();
        echo $OUTPUT->heading($titulo);
    }
}

try {
    $groupid = \gradeexport_acta\helper::grupo($course, $context);
} catch (\moodle_exception $e) {
    echo $OUTPUT->notification($e->getMessage(), \core\output\notification::NOTIFY_WARNING);
    echo $OUTPUT->footer();
    die();
}
$docente = \gradeexport_acta\helper::docente($context);
try {
    $fecha = userdate(time(), get_string('strftimedate', 'langconfig'));
} catch (\Throwable $e) {
    $fecha = date('d/m/Y');
}
$curso = format_string($course->fullname, true, ['context' => $context, 'escape' => false]);

$filas = [
    get_string('resumen_curso', 'gradeexport_acta') => s($curso),
    get_string('resumen_docente', 'gradeexport_acta') => s($docente),
    get_string('resumen_fecha', 'gradeexport_acta') => s($fecha),
    get_string('resumen_estudiantes', 'gradeexport_acta') => html_writer::span('…', '', ['id' => 'acta-estudiantes']),
];
if ($groupid) {
    $filas[get_string('resumen_grupo', 'gradeexport_acta')] = s(groups_get_group_name($groupid));
}
echo '<div class="card"><div class="card-body">';
echo html_writer::tag('p', s(get_string('intro', 'gradeexport_acta')));
echo '<dl class="row mb-0">';
foreach ($filas as $etiqueta => $valor) {
    echo html_writer::tag('dt', s($etiqueta), ['class' => 'col-sm-3']);
    echo html_writer::tag('dd', $valor, ['class' => 'col-sm-9']);
}
echo '</dl>';
echo '<fieldset id="acta-seleccion" class="mt-4" hidden>'
    . '<legend class="h6 fw-bold mb-1">' . s(get_string('seleccion', 'gradeexport_acta')) . '</legend>'
    . '<p class="text-body-secondary small mb-2">' . s(get_string('ayudaseleccion', 'gradeexport_acta')) . '</p>'
    . '<p id="acta-sugerido" class="alert alert-info py-2" hidden></p>'
    . '<div class="mb-2"><button type="button" id="acta-todo" class="btn btn-link p-0 me-3">'
    . s(get_string('seleccionartodo', 'gradeexport_acta')) . '</button>'
    . '<button type="button" id="acta-nada" class="btn btn-link p-0">' . s(get_string('seleccionarnada', 'gradeexport_acta')) . '</button>'
    . '<span id="acta-conteo" class="ms-3 text-body-secondary" aria-live="polite"></span></div>'
    . '<div id="acta-grupos"></div></fieldset>';
echo '<div class="mt-3"><label for="acta-firma" class="d-block">' . s(get_string('firma', 'gradeexport_acta')) . '</label>'
    . '<input type="file" id="acta-firma" accept="image/png,image/jpeg"></div>';
echo '<div class="mt-4"><button type="button" id="acta-descargar" class="btn btn-primary" disabled>'
    . s(get_string('preparando', 'gradeexport_acta')) . '</button></div>';
echo '<div id="acta-estado" role="status" aria-live="polite"></div>';
echo '</div></div>';

$src = new moodle_url('/grade/export/acta/generador.php', ['id' => $id]);
echo html_writer::tag('iframe', '', [
    'id' => 'acta-frame',
    'src' => $src->out(false),
    'title' => $titulo,
    'tabindex' => '-1',
    'aria-hidden' => 'true',
    'style' => 'position:absolute;width:0;height:0;border:0;visibility:hidden',
]);

$textos = [
    'descargar' => get_string('descargar', 'gradeexport_acta'),
    'generando' => get_string('generando', 'gradeexport_acta'),
    'listo' => get_string('listo', 'gradeexport_acta'),
    'error' => get_string('error', 'gradeexport_acta'),
    'firmainvalida' => get_string('firmainvalida', 'gradeexport_acta'),
    'sinestudiantes' => get_string('sinestudiantes', 'gradeexport_acta'),
    'noframe' => get_string('noframe', 'gradeexport_acta'),
    'sinlibreria' => get_string('sinlibreria', 'gradeexport_acta'),
    'sinlogo' => get_string('sinlogo', 'gradeexport_acta'),
    'sinmodulo' => get_string('sinmodulo', 'gradeexport_acta'),
    'conteo' => get_string('conteo', 'gradeexport_acta'),
    'sinseleccion' => get_string('sinseleccion', 'gradeexport_acta'),
    'grupocurso' => get_string('grupocurso', 'gradeexport_acta'),
    'sugerido' => get_string('sugerido', 'gradeexport_acta'),
];
$cfg = json_encode(['t' => $textos], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE);
echo html_writer::script('window.ACTA_CFG = ' . $cfg . ';' . file_get_contents(__DIR__ . '/templates/panel.js'));
echo $OUTPUT->footer();
