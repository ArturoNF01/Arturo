<?php
defined('MOODLE_INTERNAL') || die();

$capabilities = [
    'local/actacalif:generate' => [
        'captype' => 'read',
        'contextlevel' => CONTEXT_COURSE,
        'archetypes' => ['editingteacher' => CAP_ALLOW, 'manager' => CAP_ALLOW],
        'clonepermissionsfrom' => 'moodle/grade:viewall',
    ],
];
