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
require_capability('moodle/grade:viewall', $context);   // el generador (generador.php) exige las mismas tres capacidades
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
// Firma del docente: mismo bloque (encabezado en negritas) que los módulos, con vista previa de cómo queda al pie del acta.
echo '<div id="acta-firma-bloque" class="border rounded mt-4" role="group" aria-labelledby="acta-firma-titulo acta-firma-opc">'
    . '<div class="px-3 py-2 m-0 bg-light border-bottom d-flex align-items-baseline flex-wrap">'
    . '<span id="acta-firma-titulo" class="fw-bold">' . s(get_string('firma', 'gradeexport_acta')) . '</span>'
    . '<span id="acta-firma-opc" class="ms-2 small text-body-secondary">' . s(get_string('firmaopcional', 'gradeexport_acta')) . '</span></div>'
    . '<div class="px-3 py-3">'
    . '<label for="acta-firma" class="visually-hidden">' . s(get_string('firma', 'gradeexport_acta') . ' ' . get_string('firmaopcional', 'gradeexport_acta')) . '</label>'
    . '<div id="acta-firma-ayuda" class="small text-body-secondary mb-1">' . s(get_string('ayudafirma', 'gradeexport_acta')) . '</div>'
    . '<input type="file" id="acta-firma" class="form-control" accept="image/png,image/jpeg" aria-describedby="acta-firma-ayuda">'
    . '<span id="acta-firma-estado" class="visually-hidden" role="status"></span>'
    . '<div id="acta-firma-vista" class="mt-3" hidden>'
    . '<div class="small fw-bold mb-1">' . s(get_string('firmavista', 'gradeexport_acta')) . '</div>'
    . '<div class="border rounded text-center px-4 pt-3 pb-2" style="background:#fff;color:#000;max-width:340px">'
    . '<div class="d-flex justify-content-center align-items-end" style="min-height:64px">'
    . '<img id="acta-firma-img" alt="' . s(get_string('firmaalt', 'gradeexport_acta')) . '" style="max-width:min(240px,100%);max-height:88px"></div>'
    . '<div style="border-top:1px solid #c6ac6f;margin:2px 12% 7px"></div>'
    . '<div class="fw-bold small" style="color:#002269">Firma</div>'
    . '<div id="acta-firma-nombre" class="small" style="color:#002269"></div></div>'
    . '<button type="button" id="acta-firma-quitar" class="btn btn-link p-0 mt-2">' . s(get_string('firmaquitar', 'gradeexport_acta')) . '</button>'
    . '</div></div></div>';
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
    'firmanoleida' => get_string('firmanoleida', 'gradeexport_acta'),
    'firmailegible' => get_string('firmailegible', 'gradeexport_acta'),
    'firmacargada' => get_string('firmacargada', 'gradeexport_acta'),
    'firmaquitada' => get_string('firmaquitada', 'gradeexport_acta'),
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
$cfg = json_encode(['t' => $textos, 'docente' => $docente],
    JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
echo html_writer::script('window.ACTA_CFG = ' . $cfg . ';' . file_get_contents(__DIR__ . '/templates/panel.js'));
echo $OUTPUT->footer();
