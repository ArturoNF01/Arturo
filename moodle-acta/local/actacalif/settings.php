<?php
defined('MOODLE_INTERNAL') || die();

if ($hassiteconfig) {
    $settings = new admin_settingpage('local_actacalif', get_string('pluginname', 'local_actacalif'));
    $ADMIN->add('localplugins', $settings);
    $settings->add(new admin_setting_configtext('local_actacalif/cursos',
        get_string('cursos', 'local_actacalif'), get_string('cursos_desc', 'local_actacalif'), '', PARAM_SEQUENCE));
}
