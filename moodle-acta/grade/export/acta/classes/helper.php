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
     * Entrega el logo desde este mismo sitio para que el navegador pueda incrustarlo en el PDF
     * sin depender de CORS en home.ciess.org. Si no se puede obtener, responde 404 y el acta sale sin logo.
     */
    public static function enviar_logo(): void {
        global $CFG;
        require_once($CFG->libdir . '/filelib.php');
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
