<?php
namespace local_actacalif;

defined('MOODLE_INTERNAL') || die();

class helper {
    const LOGO_URL = 'https://home.ciess.org/wp-content/uploads/2026/01/LOGO-CIESS-PR-C.png';

    /**
     * El plugin solo actúa en los cursos listados en el ajuste "cursos" (ids separados por comas).
     * Vacío = deshabilitado en todos los cursos.
     */
    public static function curso_habilitado(int $courseid): bool {
        $ids = array_filter(array_map('trim', explode(',', (string) get_config('local_actacalif', 'cursos'))));
        return in_array((string) $courseid, $ids, true);
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
