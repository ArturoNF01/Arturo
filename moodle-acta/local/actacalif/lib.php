<?php
defined('MOODLE_INTERNAL') || die();

/**
 * Agrega "Generar acta" al menú del curso, solo en los cursos habilitados y para quien puede ver todas las calificaciones.
 * Cualquier error aquí se ignora: este callback corre en todas las páginas de curso y nunca debe romperlas.
 */
function local_actacalif_extend_navigation_course(navigation_node $navigation, stdClass $course, context_course $context) {
    try {
        if (!\local_actacalif\helper::curso_habilitado((int) $course->id)
                || !has_capability('local/actacalif:generate', $context)) {
            return;
        }
        $url = new moodle_url('/local/actacalif/index.php', ['id' => $course->id]);
        $navigation->add(get_string('generar', 'local_actacalif'), $url, navigation_node::TYPE_SETTING,
            null, 'local_actacalif', new pix_icon('i/report', ''));
    } catch (\Throwable $e) {
        debugging($e->getMessage(), DEBUG_DEVELOPER);
    }
}
