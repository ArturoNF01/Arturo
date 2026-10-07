<?php
// Funciones internas del plugin (las usan db/install.php, db/upgrade.php y db/uninstall.php).
defined('MOODLE_INTERNAL') || die();

/**
 * Hace que "Exportar" abra el acta: pone "Acta de calificaciones" como método de exportación por defecto
 * (Administración > Calificaciones > Ajustes generales). Guarda el valor anterior para devolverlo al desinstalar.
 * Solo cambia el destino de /grade/export/index.php para quien tiene el permiso del acta; los demás siguen
 * abriendo el primer método que sí pueden usar (Moodle ignora un método por defecto que el usuario no tiene).
 */
function gradeexport_acta_predeterminar(): void {
    $actual = get_config('core', 'gradeexport_default');
    if ($actual === 'acta') {
        return;
    }
    set_config('exportpredeterminado_previo', $actual === false ? '' : (string) $actual, 'gradeexport_acta');
    set_config('gradeexport_default', 'acta');
    gradeexport_acta_registrar_cambio($actual === false ? null : (string) $actual, 'acta');
}

/**
 * Deja el cambio en Administración > Informes > Cambios de configuración (set_config no lo registra por sí solo).
 * Nunca aborta la instalación ni la desinstalación.
 */
function gradeexport_acta_registrar_cambio(?string $anterior, ?string $nuevo): void {
    try {
        add_to_config_log('gradeexport_default', $anterior, $nuevo, null);
    } catch (\Throwable $e) {
        debugging('gradeexport_acta: no se pudo registrar el cambio de configuración: ' . $e->getMessage(), DEBUG_DEVELOPER);
    }
}

/**
 * Devuelve el método de exportación por defecto que había antes de instalar el plugin.
 * Si el administrador ya eligió otro mientras tanto, no se toca.
 */
function gradeexport_acta_restaurar_predeterminado(): void {
    if (get_config('core', 'gradeexport_default') !== 'acta') {
        return;
    }
    $previo = get_config('gradeexport_acta', 'exportpredeterminado_previo');
    if ($previo === false || $previo === '') {
        unset_config('gradeexport_default');
        gradeexport_acta_registrar_cambio('acta', null);
    } else {
        set_config('gradeexport_default', $previo);
        gradeexport_acta_registrar_cambio('acta', (string) $previo);
    }
}

/**
 * Roles del campus del CIESS (nombre corto) a los que el plugin otorga el permiso al instalarse o actualizarse.
 */
function gradeexport_acta_roles_docentes(): array {
    return ['docente', 'docente_modulo'];
}

/**
 * Otorga gradeexport/acta:view (en todo el sitio) a los roles Docente y Docente de Módulo, si existen y si el
 * administrador no les puso ya un valor propio (permitir, prevenir o prohibir). Nunca aborta la instalación:
 * si algo falla, el permiso se da a mano en Definir roles. Devuelve los nombres cortos de los roles que recibieron el permiso.
 */
function gradeexport_acta_otorgar_permiso(): array {
    global $DB;
    $otorgados = [];
    try {
        // En una instalación nueva Moodle registra las capacidades después de install.php; aquí se adelanta (es idempotente).
        update_capabilities('gradeexport_acta');
        $contexto = \context_system::instance();
        foreach (gradeexport_acta_roles_docentes() as $corto) {
            $rol = $DB->get_record('role', ['shortname' => $corto], 'id');
            if (!$rol) {
                continue;
            }
            $propio = $DB->record_exists('role_capabilities', ['roleid' => $rol->id, 'capability' => 'gradeexport/acta:view', 'contextid' => $contexto->id]);
            if ($propio) {
                continue;
            }
            assign_capability('gradeexport/acta:view', CAP_ALLOW, $rol->id, $contexto->id);
            $otorgados[] = $corto;
        }
    } catch (\Throwable $e) {
        debugging('gradeexport_acta: no se pudo otorgar el permiso automáticamente: ' . $e->getMessage(), DEBUG_DEVELOPER);
    }
    return $otorgados;
}
