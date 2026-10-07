<?php
defined('MOODLE_INTERNAL') || die();

function xmldb_gradeexport_acta_install() {
    require_once(__DIR__ . '/../locallib.php');
    gradeexport_acta_predeterminar();
    gradeexport_acta_otorgar_permiso();
    return true;
}
