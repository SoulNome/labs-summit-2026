/* Labs Summit 2026 · página pública de sorteos (/sorteos/)
   /sorteos/                  → lista de sorteos (los publicados en /api/sorteos y en sorteos/datos/indice.json)
   /sorteos/?id=<id>          → un sorteo con su verificación
   /sorteos/?id=<id>&pantalla → versión para la pantalla grande del evento */
(function () {
  'use strict';

  var N = window.LSSorteo, V = window.LSVista, h = V.h;
  var params = new URLSearchParams(location.search);
  var id = params.get('id');
  var pantalla = params.has('pantalla');
  var control = null;
  var $ = function (s) { return document.getElementById(s); };

  function pedirJSON(url) {
    return fetch(url, { cache: 'no-cache', credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error(r.status === 404 ? 'No encontramos ese sorteo.' : 'No se pudo cargar (error ' + r.status + ').');
      return r.json();
    });
  }

  // Lo que publica la herramienta del organizador al generar un sorteo (con la hora en que se publicó)
  function pedirAPI(url) {
    return fetch(url, { cache: 'no-cache', credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('api ' + r.status);
      return r.json().then(function (d) { return { d: d, publicado: r.headers.get('X-Sorteo-Publicado') }; });
    });
  }

  function mostrarSorteo(s, origen, publicado) {
    if (control) control.detener();
    $('sorteos').hidden = true;
    $('detalle').hidden = false;
    document.body.classList.toggle('modo-pantalla', pantalla);
    control = V.mostrar($('vista'), s, { pantalla: pantalla, origen: origen, publicado: publicado });
    if (pantalla) $('vista').appendChild(h('p', { class: 'sv-pie-pantalla', text: 'Verifícalo en tu celular: labssummit.com/sorteos' }));
    if (s && typeof s.titulo === 'string') document.title = s.titulo + ' · Sorteos Labs Summit 2026';
    if (!pantalla) $('detalle').scrollIntoView({ block: 'start' });
  }

  function errorDetalle(msg) {
    $('sorteos').hidden = true;
    $('detalle').hidden = false;
    V.vaciar($('vista')).appendChild(h('div', { class: 'aviso-error', role: 'alert' }, [h('b', { text: msg })]));
  }

  function tarjeta(x) {
    var hora = N.horaDeRonda(x.ronda), proximo = hora > Date.now();
    return h('a', { class: 'tarjeta' + (proximo ? ' prox' : ''), href: '/sorteos/?id=' + encodeURIComponent(x.id) }, [
      h('span', { class: 'estado-t', text: proximo ? 'Próximo' : 'Realizado' }),
      x.ensayo ? h('span', { class: 'sello-ensayo', text: 'Ensayo' }) : null,
      h('b', { class: 'tt', text: x.titulo }),
      h('span', { class: 'cuando', text: V.fechaCol(hora) + ' · ' + V.horaCol(hora) }),
      h('span', { class: 'cuantos', text: (x.participantes || 0).toLocaleString('es-CO') + ' participaciones · huella ' + String(x.huella || '').slice(0, 8) })
    ]);
  }

  function listar() {
    var archivos = pedirJSON('/sorteos/datos/indice.json').then(function (ind) { return ind && Array.isArray(ind.sorteos) ? ind.sorteos : []; }, function () { return null; });
    var enVivo = pedirAPI('/api/sorteos').then(function (x) { return x.d && Array.isArray(x.d.sorteos) ? x.d.sorteos : []; }, function () { return null; });
    Promise.all([archivos, enVivo]).then(function (xs) {
      if (xs[0] === null && xs[1] === null) throw new Error('sin lista');
      var caja = V.vaciar($('lista-sorteos')), porId = Object.create(null);
      (xs[0] || []).concat(xs[1] || []).forEach(function (x) {
        if (x && typeof x.id === 'string' && N.RE_ID.test(x.id) && typeof x.titulo === 'string' && Number.isSafeInteger(x.ronda) && x.ronda > 0) porId[x.id] = x;
      });
      var lista = Object.keys(porId).map(function (k) { return porId[k]; });
      if (!lista.length) {
        caja.appendChild(h('p', { class: 'vacio', text: 'Aún no hay sorteos publicados. Cuando cerremos la lista de un sorteo, aparecerá aquí con su huella y la hora exacta.' }));
        return;
      }
      var ahora = Date.now();
      lista.sort(function (a, b) {
        var ha = N.horaDeRonda(a.ronda), hb = N.horaDeRonda(b.ronda), pa = ha > ahora, pb = hb > ahora;
        if (pa !== pb) return pa ? -1 : 1;
        return pa ? ha - hb : hb - ha;
      });
      lista.forEach(function (x) { caja.appendChild(tarjeta(x)); });
    }).catch(function () {
      V.vaciar($('lista-sorteos')).appendChild(h('p', { class: 'vacio', text: 'No se pudo cargar la lista de sorteos. Revisa tu conexión y recarga la página.' }));
    });
  }

  if (id !== null) {
    if (!N.RE_ID.test(id)) errorDetalle('Ese enlace de sorteo no es válido.');
    else pedirAPI('/api/sorteos?id=' + encodeURIComponent(id)).catch(function () {
      return pedirJSON('/sorteos/datos/' + id + '.json').then(function (d) { return { d: d, publicado: null }; });
    }).then(function (x) {
      if (!x.d || x.d.id !== id) throw new Error('El archivo no corresponde a este sorteo.');
      mostrarSorteo(x.d, null, x.publicado);
    }).catch(function (e) { errorDetalle(e.message || 'No se pudo cargar el sorteo.'); });
  } else listar();

  $('archivo').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0], err = $('archivo-error');
    err.hidden = true;
    if (!f) return;
    if (f.size > 25e6) { err.textContent = 'El archivo es demasiado grande para ser un sorteo.'; err.hidden = false; return; }
    f.text().then(JSON.parse).then(function (s) {
      pantalla = false;
      mostrarSorteo(s, 'Estás verificando el archivo «' + f.name + '» desde tu equipo. Si alguien lo cambió, la huella no coincidirá con la publicada.');
    }, function () { err.textContent = 'Ese archivo no es un sorteo válido.'; err.hidden = false; });
  });
})();
