<?php
namespace gradeexport_acta;

defined('MOODLE_INTERNAL') || die();

class helper {
    const LOGO_URL = 'https://home.ciess.org/wp-content/uploads/2026/01/LOGO-CIESS-PR-C.png';

    /**
     * Docente que firma el acta: quien inició sesión si es parte del curso; si es personal de coordinación o
     * administración (no inscrito) y el curso tiene un único profesor, ese profesor; si no, quien inició sesión.
     */
    public static function docente(\context_course $context): string {
        global $DB, $USER;
        $nombre = function ($u) {
            return trim($u->firstname . ' ' . $u->lastname);
        };
        try {
            if (is_enrolled($context, $USER, '', true)) {
                return $nombre($USER);
            }
            $rolid = $DB->get_field('role', 'id', ['shortname' => 'editingteacher']);
            if ($rolid) {
                $profes = get_role_users($rolid, $context, false, 'u.id, u.firstname, u.lastname', 'u.lastname, u.firstname');
                // Solo profesores con inscripción activa (no suspendidos ni de otro rol heredado).
                $profes = array_filter($profes, function ($p) use ($context) {
                    return is_enrolled($context, $p->id, '', true);
                });
                if (count($profes) === 1) {
                    return $nombre(reset($profes));
                }
            }
        } catch (\Throwable $e) {
            debugging($e->getMessage(), DEBUG_DEVELOPER);
        }
        return $nombre($USER);
    }

    /**
     * Grupo cuyos alumnos se incluyen en el acta (0 = todos). Con grupos separados, quien no puede ver todos los
     * grupos (moodle/site:accessallgroups) solo obtiene los de su grupo; si no pertenece a ninguno se le niega el acta
     * en lugar de entregarle todo el curso.
     */
    public static function grupo(\stdClass $course, \context_course $context): int {
        global $USER;
        $groupid = (int) groups_get_course_group($course, true);
        if (groups_get_course_groupmode($course) == SEPARATEGROUPS
                && !has_capability('moodle/site:accessallgroups', $context)
                && (!$groupid || !groups_is_member($groupid, $USER->id))) {
            throw new \moodle_exception('singrupo', 'gradeexport_acta');
        }
        return $groupid;
    }

    /**
     * Entrega el logo desde este mismo sitio para que el navegador pueda incrustarlo en el PDF
     * sin depender de CORS en home.ciess.org. Si no se puede obtener, responde 404 y el acta sale sin logo.
     */
    public static function enviar_logo(): void {
        global $CFG;
        require_once($CFG->libdir . '/filelib.php');
        // Libera el bloqueo de la sesión: si home.ciess.org tarda, el docente no debe quedar bloqueado en sus otras pestañas.
        \core\session\manager::write_close();
        $c = new \curl();
        $png = $c->get(self::LOGO_URL, null, ['CURLOPT_TIMEOUT' => 10, 'CURLOPT_CONNECTTIMEOUT' => 5]);
        $info = $c->get_info();
        if ($c->get_errno() || (int) ($info['http_code'] ?? 0) !== 200 || !is_string($png) || strncmp($png, "\x89PNG", 4) !== 0) {
            http_response_code(404);
            die();
        }
        header('Content-Type: image/png');
        header('Cache-Control: private, max-age=86400');
        echo $png;
        die();
    }
}
