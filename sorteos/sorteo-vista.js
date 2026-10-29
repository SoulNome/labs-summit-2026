/* ==========================================================================
   Labs Summit 2026 · Sorteos verificables — vista de un sorteo
   La usan la página pública y la herramienta del organizador (vista previa y
   pantalla grande). Todo el texto se pone con textContent: nunca innerHTML.
   ========================================================================== */
(function () {
  'use strict';

  var N = window.LSSorteo;
  var REDUCIDO = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- utilidades de interfaz ---------------- */
  function h(tag, props, hijos) {
    var e = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : String(v));
    });
    (hijos || []).forEach(function (c) {
      if (c == null || c === false) return;
      e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return e;
  }
  function vaciar(e) { while (e.firstChild) e.removeChild(e.firstChild); return e; }
  function horaCol(ms, seg) {
    var o = { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit', hour12: true };
    if (seg) o.second = '2-digit';
    return new Date(ms).toLocaleTimeString('es-CO', o).replace(/\s/g, String.fromCharCode(160));   // «5:00 p. m.» sin partirse
  }
  function fechaCol(ms) { return new Date(ms).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long' }); }
  function normal(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function corta(huella) { return huella.slice(0, 8) + ' ' + huella.slice(8, 16); }
  function descargar(nombre, texto, tipo) {
    var url = URL.createObjectURL(new Blob([texto], { type: tipo || 'text/plain;charset=utf-8' }));
    var a = h('a', { href: url, download: nombre });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function marca(ok) { return h('span', { class: 'visto ' + (ok === true ? 'si' : ok === false ? 'no' : 'espera'), 'aria-hidden': 'true', text: ok === true ? '✓' : ok === false ? '✕' : '…' }); }
  // «Suplente 1», «Suplente 2»…: por si el ganador no aparece. En pantalla van aparte y más pequeños.
  function esSuplente(premio) { return /^suplente\b/i.test(N.limpiar(premio)); }
  function minutos(ms) { var m = Math.round(ms / 6e4); return m < 1 ? 'menos de un minuto' : m === 1 ? '1 minuto' : m.toLocaleString('es-CO') + ' minutos'; }

  // Confeti para la pantalla grande: piezas con CSS (las variables se ponen por CSSOM, que la CSP permite)
  function confeti() {
    if (REDUCIDO) return;
    var capa = h('div', { class: 'confeti', 'aria-hidden': 'true' });
    var colores = ['#A855F7', '#E879F9', '#F2C46D', '#C9AEFF', '#4ADE80', '#FFFFFF'];
    for (var i = 0; i < 140; i++) {
      var p = document.createElement('i');
      p.style.setProperty('--x', (Math.random() * 100).toFixed(2) + 'vw');
      p.style.setProperty('--dx', ((Math.random() - 0.5) * 30).toFixed(2) + 'vw');
      p.style.setProperty('--w', (6 + Math.random() * 9).toFixed(1) + 'px');
      p.style.setProperty('--r', Math.floor(Math.random() * 360) + 'deg');
      p.style.setProperty('--d', (2.6 + Math.random() * 2.4).toFixed(2) + 's');
      p.style.setProperty('--t', (Math.random() * 0.9).toFixed(2) + 's');
      p.style.setProperty('--c', colores[i % colores.length]);
      capa.appendChild(p);
    }
    document.body.appendChild(capa);
    setTimeout(function () { capa.remove(); }, 6500);
  }

  /* ---------------- vista ---------------- */
  /**
   * Muestra el sorteo `s` (archivo público) dentro de `caja`.
   * op.pantalla: modo pantalla grande · op.origen: texto sobre de dónde salió el archivo.
   * Devuelve { detener() }.
   */
  function mostrar(caja, s, op) {
    op = op || {};
    vaciar(caja);
    var temporizadores = [], vivo = true;
    function despues(fn, ms) { var t = setTimeout(function () { if (vivo) fn(); }, ms); temporizadores.push(t); }
    var control = { detener: function () { vivo = false; temporizadores.forEach(clearTimeout); clearInterval(reloj); } };
    var reloj = null;

    var problemas = N.validar(s);
    if (problemas.length) {
      caja.appendChild(h('div', { class: 'aviso-error', role: 'alert' }, [
        h('b', { text: 'Este archivo de sorteo no es válido' }),
        h('ul', null, problemas.map(function (p) { return h('li', { text: p }); }))
      ]));
      return control;
    }

    var hora = N.horaDeRonda(s.azar.ronda);
    var abiertoAntes = Date.now() < hora;   // ¿llegamos antes del sorteo? (entonces se anima la revelación)
    var publicado = op.publicado ? Date.parse(op.publicado) : NaN;
    // En la pantalla del organizador (con el archivo privado) el ganador sale con su nombre completo
    var nombreDe = typeof op.nombres === 'function' ? op.nombres : null;
    function textoGanador(x) { return (nombreDe && nombreDe(x.posicion)) || x.etiqueta; }
    var principales = s.premios.filter(function (p) { return !esSuplente(p); }), suplentes = s.premios.length - principales.length;
    if (!principales.length) { principales = s.premios; suplentes = 0; }

    /* encabezado */
    var cab = h('header', { class: 'sv-cab' }, [
      s.ensayo ? h('span', { class: 'sello-ensayo', text: 'Ensayo · no es un sorteo oficial' }) : null,
      h('h1', { class: 'sv-titulo', text: s.titulo }),
      h('ol', { class: 'sv-premios' }, principales.map(function (p, i) {
        return h('li', null, [h('span', { class: 'n', text: principales.length > 1 ? (i + 1) + '.º' : 'Premio' }), ' ', p]);
      })),
      suplentes ? h('p', { class: 'sv-suplentes-nota', text: '+ ' + suplentes + (suplentes === 1 ? ' suplente' : ' suplentes') + ', por si el ganador no reclama el premio' }) : null
    ]);
    caja.appendChild(cab);

    /* estado: cuenta regresiva → buscando el azar → ganadores */
    var estado = h('section', { class: 'sv-estado', 'aria-live': 'polite' });
    caja.appendChild(estado);

    /* datos clave */
    var huellaCalc = h('code', { class: 'sv-huella-txt', text: s.huella });
    var huellaMarca = h('span', { class: 'sv-huella-ok' }, [marca(null), ' comprobando…']);
    caja.appendChild(h('section', { class: 'sv-datos' }, [
      h('div', { class: 'dato' }, [h('span', { class: 'l', text: 'Participan' }), h('b', { text: s.participantes.length.toLocaleString('es-CO') }), h('small', { text: s.participantes.length === 1 ? 'participación' : 'participaciones' })]),
      h('div', { class: 'dato' }, [h('span', { class: 'l', text: 'Lista cerrada' }), h('b', { text: horaCol(Date.parse(s.cierre)) }), h('small', { text: !isNaN(publicado) && publicado < hora ? 'publicada ' + minutos(hora - publicado) + ' antes del sorteo' : fechaCol(Date.parse(s.cierre)) })]),
      h('div', { class: 'dato' }, [h('span', { class: 'l', text: 'Azar de drand' }), h('b', { text: horaCol(hora, true) }), h('small', { text: 'ronda ' + s.azar.ronda.toLocaleString('es-CO') })]),
      h('div', { class: 'dato ancho' }, [
        h('span', { class: 'l', text: 'Huella del acta' }),
        h('b', { class: 'sv-huella-corta', text: corta(s.huella) }),
        huellaCalc,
        huellaMarca
      ])
    ]));

    if (!op.pantalla) {
      caja.appendChild(buscador(s));
    }
    var verif = h('section', { class: 'sv-verif' });
    if (!op.pantalla) caja.appendChild(verif);

    // En la pantalla grande, el QR para que se registren los que aún no participan
    if (op.pantalla) caja.appendChild(h('aside', { class: 'sv-qr' }, [
      h('img', { src: '/sorteos/qr-participa.svg', alt: 'QR para registrarse en los sorteos', width: 180, height: 180 }),
      h('p', null, ['¿Aún no participas?', h('br'), 'Escanea para los próximos sorteos'])
    ]));

    var acciones = h('div', { class: 'sv-acciones' }, [
      h('button', { type: 'button', class: 'btn', text: 'Descargar acta (.txt)', onclick: function () { descargar(s.id + '-acta.txt', N.textoActa(s)); } }),
      h('button', { type: 'button', class: 'btn', text: 'Descargar datos (.json)', onclick: function () { descargar(s.id + '.json', JSON.stringify(s, null, 1), 'application/json'); } }),
      document.fullscreenEnabled ? h('button', { type: 'button', class: 'btn', text: 'Pantalla completa', onclick: function () { document.documentElement.requestFullscreen().catch(function () {}); } }) : null
    ]);
    caja.appendChild(acciones);
    if (op.origen) caja.appendChild(h('p', { class: 'sv-origen', text: op.origen }));

    /* paso 1: la huella */
    var res = { huellaOk: null, ronda: null, ganadores: [] };
    pintarVerificacion();
    N.verificar(s).then(function (r) {
      res.huellaOk = r.huellaOk;
      vaciar(huellaMarca).appendChild(marca(r.huellaOk));
      huellaMarca.appendChild(document.createTextNode(r.huellaOk ? ' coincide con la lista publicada' : ' NO coincide: la lista cambió'));
      if (!r.huellaOk) { huellaMarca.classList.add('mal'); pintarError(r.problemas[0]); return; }
      pintarVerificacion();
      arrancarReloj();
    });

    function arrancarReloj() {
      var buscando = false;
      function tic() {
        if (!vivo || res.ganadores.length) return;
        var falta = hora - Date.now();
        if (falta > 0) { pintarCuenta(falta); return; }
        if (!buscando) { buscando = true; pintarBuscando('Esperando el número aleatorio de drand…'); buscar(); }
      }
      function buscar() {
        N.pedirRonda(s.azar.ronda).then(function (ronda) {
          res.ronda = ronda;
          clearInterval(reloj);
          return N.verificar(s, ronda).then(function (r) {
            if (r.problemas.length) { pintarError(r.problemas[0]); return; }
            return marcarRevelados(r.ganadores).then(function () {
              res.ganadores = r.ganadores;
              pintarVerificacion();
              revelar(r.ganadores);
              if (op.alTerminar) op.alTerminar(r);
            });
          });
        }, function (e) {
          if (!vivo) return;
          if (e.tipo === 'pendiente') { pintarBuscando('Esperando el número aleatorio de drand…'); despues(buscar, 2000); }
          else if (e.tipo === 'invalida') { pintarBuscando('Los servidores de drand respondieron algo que no pasa la verificación. Reintentando…'); despues(buscar, 10000); }
          else { pintarBuscando('Sin conexión con drand. El resultado no cambia: aparece apenas vuelva la señal.'); despues(buscar, 5000); }
        });
      }
      tic();
      reloj = setInterval(tic, 250);
    }

    function pintarCuenta(falta) {
      var d = Math.floor(falta / 864e5), hh = Math.floor(falta % 864e5 / 36e5), m = Math.floor(falta % 36e5 / 6e4), sg = Math.floor(falta % 6e4 / 1e3);
      function dos(n) { return (n < 10 ? '0' : '') + n; }
      var txt = d ? d + 'd ' + hh + 'h ' + dos(m) + 'min' : hh ? hh + 'h ' + dos(m) + 'min ' + dos(sg) + 's' : dos(m) + ':' + dos(sg);
      if (op.pantalla && falta < 60e3) txt = String(Math.ceil(falta / 1e3));   // en la pantalla grande, el último minuto cuenta 10, 9, 8…
      var actual = estado.querySelector('.sv-cuenta-num');
      if (actual) {
        if (actual.textContent !== txt) actual.textContent = txt;
        actual.classList.toggle('final', falta < 10500);
        return;
      }
      vaciar(estado).appendChild(h('div', { class: 'sv-cuenta' }, [
        h('span', { class: 'l', text: 'El sorteo se hace en' }),
        h('b', { class: 'sv-cuenta-num', text: txt }),
        h('small', { text: 'a las ' + horaCol(hora, true) + ', con la ronda ' + s.azar.ronda.toLocaleString('es-CO') + ' de drand. Nadie conoce ese número todavía.' })
      ]));
    }
    function pintarBuscando(txt) {
      vaciar(estado).appendChild(h('div', { class: 'sv-buscando' }, [h('span', { class: 'giro', 'aria-hidden': 'true' }), h('b', { text: txt })]));
    }
    function pintarError(txt) {
      clearInterval(reloj);
      vaciar(estado).appendChild(h('div', { class: 'aviso-error', role: 'alert' }, [h('b', { text: 'No se puede dar este sorteo por válido' }), h('p', { text: txt })]));
    }

    /* ganadores, con animación solo si la gente estaba esperando; los suplentes van aparte */
    function revelar(g) {
      var gp = g.filter(function (x) { return !esSuplente(x.premio); }), gs = g.filter(function (x) { return esSuplente(x.premio); });
      if (!gp.length) { gp = g; gs = []; }
      var lista = h('ol', { class: 'sv-ganadores' }), listaSup = h('ol', { class: 'sv-suplentes' });
      var cajaSup = h('div', { class: 'sv-suplentes-caja', hidden: true }, [h('span', { class: 'l', text: gs.length > 1 ? 'Suplentes, en orden' : 'Suplente' }), listaSup]);
      vaciar(estado).appendChild(h('div', { class: 'sv-resultado' }, [h('span', { class: 'l', text: gp.length > 1 ? 'Ganadores' : 'Ganador' }), lista, gs.length ? cajaSup : null]));
      var animar = abiertoAntes && !REDUCIDO && op.pantalla;
      var i = 0;
      (function siguiente() {
        if (!vivo) return;
        if (i >= gp.length) {
          if (animar) confeti();
          if (!gs.length) return;
          gs.forEach(function (x) { listaSup.appendChild(filaGanador(x, true)); });
          if (animar) despues(function () { cajaSup.hidden = false; }, 2500); else cajaSup.hidden = false;
          return;
        }
        var x = gp[i++], fila = filaGanador(x);
        lista.appendChild(fila);
        if (!animar) { siguiente(); return; }
        var nombre = fila.querySelector('.et'), t0 = Date.now(), dur = 2600;
        fila.classList.add('girando');
        (function rodar() {
          if (!vivo) return;
          var p = (Date.now() - t0) / dur;
          if (p >= 1) { nombre.textContent = textoGanador(x); fila.classList.remove('girando'); fila.classList.add('listo'); despues(siguiente, i < gp.length ? 1600 : 150); return; }
          var azar = Math.floor(Math.random() * s.participantes.length);
          nombre.textContent = (nombreDe && nombreDe(azar + 1)) || s.participantes[azar][0];
          despues(rodar, 40 + 260 * p * p);
        })();
      })();
    }
    function filaGanador(x, suplente) {
      if (suplente) return h('li', { class: 'sv-suplente' }, [h('b', { class: 'et', text: textoGanador(x) }), h('small', { text: ' · ' + x.premio + ' · n.º ' + x.posicion.toLocaleString('es-CO') })]);
      return h('li', { class: 'sv-ganador' }, [
        h('span', { class: 'pr', text: x.premio }),
        h('b', { class: 'et', text: textoGanador(x) }),
        h('small', { text: (nombreDe ? x.etiqueta + ' · ' : '') + 'N.º ' + x.posicion.toLocaleString('es-CO') + ' de la lista' }),
        x.revelado ? h('small', { class: 'revelado' }, [marca(true), ' Código revelado por el organizador y comprobado: ' + x.revelado]) : null
      ]);
    }
    // Después del sorteo el organizador puede revelar (código, sal) del ganador: se comprueba contra su compromiso.
    function marcarRevelados(g) {
      if (!Array.isArray(s.revelaciones)) return Promise.resolve();
      return Promise.all(g.map(function (x) {
        var rev = s.revelaciones.filter(function (r) { return r && r.posicion === x.posicion; })[0];
        return rev ? N.comprobarRevelacion(s, rev).then(function (ok) { if (ok) x.revelado = rev.id; }) : null;
      }));
    }

    /* panel «Compruébalo tú mismo» */
    function pintarVerificacion() {
      if (op.pantalla) return;
      var r = res.ronda;
      vaciar(verif).appendChild(h('h2', { text: 'Compruébalo tú mismo' }));
      verif.appendChild(h('ol', { class: 'pasos' }, [
        h('li', null, [marca(res.huellaOk), h('div', null, [
          h('b', { text: 'La lista no cambió' }),
          h('p', { text: 'Tu navegador recalculó la huella (SHA-256) del acta con los ' + s.participantes.length.toLocaleString('es-CO') + ' participantes. Debe ser la misma que mostramos antes del sorteo: ' + corta(s.huella) + '…' }),
          !isNaN(publicado) && publicado < hora ? h('p', { text: 'Esta lista se publicó en labssummit.com a las ' + horaCol(publicado, true) + ', ' + minutos(hora - publicado) + ' antes de que saliera el número de drand.' }) : null
        ])]),
        h('li', null, [marca(r ? true : null), h('div', null, [
          h('b', { text: 'El azar no lo eligió nadie del evento' }),
          h('p', { text: r
            ? 'Ronda ' + r.ronda.toLocaleString('es-CO') + ' de drand quicknet (salió a las ' + horaCol(hora, true) + '). Su firma BLS se verificó en tu navegador con la clave pública de la League of Entropy.'
            : 'Se usará la ronda ' + s.azar.ronda.toLocaleString('es-CO') + ' de drand quicknet, que sale a las ' + horaCol(hora, true) + ' del ' + fechaCol(hora) + '. Antes de esa hora nadie, ni nosotros, puede saber el número.' }),
          r ? h('p', { class: 'mono', text: 'número aleatorio: ' + r.aleatorio }) : null,
          r ? h('a', { href: r.url, rel: 'noopener noreferrer', target: '_blank', text: 'Ver la ronda en drand' }) : null
        ])]),
        h('li', null, [marca(res.ganadores.length ? true : null), h('div', null, [
          h('b', { text: 'El resultado sale de una fórmula pública' }),
          h('p', { text: 'Ganador = sha256(«' + N.FORMATO + '|huella|número aleatorio|premio|intento») convertido en número, módulo los que quedan. Se descartan los valores que darían ventaja a alguien. Cualquier computador da el mismo resultado.' }),
          res.ganadores.length ? h('ul', { class: 'mono' }, res.ganadores.map(function (x) { return h('li', { text: 'premio ' + x.numeroPremio + ' → n.º ' + x.posicion + ' (semilla ' + x.semilla.slice(0, 16) + '…)' }); })) : null,
          h('a', { href: '/sorteos/verificar.py', download: 'verificar.py', text: 'Descargar el verificador en Python' })
        ])])
      ]));
    }

    return control;
  }

  /* ---------------- buscador «¿Estoy participando?» y lista ---------------- */
  function buscador(s) {
    var indice = s.participantes.map(function (p, i) { return normal((i + 1) + ' ' + p[0]); });
    var salida = h('div', { class: 'sv-resultados', 'aria-live': 'polite' });
    var input = h('input', { type: 'search', id: 'sv-buscar', autocomplete: 'off', placeholder: 'Tu nombre o los últimos 4 dígitos', 'aria-describedby': 'sv-buscar-ayuda' });
    var lista = h('ol', { class: 'sv-lista' }), verMas = h('button', { type: 'button', class: 'btn sec', text: 'Ver más' });
    var mostrados = 0;
    function pintarLista(n) {
      for (var i = mostrados; i < Math.min(n, s.participantes.length); i++) {
        lista.appendChild(h('li', { value: i + 1, text: s.participantes[i][0] }));
      }
      mostrados = Math.min(n, s.participantes.length);
      verMas.hidden = mostrados >= s.participantes.length;
    }
    verMas.addEventListener('click', function () { pintarLista(mostrados + 200); });
    input.addEventListener('input', function () {
      var q = normal(input.value.trim()).replace(/^…/, '');
      vaciar(salida);
      if (q.length < 2) return;
      var hallados = [];
      for (var i = 0; i < indice.length && hallados.length < 50; i++) if (indice[i].indexOf(q) >= 0) hallados.push(i);
      if (!hallados.length) { salida.appendChild(h('p', { class: 'nada', text: 'No encontramos a nadie con «' + input.value.trim() + '». Prueba con otra parte de tu nombre o con los últimos 4 dígitos.' })); return; }
      salida.appendChild(h('p', { text: hallados.length >= 50 ? 'Más de 50 coincidencias, escribe algo más preciso:' : hallados.length + (hallados.length === 1 ? ' coincidencia:' : ' coincidencias:') }));
      salida.appendChild(h('ul', null, hallados.map(function (i) { return h('li', null, [h('b', { text: 'n.º ' + (i + 1) }), ' ', s.participantes[i][0]]); })));
    });
    pintarLista(100);
    return h('section', { class: 'sv-busqueda' }, [
      h('h2', null, [h('label', { for: 'sv-buscar', text: '¿Estoy participando?' })]),
      h('p', { id: 'sv-buscar-ayuda', class: 'ayuda', text: 'Cada participante aparece con su nombre abreviado y los últimos 4 dígitos de su celular o de su boleta. No publicamos documentos, correos ni teléfonos completos.' }),
      input, salida,
      h('details', { class: 'sv-todos' }, [h('summary', { text: 'Ver la lista completa (' + s.participantes.length.toLocaleString('es-CO') + ')' }), lista, verMas])
    ]);
  }

  window.LSVista = { mostrar: mostrar, h: h, vaciar: vaciar, horaCol: horaCol, fechaCol: fechaCol, descargar: descargar };
})();
