<?php
defined('MOODLE_INTERNAL') || die();

// Sin permisos por defecto: solo los administradores ven la opción hasta que se otorgue a un rol
// (en todo el sitio, o solo en un curso con "Permisos" del curso).
$capabilities = [
    'gradeexport/acta:view' => [
        'captype' => 'read',
        'contextlevel' => CONTEXT_COURSE,
        'archetypes' => [],
    ],
];
