// Lógica de la pantalla "Calificaciones > Exportar > Acta de calificaciones" (la carga index.php).
// El generador corre en un iframe oculto (window.ActaDirecto); aquí se arma la selección de ítems/módulos,
// se recibe el PDF y se descarga. Los textos vienen de index.php en window.ACTA_CFG.t.
(function () {
  var cfg = window.ACTA_CFG;
  var T = cfg.t;
  var frame = document.getElementById('acta-frame');
  var btn = document.getElementById('acta-descargar');
  var estado = document.getElementById('acta-estado');
  var firmaInput = document.getElementById('acta-firma');
  var panel = document.getElementById('acta-seleccion');
  var contenedor = document.getElementById('acta-grupos');
  var conteo = document.getElementById('acta-conteo');
  var nota = document.getElementById('acta-sugerido');
  var firma = null;
  var listo = false;      // el generador cargó y hay estudiantes: se puede descargar
  var ocupado = false;    // generando el PDF
  var columnas = [];      // ítems que se ofrecen (sin los que el generador siempre omite)
  var marcados = {};      // id de ítem -> true
  var cajas = {};         // id de ítem -> <input>
  var grupos = [];        // { clave, caja, ids }

  function crear(tag, attrs, texto) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (texto !== undefined && texto !== null) e.textContent = texto;
    return e;
  }
  function mensaje(texto, tipo, extra) {
    estado.className = 'alert alert-' + tipo + ' mt-3 mb-0';
    estado.textContent = '';
    [texto].concat(extra || []).forEach(function (linea) {
      estado.appendChild(crear('div', {}, linea));
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
        if (t >= ms) return no(new Error(T.noframe));
        setTimeout(sondear, 100);
      })();
    });
  }

  // ---- Selección de ítems (agrupados por módulo, como las categorías del libro de calificaciones) ----
  function totalMarcados() {
    return columnas.filter(function (c) { return marcados[c.id]; }).length;
  }
  function refrescar() {
    grupos.forEach(function (g) {
      var n = g.ids.filter(function (id) { return marcados[id]; }).length;
      g.caja.checked = n === g.ids.length;
      g.caja.indeterminate = n > 0 && n < g.ids.length;
    });
    var sel = totalMarcados();
    conteo.textContent = T.conteo.replace('{$a->sel}', sel).replace('{$a->total}', columnas.length);
    conteo.className = 'ms-3 ' + (sel ? 'text-body-secondary' : 'text-danger');
    if (!sel && columnas.length) conteo.textContent += ' · ' + T.sinseleccion;
    btn.disabled = ocupado || !listo || (columnas.length > 0 && sel === 0);
  }
  function ponerTodos(valor, ids) {
    ids.forEach(function (id) { marcados[id] = valor; cajas[id].checked = valor; });
    refrescar();
  }
  function bloque(titulo, cols, clave) {
    var caja = crear('div', { 'class': 'border rounded mb-2', role: 'group', 'aria-labelledby': 'acta-g-' + clave + '-label' });
    var cab = crear('div', { 'class': 'form-check px-3 py-2 m-0 bg-light border-bottom d-flex align-items-center' });
    var gcaja = crear('input', { type: 'checkbox', 'class': 'form-check-input m-0 me-2', id: 'acta-g-' + clave });
    cab.appendChild(gcaja);
    cab.appendChild(crear('label', { 'class': 'form-check-label fw-bold', id: 'acta-g-' + clave + '-label', 'for': 'acta-g-' + clave }, titulo));
    caja.appendChild(cab);
    var cuerpo = crear('div', { 'class': 'px-3 py-2', style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:.25rem 1.5rem' });
    var ids = [];
    cols.forEach(function (c) {
      var fila = crear('div', { 'class': 'form-check m-0' });
      var i = crear('input', { type: 'checkbox', 'class': 'form-check-input', id: 'acta-i-' + c.id });
      i.addEventListener('change', function () { marcados[c.id] = i.checked; refrescar(); });
      cajas[c.id] = i;
      ids.push(c.id);
      fila.appendChild(i);
      fila.appendChild(crear('label', { 'class': 'form-check-label', 'for': 'acta-i-' + c.id }, c.nombre));
      cuerpo.appendChild(fila);
    });
    gcaja.addEventListener('change', function () { ponerTodos(gcaja.checked, ids); });
    caja.appendChild(cuerpo);
    grupos.push({ clave: clave, caja: gcaja, ids: ids });
    return caja;
  }
  function construirSeleccion(info, sugerencia) {
    columnas = info.columnas.filter(function (c) { return !c.omitida; });
    if (!columnas.length) return;
    var nombres = {};
    info.grupos.forEach(function (g) { nombres[String(g.id)] = g.nombre; });
    var orden = [], porGrupo = {}, deCurso = [];
    columnas.forEach(function (c) {
      if (c.tipo === 'curso' || c.grupo === null) { deCurso.push(c); return; }
      var k = String(c.grupo);
      if (!porGrupo[k]) { porGrupo[k] = []; orden.push(k); }
      porGrupo[k].push(c);
    });
    contenedor.textContent = '';
    orden.forEach(function (k) { contenedor.appendChild(bloque(nombres[k] || '', porGrupo[k], k)); });
    if (deCurso.length) contenedor.appendChild(bloque(T.grupocurso, deCurso, 'curso'));
    // Sin sugerencia, todo marcado. Con sugerencia del catálogo, solo el módulo (o módulos) del docente.
    var sugeridos = sugerencia && sugerencia.grupos ? sugerencia.grupos.map(String) : null;
    columnas.forEach(function (c) {
      var marcar = sugeridos ? (c.grupo !== null && sugeridos.indexOf(String(c.grupo)) !== -1) : true;
      marcados[c.id] = marcar;
      cajas[c.id].checked = marcar;
    });
    if (sugeridos) {
      nota.textContent = T.sugerido.replace('{$a}', function () { return sugerencia.textos.join(', '); });
      nota.hidden = false;
    }
    panel.hidden = false;
    refrescar();
  }
  document.getElementById('acta-todo').addEventListener('click', function () { ponerTodos(true, columnas.map(function (c) { return c.id; })); });
  document.getElementById('acta-nada').addEventListener('click', function () { ponerTodos(false, columnas.map(function (c) { return c.id; })); });

  firmaInput.addEventListener('change', function () {
    var f = this.files && this.files[0];
    firma = null;
    if (!f) return;
    if (!/^image\/(png|jpeg)$/.test(f.type)) {
      this.value = '';
      mensaje(T.firmainvalida, 'warning');
      return;
    }
    var lector = new FileReader();
    lector.onload = function (e) { firma = e.target.result; };
    lector.readAsDataURL(f);
  });

  // Se habilita cuando el generador terminó de cargar (librería de PDF, logo y catálogo).
  esperarApi(60000).then(function (a) {
    return a.preparar().then(function (r) {
      btn.textContent = T.descargar;
      document.getElementById('acta-estudiantes').textContent = r.estudiantes;
      if (!r.estudiantes) {
        mensaje(T.sinestudiantes, 'warning');
        return;
      }
      try {
        construirSeleccion(a.info(), a.sugerir());
      } catch (e) {
        if (window.console) console.warn('Selección de ítems:', e);   // sin selección se genera el acta completa, como antes
      }
      if (!r.pdf) {
        mensaje(T.sinlibreria, 'danger');
        return;
      }
      listo = true;
      refrescar();
    });
  }).catch(function (e) {
    btn.textContent = T.descargar;
    document.getElementById('acta-estudiantes').textContent = '–';
    mensaje(T.error + ' ' + e.message, 'danger');
  });

  btn.addEventListener('click', function () {
    if (ocupado) return;
    ocupado = true;
    refrescar();
    mensaje(T.generando, 'info');
    var ids = columnas.length ? columnas.filter(function (c) { return marcados[c.id]; }).map(function (c) { return c.id; }) : undefined;
    esperarApi(5000).then(function (a) { return a.generar({ firma: firma, columnas: ids }); }).then(function (r) {
      var url = URL.createObjectURL(r.blob);
      var enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = r.nombre;
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      var avisos = [];
      if (!r.logo) avisos.push(T.sinlogo);
      var notas = r.modulo ? [] : [T.sinmodulo];
      mensaje(T.listo.replace('{$a}', function () { return r.nombre; }), avisos.length ? 'warning' : 'success', avisos.concat(notas));
    }).catch(function (e) {
      mensaje(T.error + ' ' + (e && e.message ? e.message : ''), 'danger');
    }).then(function () {
      ocupado = false;
      refrescar();
      btn.focus();
    });
  });
})();
