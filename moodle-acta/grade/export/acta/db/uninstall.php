<?php
defined('MOODLE_INTERNAL') || die();

function xmldb_gradeexport_acta_uninstall() {
    require_once(__DIR__ . '/../locallib.php');
    gradeexport_acta_restaurar_predeterminado();
    return true;
}
