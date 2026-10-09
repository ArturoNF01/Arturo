<?php
defined('MOODLE_INTERNAL') || die();

function xmldb_gradeexport_acta_upgrade($oldversion) {
    if ($oldversion < 2026100506) {
        // 0.4.0: "Exportar" abre directo el acta (método de exportación por defecto) y Docente / Docente de Módulo reciben el permiso.
        require_once(__DIR__ . '/../locallib.php');
        gradeexport_acta_predeterminar();
        gradeexport_acta_otorgar_permiso();
        upgrade_plugin_savepoint(true, 2026100506, 'gradeexport', 'acta');
    }
    if ($oldversion < 2026100507) {
        // 0.4.1: el acta usa la plantilla institucional (tipografía Work Sans en fonts/); no hay cambios en la base de datos.
        upgrade_plugin_savepoint(true, 2026100507, 'gradeexport', 'acta');
    }
    return true;
}
