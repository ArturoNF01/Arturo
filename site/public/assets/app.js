/* Cuestionario final y panel del instructor.
   La calificación, el control de intentos y la sesión del panel viven en las
   Functions de Cloudflare; aquí solo se presenta y se envía la información. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var vistas = {
    inicio: $('vista-inicio'),
    examen: $('vista-examen'),
    resultado: $('vista-resultado'),
    panel: $('vista-panel')
  };

  var config = null;
  var preguntas = [];
  var respuestas = {};
  var inicio = 0;
  var temporizador = null;
  var enviando = false;
  var enviado = false;
  var participante = { nombre: '', pais: '' };

  /* ---------- utilidades ---------- */

  function mmss(seg) {
    seg = Math.max(0, Math.round(seg));
    var m = Math.floor(seg / 60), s = seg % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function fecha(iso) {
    var d = new Date(iso);
    if (!iso || isNaN(d.getTime())) return '—';
    return d.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function escapa(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function pide(url, opciones) {
    var cfg = Object.assign({ credentials: 'same-origin', headers: {} }, opciones || {});
    if (cfg.body) cfg.headers['Content-Type'] = 'application/json';
    return fetch(url, cfg).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (datos) {
        if (!r.ok) throw Object.assign(new Error(datos.error || 'error'), { estado: r.status, datos: datos });
        return datos;
      });
    });
  }

  function muestra(nombre) {
    Object.keys(vistas).forEach(function (k) { vistas[k].hidden = k !== nombre; });
    var titulos = {
      inicio: 'Cuestionario final',
      examen: 'Cuestionario final',
      resultado: 'Resultado del cuestionario',
      panel: 'Panel del instructor'
    };
    $('titulo-vista').textContent = titulos[nombre];
    $('link-panel').hidden = nombre === 'panel';
    window.scrollTo(0, 0);
  }

  /* ---------- carga del cuestionario ---------- */

  function cargaCuestionario() {
    return pide('/api/cuestionario').then(function (datos) {
      config = datos.config;
      preguntas = datos.preguntas;
      $('f-reactivos').textContent = preguntas.length + ' de opción múltiple';
      $('f-tiempo').textContent = config.minutos + ' minutos';
      $('f-intentos').textContent = config.intentos;
      $('f-ponderacion').textContent = config.ponderacion;
      $('f-fechas').innerHTML = 'Disponible del <strong>' + escapa(config.disponibleDesde) +
        '</strong> al <strong>' + escapa(config.disponibleHasta) +
        '</strong>. Calificación aprobatoria: <strong>' + config.aprobatoria.toFixed(1) + '</strong>.';
      $('estado-registro').textContent = 'Registro de entregas en línea.';
    }).catch(function () {
      $('f-fechas').className = 'aviso rojo';
      $('f-fechas').textContent = 'No fue posible cargar el cuestionario. Recargue la página en unos segundos.';
      $('btn-comenzar').disabled = true;
      $('estado-registro').textContent = 'Sin conexión con el servidor.';
    });
  }

  function dibujaPreguntas() {
    var cont = $('lista-preguntas');
    cont.innerHTML = '';
    preguntas.forEach(function (q, i) {
      var bloque = document.createElement('div');
      bloque.className = 'bloque';
      bloque.id = 'bloque-' + i;

      var fs = document.createElement('fieldset');
      fs.className = 'pregunta';

      var leyenda = document.createElement('legend');
      leyenda.innerHTML = '<span class="indice">' + (i + 1 < 10 ? '0' : '') + (i + 1) + '</span>' +
        '<span class="enunciado">' + q.pregunta + '</span>';
      fs.appendChild(leyenda);

      if (q.codigo) {
        var pre = document.createElement('pre');
        pre.textContent = q.codigo;
        fs.appendChild(pre);
      }

      var opciones = document.createElement('div');
      opciones.className = 'opciones';
      q.opciones.forEach(function (texto, j) {
        var lbl = document.createElement('label');
        lbl.className = 'opcion';
        lbl.innerHTML = '<input type="radio" name="q' + i + '" value="' + j + '">' +
          '<span class="letra">' + 'ABCD'[j] + '.</span><span>' + texto + '</span>';
        lbl.querySelector('input').addEventListener('change', function () {
          respuestas[i] = j;
          Array.prototype.forEach.call(opciones.children, function (c) { c.classList.remove('marcada'); });
          lbl.classList.add('marcada');
          bloque.classList.remove('pendiente');
          actualizaProgreso();
        });
        opciones.appendChild(lbl);
      });

      fs.appendChild(opciones);
      bloque.appendChild(fs);
      cont.appendChild(bloque);
    });
  }

  function actualizaProgreso() {
    var n = Object.keys(respuestas).length;
    $('relleno-progreso').style.width = (n / preguntas.length * 100) + '%';
    $('texto-progreso').textContent = n + ' de ' + preguntas.length + ' respondidas';
  }

  function arrancaReloj() {
    inicio = Date.now();
    var limite = config.minutos * 60;
    var pinta = function () {
      var resto = limite - (Date.now() - inicio) / 1000;
      $('valor-reloj').textContent = mmss(resto);
      $('reloj').classList.toggle('urgente', resto <= 300);
      if (resto <= 0) {
        clearInterval(temporizador);
        temporizador = null;
        envia(true);
      }
    };
    pinta();
    temporizador = setInterval(pinta, 1000);
  }

  function envia(porTiempo) {
    if (enviado || enviando) return;

    var faltantes = [];
    preguntas.forEach(function (q, i) { if (respuestas[i] === undefined) faltantes.push(i); });

    if (!porTiempo && faltantes.length) {
      var aviso = $('aviso-envio');
      var boton = $('btn-enviar');
      aviso.hidden = false;
      aviso.innerHTML = 'Faltan <strong>' + faltantes.length + '</strong> preguntas por responder (' +
        faltantes.map(function (i) { return i + 1; }).join(', ') +
        '). Puede enviarlas así, pero contarán como incorrectas.';
      faltantes.forEach(function (i) { $('bloque-' + i).classList.add('pendiente'); });
      if (!boton.dataset.avisado) {
        boton.dataset.avisado = '1';
        boton.textContent = 'Confirmar envío';
        return;
      }
    }

    enviando = true;
    $('btn-enviar').disabled = true;
    $('btn-enviar').textContent = 'Enviando…';

    var cuerpo = {
      nombre: participante.nombre,
      pais: participante.pais,
      porTiempo: !!porTiempo,
      duracionSeg: Math.round((Date.now() - inicio) / 1000),
      respuestas: preguntas.map(function (q, i) { return respuestas[i] === undefined ? -1 : respuestas[i]; })
    };

    pide('/api/entregas', { method: 'POST', body: JSON.stringify(cuerpo) })
      .then(function (entrega) {
        enviado = true;
        if (temporizador) { clearInterval(temporizador); temporizador = null; }
        pintaResultado(entrega, porTiempo);
      })
      .catch(function (err) {
        enviando = false;
        $('btn-enviar').disabled = false;
        $('btn-enviar').textContent = 'Enviar todo y terminar';
        var aviso = $('aviso-envio');
        aviso.hidden = false;
        aviso.className = 'aviso rojo';
        aviso.textContent = err.estado === 409
          ? 'Este participante ya tiene un intento registrado, por lo que no se guardó una segunda entrega.'
          : 'No fue posible registrar la entrega. Revise su conexión y vuelva a intentarlo; sus respuestas siguen en pantalla.';
      });
  }

  function pintaResultado(entrega, porTiempo) {
    $('r-calificacion').textContent = entrega.calificacion.toFixed(1);
    $('r-aciertos').textContent = entrega.aciertos + '/' + entrega.total;
    $('r-tiempo').textContent = mmss(entrega.duracionSeg);

    var estado = $('r-estado');
    estado.textContent = entrega.aprobado ? 'Aprobado' : 'No aprobado';
    estado.className = 'pill ' + (entrega.aprobado ? 'ok' : 'no');

    $('saludo-resultado').textContent = entrega.nombre
      ? entrega.nombre.split(' ')[0] + ', este es su resultado'
      : 'Resultado';

    $('r-nota').innerHTML = (porTiempo ? 'Se agotó el tiempo disponible y la prueba se envió automáticamente. ' : '') +
      'Su entrega quedó registrada el ' + fecha(entrega.enviadoEn) +
      ' y ya es visible en el panel del instructor. Cada reactivo vale <strong>' +
      (10 / entrega.total).toFixed(1) + '</strong>; la calificación aprobatoria es <strong>' +
      entrega.aprobatoria.toFixed(1) + '</strong>.';

    var rev = $('revision');
    rev.innerHTML = '';
    entrega.detalle.forEach(function (d, i) {
      var q = preguntas[i];
      var art = document.createElement('article');
      art.innerHTML = '<span class="marca ' + (d.acierto ? 'si' : 'no') + '">' + (d.acierto ? '✓' : '✕') + '</span>' +
        '<div class="detalle"><span class="enunciado">' + (i + 1) + '. ' + q.pregunta + '</span>' +
        '<span class="tuya">Su respuesta: ' +
        (d.elegida >= 0 ? 'ABCD'[d.elegida] + ') ' + q.opciones[d.elegida] : 'sin responder') + '</span>' +
        (d.acierto ? '' : '<span><strong>Correcta:</strong> ' + 'ABCD'[d.correcta] + ') ' + q.opciones[d.correcta] + '</span>') +
        '<span class="tuya">' + escapa(d.explicacion) + '</span></div>';
      rev.appendChild(art);
    });

    muestra('resultado');
  }

  /* ---------- panel ---------- */

  function pintaPanel(datos) {
    var r = datos.resumen;
    $('p-total').textContent = r.total;
    $('p-promedio').textContent = r.promedio === null ? '—' : r.promedio.toFixed(1);
    $('p-aprobados').textContent = r.aprobados === null ? '—' : r.aprobados + '%';
    $('p-tiempo').textContent = r.tiempoMedio === null ? '—' : mmss(r.tiempoMedio);
    $('p-fuente').textContent = r.total
      ? 'Registro en la base de datos D1 · calificación aprobatoria ' + r.aprobatoria.toFixed(1) + '.'
      : 'Aún no hay entregas registradas.';

    var filas = $('p-filas');
    filas.innerHTML = '';
    if (!datos.entregas.length) {
      filas.innerHTML = '<tr><td colspan="6" class="vacio">La primera entrega aparecerá aquí en cuanto alguien envíe el cuestionario.</td></tr>';
    } else {
      datos.entregas.forEach(function (e) {
        var tr = document.createElement('tr');
        tr.innerHTML = '<td>' + escapa(e.nombre) + '</td>' +
          '<td>' + escapa(e.pais) + '</td>' +
          '<td class="num"><span class="pill ' + (e.aprobado ? 'ok' : 'no') + '">' + e.calificacion.toFixed(1) + '</span></td>' +
          '<td class="num">' + e.aciertos + '/' + e.total + '</td>' +
          '<td class="num">' + mmss(e.duracionSeg) + (e.porTiempo ? ' ⏱' : '') + '</td>' +
          '<td class="num">' + fecha(e.enviadoEn) + '</td>';
        filas.appendChild(tr);
      });
    }

    var cont = $('p-reactivos');
    cont.innerHTML = '';
    datos.reactivos.forEach(function (x) {
      var div = document.createElement('div');
      div.className = 'reactivo';
      div.innerHTML = '<span class="id">' + (x.numero < 10 ? '0' : '') + x.numero + '</span>' +
        '<div class="barra-linea"><div class="riel"><div class="relleno' + (x.porcentaje < 60 ? ' baja' : '') +
        '" style="width:' + x.porcentaje + '%"></div></div>' +
        '<span class="texto">' + escapa(x.enunciado) + '</span></div>' +
        '<span class="pct">' + x.porcentaje + '%</span>';
      cont.appendChild(div);
    });
  }

  function cargaPanel() {
    $('p-fuente').textContent = 'Consultando el registro…';
    return pide('/api/panel/entregas')
      .then(pintaPanel)
      .catch(function (err) {
        if (err.estado === 401) { cierraPanel(); return; }
        $('p-fuente').textContent = 'No fue posible leer el registro en este momento.';
      });
  }

  function abrePanel(usuario) {
    $('panel-acceso').hidden = true;
    $('panel-contenido').hidden = false;
    $('p-sesion').textContent = 'Sesión activa · ' + usuario;
    $('in-clave').value = '';
    cargaPanel();
  }

  function cierraPanel() {
    $('panel-contenido').hidden = true;
    $('panel-acceso').hidden = false;
  }

  /* ---------- eventos ---------- */

  $('form-inicio').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var nombre = $('in-nombre').value.trim();
    var pais = $('in-pais').value.trim();
    var err = $('error-inicio');

    if (nombre.length < 3 || !pais) {
      err.hidden = false;
      err.textContent = 'Escriba su nombre completo y su país: ambos datos encabezan su entrega.';
      return;
    }

    err.hidden = true;
    var boton = $('btn-comenzar');
    boton.disabled = true;

    pide('/api/verificar?nombre=' + encodeURIComponent(nombre))
      .then(function (previo) {
        boton.disabled = false;
        if (previo.existe) {
          err.hidden = false;
          err.innerHTML = 'Este participante ya registró su intento el ' + fecha(previo.enviadoEn) +
            ' con calificación <strong>' + Number(previo.calificacion).toFixed(1) +
            '</strong>. El cuestionario admite un solo intento.';
          return;
        }
        participante = { nombre: nombre, pais: pais };
        dibujaPreguntas();
        actualizaProgreso();
        muestra('examen');
        arrancaReloj();
      })
      .catch(function () {
        boton.disabled = false;
        err.hidden = false;
        err.textContent = 'No fue posible verificar su registro. Revise su conexión e inténtelo de nuevo.';
      });
  });

  $('btn-enviar').addEventListener('click', function () { envia(false); });

  $('form-acceso').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var err = $('error-acceso');
    var boton = $('btn-entrar');
    err.hidden = true;
    boton.disabled = true;

    pide('/api/sesion', {
      method: 'POST',
      body: JSON.stringify({ usuario: $('in-usuario').value, clave: $('in-clave').value })
    }).then(function (datos) {
      boton.disabled = false;
      abrePanel(datos.usuario);
    }).catch(function (e) {
      boton.disabled = false;
      err.hidden = false;
      err.textContent = e.estado === 503
        ? 'El panel aún no tiene credenciales configuradas en el servidor.'
        : 'Usuario o contraseña incorrectos. Verifique mayúsculas y minúsculas.';
    });
  });

  $('btn-actualizar').addEventListener('click', cargaPanel);

  $('btn-salir').addEventListener('click', function () {
    pide('/api/sesion', { method: 'DELETE' }).catch(function () {}).then(cierraPanel);
  });

  window.addEventListener('hashchange', ruta);

  window.addEventListener('beforeunload', function (ev) {
    if (!vistas.examen.hidden && !enviado) { ev.preventDefault(); ev.returnValue = ''; }
  });

  function ruta() {
    if (location.hash === '#panel') {
      muestra('panel');
      pide('/api/sesion').then(function (s) {
        if (s.activa) abrePanel(s.usuario); else cierraPanel();
      }).catch(cierraPanel);
    } else if (enviado) {
      muestra('resultado');
    } else if (!vistas.examen.hidden) {
      muestra('examen');
    } else {
      muestra('inicio');
    }
  }

  /* ---------- arranque ---------- */

  cargaCuestionario().then(ruta);
})();
