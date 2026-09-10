/* Lógica de la vista previa: puerta de acceso, formulario y panel.
   Las reglas del dictamen, de los estados y de los recordatorios llegan
   incrustadas desde los módulos del proyecto: aquí sólo se dibujan. */
(function () {
  'use strict';

  var D = JSON.parse(document.getElementById('datos').textContent);
  var estadoApp = {
    idioma: 'es',
    vista: 'formulario',
    seccion: 'dictamen',
    dentro: false,
    filtro: 'todas',
    avisar: true,
    ponencias: D.ponencias.map(function (p) { return Object.assign({}, p); }),
    registros: D.registros.map(function (r) { return Object.assign({}, r); }),
    recordatorios: D.recordatorios.map(function (r) { return Object.assign({}, r); }),
    enviados: {},
    avisos: [],
  };

  function t() { return D.diccionarios[estadoApp.idioma]; }
  function tr(multi) { return multi[estadoApp.idioma] || multi.es || ''; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fecha(iso) {
    if (!iso) return '';
    var d = new Date(iso + 'T12:00:00Z');
    return d.toLocaleDateString(estadoApp.idioma, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function nombrePerfil(clave) { return t().perfiles[clave] || clave; }

  /* ---------------------------------------------------------------- avisos */
  function avisar(texto, tono) {
    var caja = document.getElementById('avisos');
    var nodo = document.createElement('div');
    nodo.className = 'aviso aviso-' + (tono || 'ok');
    nodo.setAttribute('role', 'status');
    nodo.textContent = texto;
    caja.appendChild(nodo);
    setTimeout(function () { nodo.classList.add('sale'); }, 4200);
    setTimeout(function () { nodo.remove(); }, 4800);
  }

  /* ---------------------------------------------------------------- acceso */
  async function comprobarClave(clave) {
    var datos = new TextEncoder().encode(clave);
    var resumen = await crypto.subtle.digest('SHA-256', datos);
    var hex = Array.from(new Uint8Array(resumen))
      .map(function (b) { return b.toString(16).padStart(2, '0'); })
      .join('');
    return hex === D.claveSha;
  }

  /* ------------------------------------------------------------- dictamen */
  var TONO_PONENCIA = {
    sin_dictamen: 'neutro', en_revision: 'info', aceptada: 'ok',
    aceptada_con_cambios: 'aviso', rechazada: 'alto',
  };

  function pintarDictamen() {
    var d = t().panel.dictamen;
    var avance = calcularAvance(estadoApp.ponencias.map(function (p) { return p.estado; }));
    var visibles = estadoApp.filtro === 'todas'
      ? estadoApp.ponencias
      : estadoApp.ponencias.filter(function (p) { return p.estado === estadoApp.filtro; });

    var chips = ['<button class="chip' + (estadoApp.filtro === 'todas' ? ' chip-activo' : '') +
      '" data-filtro="todas">' + esc(t().panel.filtros.todos) + ' (' + avance.total + ')</button>'];
    ESTADOS_PONENCIA.forEach(function (e) {
      chips.push('<button class="chip' + (estadoApp.filtro === e ? ' chip-activo' : '') +
        '" data-filtro="' + e + '">' + esc(d[e]) + ' (' + avance.porEstado[e] + ')</button>');
    });

    var tarjetas = visibles.map(function (p) {
      var abierta = !dictamenResuelto(p.estado);
      var botones = ESTADOS_PONENCIA.filter(function (e) { return e !== p.estado; })
        .map(function (e) {
          return '<button class="btn btn-chico" data-dictaminar="' + p.id + '" data-estado="' + e +
            '">' + esc(d.verbo[e]) + '</button>';
        }).join('');

      return '' +
      '<article class="ficha" id="ficha-' + p.id + '">' +
        '<header class="ficha-cab">' +
          '<div>' +
            '<h3>' + esc(p.titulo) + '</h3>' +
            '<p class="meta">' + esc(p.nombre) + ' · <span class="folio">' + esc(p.folio) +
              '</span> · ' + esc(nombrePerfil(p.perfil)) + ' · ' + esc(p.institucion) + ' · ' +
              esc(p.pais) + ' · ' + esc(fecha(p.creado)) + '</p>' +
            '<p class="meta">' + esc(t().formulario.campos.ejeTematico) + ': ' +
              esc(tr(p.ejeNombre)) + '</p>' +
          '</div>' +
          '<span class="pastilla pastilla-' + TONO_PONENCIA[p.estado] + '">' + esc(d[p.estado]) + '</span>' +
        '</header>' +
        '<details class="resumen"' + (abierta ? ' open' : '') + '>' +
          '<summary>' + esc(d.resumen) + '</summary>' +
          '<p class="cuerpo">' + esc(p.resumen) + '</p>' +
          '<p class="meta">' + esc(d.palabrasClave) + ': ' + esc(p.palabras) + '</p>' +
          (p.coautoria ? '<p class="meta">' + esc(d.coautoria) + ': ' + esc(p.coautoria) + '</p>' : '') +
        '</details>' +
        '<label class="campo-bloque">' +
          '<span class="etiqueta">' + esc(d.comentarios) + '</span>' +
          '<textarea rows="3" data-comentarios="' + p.id + '">' + esc(p.comentarios) + '</textarea>' +
          '<span class="ayuda">' + esc(d.comentariosAyuda) + '</span>' +
        '</label>' +
        '<div class="acciones">' + botones + '<span class="alerta" data-alerta="' + p.id + '"></span></div>' +
        (p.enFecha
          ? '<p class="meta pie">' + esc(d.dictaminadaPor) + ': ' + esc(p.porCorreo) + ' · ' +
            esc(fecha(p.enFecha)) + '</p>'
          : '') +
      '</article>';
    }).join('');

    return '' +
    '<header class="cab-seccion">' +
      '<h2>' + esc(d.titulo) + '</h2>' +
      '<p class="ayuda">' + esc(d.ayuda) + '</p>' +
    '</header>' +
    '<div class="tiras">' +
      tira(d.recibidas, avance.total) +
      tira(d.pendientes, avance.pendientes) +
      tira(d.resueltas, avance.resueltas) +
    '</div>' +
    '<div class="barra-filtros">' + chips.join('') +
      '<label class="casilla"><input type="checkbox" id="avisar-dictamen"' +
      (estadoApp.avisar ? ' checked' : '') + '><span>' + esc(d.avisar) + '</span></label>' +
    '</div>' +
    (visibles.length ? '<div class="fichas">' + tarjetas + '</div>'
      : '<p class="vacio">' + esc(d.sinPonencias) + '</p>');
  }

  function tira(etiqueta, valor) {
    return '<div class="tira"><p class="tira-et">' + esc(etiqueta) + '</p><p class="tira-val">' +
      valor + '</p></div>';
  }

  /* --------------------------------------------------------------- estados */
  var TONO_ESTADO = {
    en_proceso: 'info', confirmado: 'ok', lista_espera: 'aviso', cancelado: 'neutro',
  };

  function ocupados() {
    return estadoApp.registros.filter(function (r) {
      return r.modalidad === 'presencial' && ocupaLugar(r.estado);
    }).length;
  }
  function libres() { return Math.max(0, D.cupoPresencial - ocupados()); }

  function pintarEstados() {
    var e = t().panel.estadosRegistro;
    var enEspera = estadoApp.registros.filter(function (r) { return r.estado === 'lista_espera'; });

    var filas = estadoApp.registros.map(function (r) {
      var botones = transicionesDesde(r.estado).map(function (destino) {
        return '<button class="btn btn-chico" data-cambiar="' + r.id + '" data-destino="' + destino +
          '">' + esc(e.verbo[destino]) + '</button>';
      }).join('');
      return '' +
      '<tr>' +
        '<td><span class="folio">' + esc(r.folio) + '</span></td>' +
        '<td><b>' + esc(r.nombre) + '</b><br><span class="meta">' + esc(nombrePerfil(r.perfil)) +
          ' · ' + esc(r.institucion) + ' · ' + esc(r.pais) + '</span></td>' +
        '<td>' + esc(t().modalidad[r.modalidad === 'presencial' ? 'presencial' : 'en_linea']) + '</td>' +
        '<td><span class="pastilla pastilla-' + TONO_ESTADO[r.estado] + '">' + esc(e[r.estado]) +
          '</span></td>' +
        '<td class="acciones-fila">' + botones + '</td>' +
      '</tr>';
    }).join('');

    var porcentaje = Math.min(100, Math.round((ocupados() / D.cupoPresencial) * 100));

    return '' +
    '<header class="cab-seccion">' +
      '<h2>' + esc(e.titulo) + '</h2>' +
      '<p class="ayuda">' + esc(e.listaEsperaAyuda) + '</p>' +
    '</header>' +
    '<div class="tiras">' +
      tira(t().panel.kpi.ocupacion, porcentaje + '%') +
      tira(t().modalidad.cuposDisponibles, libres()) +
      tira(e.listaEspera, enEspera.length) +
    '</div>' +
    '<div class="medidor"><span style="width:' + porcentaje + '%"></span></div>' +
    '<p class="ayuda medidor-pie">' + ocupados() + ' / ' + D.cupoPresencial + '</p>' +
    '<div class="tabla-caja"><table class="tabla">' +
      '<thead><tr><th>Folio</th><th>' + esc(t().formulario.campos.nombres) + '</th><th>' +
        esc(t().panel.filtros.modalidad) + '</th><th>' + esc(t().panel.filtros.estado) +
        '</th><th>' + esc(e.cambiar) + '</th></tr></thead>' +
      '<tbody>' + filas + '</tbody>' +
    '</table></div>';
  }

  /* ---------------------------------------------------------- recordatorios */
  function pintarRecordatorios() {
    var r = t().panel.recordatorios;
    var hoy = new Date(D.hoy + 'T12:00:00Z');
    var restantes = diasHasta(D.congreso.fecha_inicio, hoy);
    var deHoy = recordatorioDeHoy(estadoApp.recordatorios, D.congreso.fecha_inicio, hoy);

    var filas = estadoApp.recordatorios.map(function (fila, i) {
      var enviados = estadoApp.enviados[fila.clave] || 0;
      return '' +
      '<tr>' +
        '<td><span class="folio">' + esc(fila.clave) + '</span>' +
          (deHoy && deHoy.clave === fila.clave
            ? ' <span class="pastilla pastilla-info">hoy</span>' : '') + '</td>' +
        '<td><input type="number" min="0" max="365" value="' + fila.dias_antes +
          '" data-dias="' + i + '" aria-label="' + esc(r.diasAntes) + '"></td>' +
        '<td><label class="casilla"><input type="checkbox" data-activo="' + i + '"' +
          (fila.activo ? ' checked' : '') + '><span>' + esc(r.activo) + '</span></label></td>' +
        '<td class="meta">' + esc(r.enviados) + ': <b>' + enviados + '</b></td>' +
        '<td class="acciones-fila"><button class="btn btn-chico" data-enviar="' + fila.clave + '">' +
          esc(r.enviarAhora) + '</button></td>' +
      '</tr>';
    }).join('');

    return '' +
    '<header class="cab-seccion">' +
      '<h2>' + esc(r.titulo) + '</h2>' +
      '<p class="ayuda">' + esc(r.ayuda) + '</p>' +
    '</header>' +
    '<div class="tiras">' +
      tira('Día simulado', fecha(D.hoy)) +
      tira('Faltan', restantes + ' d') +
      tira('Toca enviar', deHoy ? deHoy.clave : '—') +
    '</div>' +
    '<div class="tabla-caja"><table class="tabla">' +
      '<thead><tr><th>Clave</th><th>' + esc(r.diasAntes) + '</th><th>' + esc(r.activo) +
        '</th><th>' + esc(r.enviados) + '</th><th></th></tr></thead>' +
      '<tbody>' + filas + '</tbody>' +
    '</table></div>' +
    '<p class="ayuda">Reciben el recordatorio quienes tienen el registro vigente: ' +
      destinatarios() + ' de ' + estadoApp.registros.length + '.</p>';
  }

  function destinatarios() {
    return estadoApp.registros.filter(function (x) {
      return x.estado === 'confirmado' || x.estado === 'en_proceso';
    }).length;
  }

  /* ----------------------------------------------------------------- marco */
  function pintar() {
    document.documentElement.lang = estadoApp.idioma;
    document.getElementById('puerta').hidden = estadoApp.dentro;
    document.getElementById('app').hidden = !estadoApp.dentro;
    if (!estadoApp.dentro) { pintarPuerta(); return; }

    document.getElementById('pestanas').innerHTML =
      '<button class="pestana' + (estadoApp.vista === 'formulario' ? ' activa' : '') +
        '" data-vista="formulario">' + esc(t().nav.registro) + '</button>' +
      '<button class="pestana' + (estadoApp.vista === 'panel' ? ' activa' : '') +
        '" data-vista="panel">' + esc(t().panel.titulo) + '</button>';

    document.getElementById('idiomas').innerHTML = D.idiomas.map(function (i) {
      return '<button class="mini' + (estadoApp.idioma === i ? ' activa' : '') +
        '" data-idioma="' + i + '">' + i.toUpperCase() + '</button>';
    }).join('');

    document.getElementById('zona-formulario').hidden = estadoApp.vista !== 'formulario';
    document.getElementById('zona-panel').hidden = estadoApp.vista !== 'panel';

    if (estadoApp.vista === 'panel') {
      var secciones = [
        ['dictamen', t().panel.secciones.dictamen],
        ['estados', t().panel.estadosRegistro.titulo],
        ['recordatorios', t().panel.recordatorios.titulo],
      ];
      document.getElementById('rail').innerHTML = secciones.map(function (s) {
        return '<button class="rail-btn' + (estadoApp.seccion === s[0] ? ' activa' : '') +
          '" data-seccion="' + s[0] + '">' + esc(s[1]) + '</button>';
      }).join('');
      var cuerpo = estadoApp.seccion === 'dictamen' ? pintarDictamen()
        : estadoApp.seccion === 'estados' ? pintarEstados() : pintarRecordatorios();
      document.getElementById('cuerpo-panel').innerHTML = cuerpo;
    }
  }

  function pintarPuerta() {
    document.getElementById('puerta-titulo').textContent = tr(D.congreso.nombre_corto);
    document.getElementById('puerta-sede').textContent =
      tr(D.congreso.sede) + ' · ' + tr(D.congreso.fechas);
  }

  /* ------------------------------------------------------------- reacciones */
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('button');
    if (!b) return;

    if (b.dataset.vista) { estadoApp.vista = b.dataset.vista; pintar(); return; }
    if (b.dataset.idioma) { estadoApp.idioma = b.dataset.idioma; pintar(); return; }
    if (b.dataset.seccion) { estadoApp.seccion = b.dataset.seccion; pintar(); return; }
    if (b.dataset.filtro) { estadoApp.filtro = b.dataset.filtro; pintar(); return; }
    if (b.id === 'btn-salir') { estadoApp.dentro = false; pintar(); return; }
    if (b.id === 'btn-tema') { alternarTema(); return; }

    if (b.dataset.dictaminar) { dictaminar(b.dataset.dictaminar, b.dataset.estado); return; }
    if (b.dataset.cambiar) { cambiarEstado(b.dataset.cambiar, b.dataset.destino); return; }
    if (b.dataset.enviar) { enviarRecordatorio(b.dataset.enviar); return; }
  });

  document.addEventListener('input', function (ev) {
    var el = ev.target;
    if (el.dataset && el.dataset.comentarios) {
      var p = estadoApp.ponencias.find(function (x) { return x.id === el.dataset.comentarios; });
      if (p) p.comentarios = el.value;
    }
    if (el.dataset && el.dataset.dias) {
      estadoApp.recordatorios[Number(el.dataset.dias)].dias_antes = Number(el.value);
    }
  });

  document.addEventListener('change', function (ev) {
    var el = ev.target;
    if (el.id === 'avisar-dictamen') estadoApp.avisar = el.checked;
    if (el.dataset && el.dataset.activo) {
      estadoApp.recordatorios[Number(el.dataset.activo)].activo = el.checked;
      pintar();
    }
  });

  function dictaminar(id, estado) {
    var p = estadoApp.ponencias.find(function (x) { return x.id === id; });
    if (!p) return;
    var veredicto = evaluarDictamen({
      estado: estado, comentarios: p.comentarios, tienePonencia: true,
    });
    if (!veredicto.permitido) {
      var alerta = document.querySelector('[data-alerta="' + id + '"]');
      if (alerta) alerta.textContent = t().panel.dictamen.faltanComentarios;
      var caja = document.querySelector('[data-comentarios="' + id + '"]');
      if (caja) caja.focus();
      return;
    }
    p.estado = estado;
    p.porCorreo = 'admin@ciess.org';
    p.enFecha = D.hoy;
    pintar();
    avisar(t().panel.dictamen.guardado + ' · ' + p.folio, 'ok');
    if (estadoApp.avisar && (estado === 'aceptada' || estado === 'aceptada_con_cambios' ||
        estado === 'rechazada')) {
      avisar('Correo enviado a ' + p.nombre + ' (' + p.idioma.toUpperCase() + ')', 'info');
    }
  }

  function cambiarEstado(id, destino) {
    var r = estadoApp.registros.find(function (x) { return x.id === id; });
    if (!r) return;
    var veredicto = evaluarCambio({
      desde: r.estado, hasta: destino, modalidad: r.modalidad, lugaresLibres: libres(),
    });
    if (!veredicto.permitido) { avisar(veredicto.motivo, 'alto'); return; }
    r.estado = destino;
    pintar();
    avisar(t().panel.estadosRegistro.cambiado + ' · ' + r.folio, 'ok');
  }

  function enviarRecordatorio(clave) {
    var yaEnviados = estadoApp.enviados[clave] || 0;
    var pendientes = destinatarios() - yaEnviados;
    if (pendientes <= 0) {
      avisar('Nadie pendiente: ya recibieron «' + clave + '».', 'info');
      return;
    }
    estadoApp.enviados[clave] = yaEnviados + pendientes;
    pintar();
    avisar(t().panel.recordatorios.enviados + ': ' + pendientes + ' · ' + clave, 'ok');
  }

  /* -------------------------------------------------------------- el tema */
  function alternarTema() {
    var raiz = document.documentElement;
    var oscuro = raiz.getAttribute('data-theme') === 'dark' ||
      (!raiz.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
    raiz.setAttribute('data-theme', oscuro ? 'light' : 'dark');
  }

  /* --------------------------------------------------------------- entrada */
  document.getElementById('forma-acceso').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var usuario = document.getElementById('usuario').value.trim();
    var clave = document.getElementById('clave').value;
    var error = document.getElementById('error-acceso');
    var correcta = await comprobarClave(clave);
    if (usuario.toLowerCase() !== D.usuario.toLowerCase() || !correcta) {
      error.textContent = 'Usuario o contraseña incorrectos.';
      return;
    }
    error.textContent = '';
    estadoApp.dentro = true;
    pintar();
  });

  document.getElementById('ver-formulario').addEventListener('click', function () {
    estadoApp.dentro = true;
    estadoApp.vista = 'formulario';
    pintar();
  });

  pintar();
})();
