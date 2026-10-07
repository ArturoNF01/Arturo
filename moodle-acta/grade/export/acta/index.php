<?php
// Pantalla "Calificaciones > Exportar > Acta de calificaciones": un solo botón, "Descargar", que baja el acta en PDF
// con el curso y el docente de Moodle. El generador corre en un iframe oculto (evita que las librerías de PDF
// choquen con requirejs de Moodle) y esta página solo recibe el archivo y lo descarga.
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/grade/lib.php');
require_once($CFG->libdir . '/grouplib.php');

$id = required_param('id', PARAM_INT);
$PAGE->set_url('/grade/export/acta/index.php', ['id' => $id]);
$course = get_course($id);
require_login($course);
$context = context_course::instance($id);
require_capability('moodle/grade:export', $context);
require_capability('gradeexport/acta:view', $context);

$titulo = get_string('pluginname', 'gradeexport_acta');
try {
    $actionbar = new \core_grades\output\export_action_bar($context, null, 'acta');
    print_grade_page_head($id, 'export', 'acta', $titulo, false, false, true, null, null, null, $actionbar);
} catch (\Throwable $e) {
    debugging($e->getMessage(), DEBUG_DEVELOPER);
    if ($PAGE->state < moodle_page::STATE_IN_BODY) {
        $PAGE->set_title($titulo);
        $PAGE->set_heading($course->fullname);
        echo $OUTPUT->header();
        echo $OUTPUT->heading($titulo);
    }
}

try {
    $groupid = \gradeexport_acta\helper::grupo($course, $context);
} catch (\moodle_exception $e) {
    echo $OUTPUT->notification($e->getMessage(), \core\output\notification::NOTIFY_WARNING);
    echo $OUTPUT->footer();
    die();
}
$docente = \gradeexport_acta\helper::docente($context);
try {
    $fecha = userdate(time(), get_string('strftimedate', 'langconfig'));
} catch (\Throwable $e) {
    $fecha = date('d/m/Y');
}
$curso = format_string($course->fullname, true, ['context' => $context, 'escape' => false]);

$filas = [
    get_string('resumen_curso', 'gradeexport_acta') => s($curso),
    get_string('resumen_docente', 'gradeexport_acta') => s($docente),
    get_string('resumen_fecha', 'gradeexport_acta') => s($fecha),
    get_string('resumen_estudiantes', 'gradeexport_acta') => html_writer::span('…', '', ['id' => 'acta-estudiantes']),
];
if ($groupid) {
    $filas[get_string('resumen_grupo', 'gradeexport_acta')] = s(groups_get_group_name($groupid));
}
echo '<div class="card"><div class="card-body">';
echo html_writer::tag('p', s(get_string('intro', 'gradeexport_acta')));
echo '<dl class="row mb-0">';
foreach ($filas as $etiqueta => $valor) {
    echo html_writer::tag('dt', s($etiqueta), ['class' => 'col-sm-3']);
    echo html_writer::tag('dd', $valor, ['class' => 'col-sm-9']);
}
echo '</dl>';
echo '<div class="mt-3"><label for="acta-firma" class="d-block">' . s(get_string('firma', 'gradeexport_acta')) . '</label>'
    . '<input type="file" id="acta-firma" accept="image/png,image/jpeg"></div>';
echo '<div class="mt-4"><button type="button" id="acta-descargar" class="btn btn-primary" disabled>'
    . s(get_string('preparando', 'gradeexport_acta')) . '</button></div>';
echo '<div id="acta-estado" role="status" aria-live="polite"></div>';
echo '</div></div>';

$src = new moodle_url('/grade/export/acta/generador.php', ['id' => $id]);
echo html_writer::tag('iframe', '', [
    'id' => 'acta-frame',
    'src' => $src->out(false),
    'title' => $titulo,
    'tabindex' => '-1',
    'aria-hidden' => 'true',
    'style' => 'position:absolute;width:0;height:0;border:0;visibility:hidden',
]);

$textos = [
    'descargar' => get_string('descargar', 'gradeexport_acta'),
    'generando' => get_string('generando', 'gradeexport_acta'),
    'listo' => get_string('listo', 'gradeexport_acta'),
    'error' => get_string('error', 'gradeexport_acta'),
    'firmainvalida' => get_string('firmainvalida', 'gradeexport_acta'),
    'sinestudiantes' => get_string('sinestudiantes', 'gradeexport_acta'),
    'noframe' => get_string('noframe', 'gradeexport_acta'),
    'sinlibreria' => get_string('sinlibreria', 'gradeexport_acta'),
    'sinlogo' => get_string('sinlogo', 'gradeexport_acta'),
    'sinmodulo' => get_string('sinmodulo', 'gradeexport_acta'),
];
$cfg = json_encode(['t' => $textos], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE);
echo html_writer::script(<<<JS
(function () {
  var cfg = $cfg;
  var frame = document.getElementById('acta-frame');
  var btn = document.getElementById('acta-descargar');
  var estado = document.getElementById('acta-estado');
  var firmaInput = document.getElementById('acta-firma');
  var firma = null;

  function mensaje(texto, tipo, avisos) {
    estado.className = 'alert alert-' + tipo + ' mt-3 mb-0';
    estado.textContent = '';
    [texto].concat(avisos || []).forEach(function (linea) {
      var p = document.createElement('div');
      p.textContent = linea;
      estado.appendChild(p);
    });
  }
  function api() {
    var w = frame.contentWindow;
    return w && w.ActaDirecto ? w.ActaDirecto : null;
  }
  function esperarApi(ms) {
    return new Promise(function (ok, no) {
      var t = 0;
      (function sondear() {
        var a = api();
        if (a) return ok(a);
        t += 100;
        if (t >= ms) return no(new Error(cfg.t.noframe));
        setTimeout(sondear, 100);
      })();
    });
  }

  firmaInput.addEventListener('change', function () {
    var f = this.files && this.files[0];
    firma = null;
    if (!f) return;
    if (!/^image\/(png|jpeg)$/.test(f.type)) {
      this.value = '';
      mensaje(cfg.t.firmainvalida, 'warning');
      return;
    }
    var lector = new FileReader();
    lector.onload = function (e) { firma = e.target.result; };
    lector.readAsDataURL(f);
  });

  // Se habilita cuando el generador terminó de cargar (librería de PDF, logo y catálogo).
  esperarApi(60000).then(function (a) { return a.preparar(); }).then(function (r) {
    btn.textContent = cfg.t.descargar;
    document.getElementById('acta-estudiantes').textContent = r.estudiantes;
    if (!r.estudiantes) {
      mensaje(cfg.t.sinestudiantes, 'warning');
      return;
    }
    if (!r.pdf) {
      mensaje(cfg.t.sinlibreria, 'danger');
      return;
    }
    btn.disabled = false;
  }).catch(function (e) {
    btn.textContent = cfg.t.descargar;
    document.getElementById('acta-estudiantes').textContent = '–';
    mensaje(cfg.t.error + ' ' + e.message, 'danger');
  });

  var ocupado = false;
  btn.addEventListener('click', function () {
    if (ocupado) return;
    ocupado = true;
    btn.disabled = true;
    mensaje(cfg.t.generando, 'info');
    esperarApi(5000).then(function (a) { return a.generar({ firma: firma }); }).then(function (r) {
      var url = URL.createObjectURL(r.blob);
      var enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = r.nombre;
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      var avisos = [];
      if (!r.logo) avisos.push(cfg.t.sinlogo);
      if (!r.modulo) avisos.push(cfg.t.sinmodulo);
      mensaje(cfg.t.listo.replace('{\$a}', function () { return r.nombre; }), avisos.length ? 'warning' : 'success', avisos);
    }).catch(function (e) {
      mensaje(cfg.t.error + ' ' + (e && e.message ? e.message : ''), 'danger');
    }).then(function () {
      ocupado = false;
      btn.disabled = false;
      btn.focus();
    });
  });
})();
JS
);
echo $OUTPUT->footer();
