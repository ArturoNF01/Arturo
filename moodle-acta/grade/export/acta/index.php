<?php
// Pantalla "Calificaciones > Exportar > Acta de calificaciones": marco de Moodle + generador dentro de un iframe
// (el iframe evita que las librerías de PDF choquen con requirejs de Moodle).
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/grade/lib.php');

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

$src = new moodle_url('/grade/export/acta/generador.php', ['id' => $id]);
echo html_writer::tag('iframe', '', [
    'id' => 'acta-frame',
    'src' => $src->out(false),
    'title' => $titulo,
    'style' => 'width:100%;height:900px;border:0;display:block;overflow:hidden',
]);
echo html_writer::script("(function(){var f=document.getElementById('acta-frame');"
    . "function fit(){try{var d=f.contentDocument;if(d&&d.documentElement){"
    . "f.style.height=Math.max(700,d.documentElement.scrollHeight)+'px';}}catch(e){}}"
    . "f.addEventListener('load',fit);setInterval(fit,500);})();");
echo $OUTPUT->footer();
