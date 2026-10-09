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

    /**
     * Entrega una de las dos tipografías de la plantilla del acta (Work Sans, licencia OFL) para incrustarla en el PDF.
     * Solo existen estos dos archivos; cualquier otro nombre responde 404.
     */
    public static function enviar_fuente(string $nombre): void {
        $archivos = ['normal' => 'WorkSans-Regular.ttf', 'negrita' => 'WorkSans-Bold.ttf'];
        $ruta = isset($archivos[$nombre]) ? __DIR__ . '/../fonts/' . $archivos[$nombre] : null;
        if (!$ruta || !is_readable($ruta)) {
            http_response_code(404);
            die();
        }
        \core\session\manager::write_close();
        header('Content-Type: font/ttf');
        header('Content-Length: ' . filesize($ruta));
        header('Cache-Control: private, max-age=86400');
        readfile($ruta);
        die();
    }

    /**
     * Si no se pueden leer las calificaciones, responde de inmediato (con un mensaje claro) en lugar de dejar la
     * página esperando: reemplaza al generador por un stub cuyas funciones rechazan con ese mensaje.
     */
    public static function responder_error(\Throwable $e): void {
        error_log('gradeexport_acta: ' . get_class($e) . ': ' . $e->getMessage());
        $recalculo = $e instanceof \moodle_exception && $e->errorcode === 'gradesneedregrading';
        $mensaje = get_string($recalculo ? 'errorrecalculo' : 'errorlectura', 'gradeexport_acta');
        $js = json_encode($mensaje, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE);
        header('Content-Type: text/html; charset=utf-8');
        echo '<!DOCTYPE html><meta charset="utf-8"><title>-</title><script>(function(){var m=' . $js . ';'
            . 'function no(){return Promise.reject(new Error(m));}'
            . 'window.ActaDirecto={preparar:no,generar:no};})();</script>';
        die();
    }
}
