/* ==========================================================================
   Labs Summit 2026 · Mapa interactivo del 29 de octubre
   Interfaz, cámara, agenda en vivo, «Mi agenda», rutas, QR («Estás aquí»),
   recorridos 3D, modo lista y funcionamiento sin señal.
   ========================================================================== */
(function () {
  'use strict';

  var D = window.LS_EVENTO;
  var params = new URLSearchParams(location.search);
  var DEV = params.has('dev');
  var REDUCIDO = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TACTIL = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  // Calidad gráfica. Los iPhone no informan memoria y reportan pocos núcleos,
  // así que solo se baja la calidad en equipos que de verdad son limitados;
  // si aun así el teléfono va lento, la resolución se ajusta sola (ver vigilar()).
  var CALIDAD = (function () {
    if (params.has('ligero')) return 'baja';
    if (params.has('completo')) return 'alta';
    var mem = navigator.deviceMemory, nucleos = navigator.hardwareConcurrency;
    if ((mem && mem <= 2) || (nucleos && nucleos <= 2)) return 'baja';
    if (mem && mem <= 4 && nucleos && nucleos <= 4) return 'media';
    return 'alta';
  })();
  var LIGERO = CALIDAD === 'baja';

  function $(s) { return document.querySelector(s); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function marcar(nombre, valor) { try { if (window.clarity) { window.clarity('set', nombre, valor); window.clarity('event', nombre + '_' + valor); } } catch (e) { /* sin analítica */ } }
  function leer(k, def) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function guardar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
  function enMovil() { return window.innerWidth < 900; }

  /* ---------------- datos ---------------- */
  var zonasDatos = {}, sesiones = {}, tipos = D.tipos;
  function indexar() {
    zonasDatos = Object.create(null); sesiones = Object.create(null);   // sin prototipo: ?z=__proto__ no es una zona
    D.zonas.forEach(function (z) { zonasDatos[z.id] = z; sesiones[z.id] = []; });
    D.agenda.forEach(function (s) { if (sesiones[s.zona]) sesiones[s.zona].push(s); });
    Object.keys(sesiones).forEach(function (k) { sesiones[k].sort(function (a, b) { return hm(a.inicio) - hm(b.inicio); }); });
  }

  /* ---------------- tiempo (hora de Colombia, UTC−5) ---------------- */
  function hm(s) { var p = s.split(':'); return (+p[0]) * 60 + (+p[1]); }
  function hora(min) {
    var h = Math.floor(min / 60), m = min % 60, h12 = h % 12 || 12;
    return h12 + ':' + (m < 10 ? '0' : '') + m + (h < 12 ? ' a. m.' : ' p. m.');
  }
  function ahora() {
    var t = params.get('t');
    if (t) {
      var m = t.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/);
      if (m) return { fecha: m[1], min: (+m[2]) * 60 + (+m[3]) };
    }
    var d = new Date(Date.now() - 5 * 3600e3);
    return { fecha: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes() };
  }
  function diasFaltan(n) {
    return Math.round((Date.parse(D.fecha + 'T00:00:00Z') - Date.parse(n.fecha + 'T00:00:00Z')) / 864e5);
  }
  function estadoZona(id, n) {
    n = n || ahora();
    var r = { dia: n.fecha === D.fecha, antes: n.fecha < D.fecha, despues: n.fecha > D.fecha, en: null, sig: null, abierta: null, horario: (D.horarios || {})[id] };
    var lista = sesiones[id] || [];
    if (r.dia) {
      for (var i = 0; i < lista.length; i++) {
        var s = lista[i];
        if (hm(s.inicio) <= n.min && n.min < hm(s.fin)) r.en = s;
        else if (hm(s.inicio) > n.min && !r.sig) r.sig = s;
      }
      if (r.horario) r.abierta = n.min >= hm(r.horario[0]) && n.min < hm(r.horario[1]);
    } else if (r.antes) {
      r.sig = lista[0] || null;
    }
    return r;
  }
  function zonasEnVivo() {
    var n = ahora(), s = {};
    Object.keys(sesiones).forEach(function (id) { var r = estadoZona(id, n); if (r.en && !r.en.pausa) s[id] = r.en; });
    return s;
  }

  /* ---------------- Mi agenda ---------------- */
  var miAgenda = leer('lsMiAgenda', []), avisados = leer('lsAvisados', []);
  function idSesion(s) { return s.zona + '@' + s.inicio; }
  function guardada(s) { return miAgenda.indexOf(idSesion(s)) >= 0; }
  function alternarGuardada(id) {
    var i = miAgenda.indexOf(id);
    if (i >= 0) miAgenda.splice(i, 1); else miAgenda.push(id);
    guardar('lsMiAgenda', miAgenda);
    return i < 0;
  }
  function porInicio(a, b) { return hm(a.inicio) - hm(b.inicio) || (a.zona < b.zona ? -1 : 1); }
  function proximaGuardada(n) {
    var lista = D.agenda.filter(guardada).sort(porInicio);
    if (n.fecha < D.fecha) return lista[0] || null;
    if (n.fecha > D.fecha) return null;
    for (var i = 0; i < lista.length; i++) if (hm(lista[i].fin) > n.min) return lista[i];
    return null;
  }

  /* ---------------- interfaz base ---------------- */
  var app = $('#app'), hoja = $('#hoja'), panel = $('#panel'), aviso = $('#aviso');
  var filtro = 'todo', seleccion = null, puntoQR = null, pestana = 'todo', rutaActiva = null;

  function construirFiltros() {
    var nav = $('#filtros');
    var html = '<button class="chip" data-f="todo" aria-pressed="true">Todo</button>';
    Object.keys(tipos).forEach(function (k) {
      html += '<button class="chip" data-f="' + k + '" aria-pressed="false"><i style="background:' + tipos[k].color + '"></i>' + esc(tipos[k].nombre) + '</button>';
    });
    nav.innerHTML = html;
    nav.addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      filtro = b.getAttribute('data-f');
      nav.querySelectorAll('.chip').forEach(function (c) { c.setAttribute('aria-pressed', c === b ? 'true' : 'false'); });
      if (seleccion && filtro !== 'todo' && zonasDatos[seleccion].tipo !== filtro) cerrarFicha();
      aplicarEstados();
      marcar('filtro', filtro);
    });
  }

  function mostrarAviso(txt) {
    aviso.textContent = txt;
    aviso.classList.add('ver');
    clearTimeout(mostrarAviso.t);
    mostrarAviso.t = setTimeout(function () { aviso.classList.remove('ver'); }, 3200);
  }

  /* ---------------- iconos ---------------- */
  var TRAZOS = {
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    compartir: '<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/>',
    cubo: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
    ruta: '<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8.2 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.8"/>',
    estrella: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    reloj: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
    pizarra: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8M7 9h6M7 12h4"/>',
    tienda: '<path d="M4 9.5L5.6 4h12.8L20 9.5"/><path d="M4 9.5h16a2.7 2.7 0 0 1-5.3 0 2.7 2.7 0 0 1-5.4 0 2.7 2.7 0 0 1-5.3 0z"/><path d="M5.5 12.5V20h13v-7.5M10 20v-4h4v4"/>',
    audifonos: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
    camara: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    taza: '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8.5 3.5v3M11.5 3.5v3"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    boleta: '<path d="M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4z"/><path d="M14 6v2.5M14 11v2M14 15.5V18"/>',
    bano: '<circle cx="8" cy="5" r="1.7"/><circle cx="16" cy="5" r="1.7"/><path d="M6.5 8.5h3l.6 6.5H9v5H7v-5H5.9zM14 8.5h4l1.5 7h-2V20h-3v-4.5h-2z"/>',
    candado: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.8 15.8a5 5 0 0 1 6.4 0"/><circle cx="12" cy="19" r="1"/>',
    regalo: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18M12 9v11M12 9c-1.5-3-5-4-5.5-1.8S10 9 12 9c2 0 6-0.5 5.5-1.8S13.5 6 12 9"/>',
    cubiertos: '<path d="M7 3v7a2 2 0 0 0 2 2v9M11 3v7a2 2 0 0 1-2 2M9 3v6"/><path d="M17 21V3c-2 1.5-3 4-3 7s1 4 3 4"/>',
    auto: '<path d="M5 16h14v-4l-2-5H7l-2 5z"/><path d="M5 12h14"/><circle cx="8" cy="16.5" r="1.6"/><circle cx="16" cy="16.5" r="1.6"/>'
  };
  var ICONO_ZONA = { auditorio: 'mic', workshops: 'pizarra', expositores: 'tienda', gastrolabs: 'cubiertos', cowork: 'wifi', kits: 'regalo', speakers: 'estrella', bebidas: 'taza', taquillas: 'boleta', banos: 'bano', banos2: 'bano', parqueo: 'auto', marcas: 'tienda', podcast: 'audifonos', foto: 'camara', cafe: 'taza', info: 'info', camerinos: 'candado' };
  function icono(n, tam) {
    return '<svg viewBox="0 0 24 24" width="' + (tam || 18) + '" height="' + (tam || 18) + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (TRAZOS[n] || '') + '</svg>';
  }

  function nombrePrincipal() { var z = zonasDatos.auditorio; return z ? z.nombre : 'el escenario principal'; }

  /* ---------------- franja inferior: estado del evento ---------------- */
  function textoEstado() {
    var n = ahora(), f = diasFaltan(n), mia = proximaGuardada(n);
    if (f > 1) return { t: 'Faltan ' + f + ' días', s: mia ? 'Tu primera charla guardada: ' + hora(hm(mia.inicio)) + ' · ' + mia.titulo : '29 de octubre · abrimos a las ' + hora(hm(D.abre)) };
    if (f === 1) return { t: 'Mañana es Labs Summit', s: 'Abrimos a las ' + hora(hm(D.abre)) + '. Guarda este mapa.' };
    if (f < 0) return { t: 'Gracias por vivir Labs Summit 2026', s: 'Nos vemos en la próxima edición.' };
    if (n.min < hm(D.abre)) return { t: 'Hoy es Labs Summit', s: 'Abrimos a las ' + hora(hm(D.abre)) };
    if (n.min >= hm(D.cierra)) return { t: 'Terminó el día', s: 'Gracias por venir. Comparte tus fotos con @labssummit' };
    if (mia && hm(mia.inicio) > n.min && hm(mia.inicio) - n.min <= 60) {
      return { t: 'Tu próxima charla · ' + hora(hm(mia.inicio)), s: mia.titulo + ' · ' + zonasDatos[mia.zona].nombre, mia: true };
    }
    var en = estadoZona('auditorio', n).en;
    if (en && !en.pausa) return { t: 'En vivo en ' + nombrePrincipal(), s: en.titulo + ' · hasta ' + hora(hm(en.fin)), vivo: true };
    var sig = estadoZona('auditorio', n).sig;
    if (sig) return { t: 'Siguiente en ' + nombrePrincipal() + ' · ' + hora(hm(sig.inicio)), s: sig.titulo };
    return { t: 'Estamos abiertos', s: 'Hasta las ' + hora(hm(D.cierra)) };
  }

  function pintarFranja() {
    var e = textoEstado();
    $('#franja-t').innerHTML = (e.vivo ? '<span class="punto-vivo"></span>' : e.mia ? '<span class="estrella-mini">' + icono('estrella', 14) + '</span>' : '') + esc(e.t);
    $('#franja-s').textContent = e.s;
  }

  /* ---------------- ficha de zona ---------------- */
  function bloqueVivo(id) {
    var r = estadoZona(id), html = '', lista = sesiones[id] || [];
    if (r.antes) {
      if (r.sig) html += '<div class="fila"><span class="rot">29 oct</span>Primera sesión ' + hora(hm(r.sig.inicio)) + ' · ' + esc(r.sig.titulo) + '</div>';
      else if (r.horario) html += '<div class="fila"><span class="rot">29 oct</span>Abierto de ' + hora(hm(r.horario[0])) + ' a ' + hora(hm(r.horario[1])) + '</div>';
      return html;
    }
    if (r.despues) return '<div class="fila">El evento ya terminó.</div>';
    if (r.en) html += '<div class="fila ahora"><span class="rot vivo">' + (r.en.pausa ? 'Pausa' : 'En vivo') + '</span>' + esc(r.en.titulo) + ' · hasta ' + hora(hm(r.en.fin)) + '</div>';
    if (r.sig) html += '<div class="fila"><span class="rot">' + hora(hm(r.sig.inicio)) + '</span>Siguiente: ' + esc(r.sig.titulo) + (guardada(r.sig) ? ' <span class="estrella-mini">' + icono('estrella', 13) + '</span>' : '') + '</div>';
    if (!r.en && !r.sig && lista.length) html += '<div class="fila">Terminaron las sesiones de hoy en esta zona.</div>';
    if (r.horario && lista.length && r.abierta) html += '<div class="fila"><span class="rot">Abierto</span>Hasta las ' + hora(hm(r.horario[1])) + '</div>';
    if (r.horario && !lista.length) {
      html += r.abierta
        ? '<div class="fila ahora"><span class="rot vivo">Abierto</span>Hasta las ' + hora(hm(r.horario[1])) + '</div>'
        : '<div class="fila"><span class="rot">Cerrado</span>Horario: ' + hora(hm(r.horario[0])) + ' a ' + hora(hm(r.horario[1])) + '</div>';
    }
    return html;
  }

  function pintarFicha(id) {
    var z = zonasDatos[id]; if (!z) return;
    var t = tipos[z.tipo] || { nombre: '', color: '#C9AEFF' };
    var con3d = tieneInterior(id), conRuta = !!(mapa && mapa.tieneRuta(id));
    var html = '<button class="cerrar" id="cerrar-ficha" aria-label="Cerrar ficha">' + icono('x') + '</button>';
    html += '<div class="cab"><div class="tipo" style="--c:' + t.color + '"><span class="ico">' + icono(ICONO_ZONA[id] || 'info', 15) + '</span>' + esc(t.nombre) + (z.lugar ? ' · ' + esc(z.lugar) : '') + '</div>';
    html += '<h2>' + esc(z.nombre) + '</h2></div>';
    if (rutaActiva && rutaActiva.id === id) {
      var ri = rutaActiva.info;
      html += '<div class="ruta-info">' + icono('ruta', 18) + '<div>' +
        (ri.mismo ? '<b>Estás aquí mismo</b>' : '<b>≈ ' + ri.minutos + ' min caminando</b> · ' + ri.metros + ' m ' + esc(ri.desde)) +
        '</div><button class="btn-txt" data-accion="quitar-ruta">Quitar</button></div>';
    }
    var vivo = bloqueVivo(id);
    if (vivo) html += '<div class="vivo-bloque">' + vivo + '</div>';
    if (!z.privado) {
      html += '<div class="acciones">';
      if (con3d) html += '<button class="btn neon ancho" data-accion="3d">' + icono('cubo') + 'Entrar en 3D</button>';
      if (conRuta && !(rutaActiva && rutaActiva.id === id)) html += '<button class="btn sec" data-accion="ruta">' + icono('ruta') + 'Cómo llegar</button>';
      if ((sesiones[id] || []).length) html += '<button class="btn sec" data-accion="agenda-zona">' + icono('reloj') + 'Horarios</button>';
      html += '<button class="btn sec" data-accion="compartir">' + icono('compartir') + 'Compartir</button>';
      html += '<a class="btn pri" href="/#tickets" data-accion="comprar">Comprar entrada</a>';
      html += '</div>';
    }
    if (z.foto) {
      html += '<div class="foto' + (con3d ? ' clic' : '') + '"' + (con3d ? ' data-accion="3d" role="button" tabindex="0" aria-label="Entrar en 3D a ' + esc(z.nombre) + '"' : '') + '>' +
        '<img src="' + z.foto + '" alt="' + esc(z.nombre) + '" loading="lazy" decoding="async" width="720" height="405">' +
        (con3d ? '<span class="ver3d">' + icono('cubo') + 'Ver en 3D</span>' : '') + '</div>';
    }
    html += '<p class="texto">' + esc(z.texto || '') + '</p>';
    if (D.agendaDeEjemplo && (sesiones[id] || []).length) html += '<div class="nota">Horarios de ejemplo: la agenda oficial se publica antes del evento.</div>';
    if (DEV && z.confirmar) html += '<div class="nota dev">Ubicación por confirmar con logística.</div>';
    $('#ficha').innerHTML = html;
    $('#ficha').hidden = false;
    $('#franja').hidden = true;
  }

  function abrirFicha(id) {
    var yaAbierta = hoja.classList.contains('abierta');
    pintarFicha(id);
    hoja.classList.add('abierta');
    if (!yaAbierta) hoja.classList.remove('expandida');
    app.classList.add('con-ficha');
    hoja.scrollTop = 0;
  }

  function cerrarFicha() {
    seleccion = null;
    quitarRuta();
    $('#ficha').hidden = true;
    $('#franja').hidden = false;
    hoja.classList.remove('abierta', 'expandida');
    app.classList.remove('con-ficha');
    actualizarURL();
    aplicarEstados();
    if (mapa) mapa.soltar();
  }

  function expandirHoja(si) {
    if (!enMovil() || !hoja.classList.contains('abierta')) return;
    hoja.classList.toggle('expandida', si);
    if (!si) hoja.scrollTop = 0;
    if (mapa && seleccion) setTimeout(function () { if (rutaActiva) mapa.encuadrarRuta(); else mapa.enfocar(seleccion, true); }, 340);
  }

  hoja.addEventListener('click', function (e) {
    if (e.target.closest('#cerrar-ficha')) { cerrarFicha(); return; }
    if (e.target.closest('.agarre') && !hoja.arrastrado) { if (hoja.classList.contains('abierta')) expandirHoja(!hoja.classList.contains('expandida')); return; }
    var a = e.target.closest('[data-accion]'); if (!a) return;
    var acc = a.getAttribute('data-accion');
    if (acc === 'compartir') compartir(seleccion);
    if (acc === 'agenda-zona') abrirPanel(zonasDatos[seleccion].corto);
    if (acc === 'comprar') marcar('comprar', seleccion || 'mapa');
    if (acc === '3d') abrir3D(seleccion);
    if (acc === 'ruta') mostrarRuta(seleccion);
    if (acc === 'quitar-ruta') { quitarRuta(); pintarFicha(seleccion); }
  });
  hoja.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.foto.clic')) { e.preventDefault(); abrir3D(seleccion); }
  });

  // Hoja inferior arrastrable en celular: arriba = más información, abajo = más mapa (o cerrar)
  (function () {
    var arr = null;
    hoja.addEventListener('pointerdown', function (e) {
      if (!enMovil() || !hoja.classList.contains('abierta')) return;
      if (!e.target.closest('.agarre, .cab') || e.target.closest('button')) return;
      arr = { y: e.clientY, dy: 0, id: e.pointerId };
      hoja.arrastrado = false;
      try { hoja.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
    });
    hoja.addEventListener('pointermove', function (e) {
      if (!arr) return;
      arr.dy = e.clientY - arr.y;
      if (Math.abs(arr.dy) > 6) { hoja.arrastrado = true; hoja.classList.add('arrastrando'); }
      hoja.style.transform = arr.dy > 0 ? 'translateY(' + arr.dy + 'px)' : '';
    });
    function soltar() {
      if (!arr) return;
      var dy = arr.dy;
      arr = null;
      hoja.style.transform = '';
      hoja.classList.remove('arrastrando');
      if (!hoja.arrastrado) return;
      setTimeout(function () { hoja.arrastrado = false; }, 0);
      if (dy < -30) expandirHoja(true);
      else if (dy > 60) { if (hoja.classList.contains('expandida')) expandirHoja(false); else cerrarFicha(); }
    }
    hoja.addEventListener('pointerup', soltar);
    hoja.addEventListener('pointercancel', soltar);
  })();

  /* ---------------- cómo llegar ---------------- */
  function mostrarRuta(id) {
    if (!mapa) return;
    var info = mapa.ruta(id);
    if (!info) { mostrarAviso('Aún no tenemos el camino a esta zona'); return; }
    rutaActiva = { id: id, info: info };
    if (enMovil()) hoja.classList.remove('expandida');
    pintarFicha(id);
    setTimeout(function () { if (mapa) mapa.encuadrarRuta(); }, enMovil() ? 340 : 30);
    marcar('ruta', id);
  }
  function quitarRuta() {
    if (!rutaActiva) return;
    rutaActiva = null;
    if (mapa) mapa.quitarRuta();
  }

  /* ---------------- recorridos 3D ---------------- */
  var empujado = false, zona3d = null;
  function tieneInterior(id) { return !!(mapa && window.LSInteriores && window.LSInteriores.tiene(id)); }
  function abrir3D(id) {
    if (!tieneInterior(id)) return;
    if (!mapa.enInterior() && !empujado) {
      try { history.pushState({ ls3d: id }, '', location.href); empujado = true; } catch (e) { /* sin historial */ }
    }
    zona3d = id;
    seleccion = id;
    pintarInterior(id);
    var vivo = zonasEnVivo()[id];
    mapa.entrar(id, { vivo: vivo ? vivo.titulo : null });
    actualizarURL();
    marcar('recorrido3d', id);
  }
  function cerrar3D() {
    if (!mapa || !mapa.enInterior()) return;
    var id = zona3d;
    mapa.salir(function () {
      zona3d = null;
      actualizarURL();
      if (id) seleccionar(id, true);
    });
  }
  function botonSalir3D() {
    if (empujado) { history.back(); } else cerrar3D();
  }
  window.addEventListener('popstate', function () {
    if (mapa && mapa.enInterior()) { empujado = false; cerrar3D(); }
  });
  function pintarInterior(id) {
    var z = zonasDatos[id], t = tipos[z.tipo] || {};
    $('#int-tipo').innerHTML = '<i style="background:' + t.color + '"></i>' + esc(t.nombre) + (z.lugar ? ' · ' + esc(z.lugar) : '');
    $('#int-nombre').textContent = z.nombre;
    var vivo = bloqueVivo(id);
    $('#int-vivo').innerHTML = vivo;
    $('#int-vivo').hidden = !vivo;
    var chips = '';
    window.LSInteriores.zonas.forEach(function (zid) {
      var dz = zonasDatos[zid]; if (!dz) return;
      var tc = (tipos[dz.tipo] || {}).color;
      chips += '<button class="chip" data-int="' + zid + '" aria-pressed="' + (zid === id) + '" style="--c:' + tc + '"><span class="ico">' + icono(ICONO_ZONA[zid] || 'info', 14) + '</span>' + esc(dz.corto) + '</button>';
    });
    $('#int-zonas').innerHTML = chips;
    var activo = $('#int-zonas [aria-pressed="true"]');
    if (activo && activo.scrollIntoView) activo.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
  $('#int-salir').addEventListener('click', botonSalir3D);
  $('#int-giro').addEventListener('click', function () {
    var on = mapa && mapa.giro();
    this.setAttribute('aria-pressed', on ? 'true' : 'false');
    this.setAttribute('aria-label', on ? 'Pausar el giro' : 'Girar solo');
  });
  $('#int-zonas').addEventListener('click', function (e) {
    var b = e.target.closest('[data-int]'); if (!b) return;
    var id = b.getAttribute('data-int');
    if (id !== zona3d) abrir3D(id);
  });
  $('#btn-franja-agenda').addEventListener('click', function () { abrirPanel(''); });

  function compartir(id) {
    var z = zonasDatos[id];
    var url = location.origin + '/mapa/?z=' + encodeURIComponent(id);
    var datos = { title: 'Labs Summit 2026 · ' + z.nombre, text: 'Nos vemos en ' + z.nombre + ' · 29 de octubre', url: url };
    marcar('compartir', id);
    if (navigator.share) { navigator.share(datos).catch(function () {}); return; }
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { mostrarAviso('Enlace copiado'); }, function () { mostrarAviso(url); });
    else mostrarAviso(url);
  }

  function actualizarURL() {
    var p = new URLSearchParams(location.search);
    if (seleccion) p.set('z', seleccion); else p.delete('z');
    if (zona3d) p.set('ver', '3d'); else p.delete('ver');
    var q = p.toString();
    try { history.replaceState(history.state, '', location.pathname + (q ? '?' + q : '')); } catch (e) { /* sin historial */ }
  }

  /* ---------------- panel de agenda, búsqueda y Mi agenda ---------------- */
  function abrirPanel(busqueda) {
    panel.hidden = false;
    app.classList.add('con-panel');
    var inp = $('#buscar');
    inp.value = busqueda || '';
    pintarAgenda();
    if (!busqueda && !TACTIL) inp.focus();
    marcar('panel', 'agenda');
  }
  function cerrarPanel() { panel.hidden = true; app.classList.remove('con-panel'); }

  function normal(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  function pintarAgenda() {
    var q = normal($('#buscar').value.trim()), n = ahora(), html = '';
    var lista = D.agenda.slice().sort(porInicio);
    var hoy = n.fecha === D.fecha;
    var soloMia = pestana === 'mia';
    lista.forEach(function (s) {
      var z = zonasDatos[s.zona]; if (!z) return;
      if (soloMia && !guardada(s)) return;
      if (q && normal(s.titulo + ' ' + z.nombre + ' ' + z.corto).indexOf(q) < 0) return;
      var t = tipos[z.tipo] || {}, cls = 'item';
      var vivo = hoy && hm(s.inicio) <= n.min && n.min < hm(s.fin);
      if (hoy && n.min >= hm(s.fin)) cls += ' pasado';
      if (vivo) cls += ' vivo';
      var g = guardada(s), sid = idSesion(s);
      html += '<li class="fila-ag"><button class="' + cls + '" data-zona="' + s.zona + '">' +
        '<span class="h"><b>' + hora(hm(s.inicio)).split(' ')[0] + '</b><small>' + hora(hm(s.inicio)).split(' ').slice(1).join('&nbsp;') + '</small></span>' +
        '<span class="c"><b>' + esc(s.titulo) + '</b><small><i style="background:' + t.color + '"></i>' + esc(z.nombre) + ' · hasta ' + hora(hm(s.fin)) + '</small></span>' +
        (vivo ? '<span class="tag">En vivo</span>' : '') + '</button>' +
        (s.pausa ? '' : '<button class="estrella" data-ses="' + sid + '" aria-pressed="' + g + '" aria-label="' + (g ? 'Quitar de mi agenda' : 'Guardar en mi agenda') + ': ' + esc(s.titulo) + '">' + icono('estrella', 20) + '</button>') + '</li>';
    });
    var zonasHtml = '';
    if (!soloMia) {
      D.zonas.forEach(function (z) {
        if (z.privado) return;
        if (q && normal(z.nombre + ' ' + z.corto + ' ' + (z.texto || '')).indexOf(q) < 0) return;
        var t = tipos[z.tipo] || {};
        zonasHtml += '<li><button class="item zona" data-zona="' + z.id + '" style="--c:' + t.color + '"><span class="ico">' + icono(ICONO_ZONA[z.id] || 'info', 18) + '</span><span class="c"><b>' + esc(z.nombre) + '</b><small>' + esc(z.lugar || t.nombre) + '</small></span></button></li>';
      });
    }
    var vacio = soloMia
      ? '<li class="vacio vacio-mia">' + icono('estrella', 28) + '<b>Aún no guardas charlas</b>Toca la estrella de una charla para tenerla aquí. Te avisamos 10 minutos antes de que empiece.</li>'
      : '<li class="vacio">No hay charlas con ese nombre.</li>';
    $('#lista-agenda').innerHTML = html || vacio;
    $('#lista-zonas').innerHTML = zonasHtml;
    $('#titulo-zonas').hidden = soloMia || !zonasHtml;
    $('#aviso-ejemplo').hidden = !D.agendaDeEjemplo;
    var cuenta = miAgenda.length;
    $('#cuenta-mia').textContent = cuenta ? cuenta : '';
    panel.querySelectorAll('.pestana').forEach(function (b) { b.setAttribute('aria-selected', b.getAttribute('data-tab') === pestana ? 'true' : 'false'); });
  }

  $('#buscar').addEventListener('input', pintarAgenda);
  $('#cerrar-panel').addEventListener('click', cerrarPanel);
  $('#btn-agenda').addEventListener('click', function () { panel.hidden ? abrirPanel('') : cerrarPanel(); });
  panel.addEventListener('click', function (e) {
    var tab = e.target.closest('.pestana');
    if (tab) { pestana = tab.getAttribute('data-tab'); pintarAgenda(); marcar('pestana', pestana); return; }
    var est = e.target.closest('.estrella');
    if (est) {
      var ahoraGuardada = alternarGuardada(est.getAttribute('data-ses'));
      mostrarAviso(ahoraGuardada ? 'Guardada en tu agenda' : 'Quitada de tu agenda');
      pintarAgenda(); pintarFranja();
      marcar('mi_agenda', ahoraGuardada ? 'guardar' : 'quitar');
      return;
    }
    var b = e.target.closest('[data-zona]'); if (!b) return;
    var id = b.getAttribute('data-zona');
    if (!app.classList.contains('sin3d')) cerrarPanel();
    seleccionar(id, true);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!$('#guia').hidden) { cerrarGuia(); return; }
    if (zona3d) { botonSalir3D(); return; }
    if (!panel.hidden && !app.classList.contains('sin3d')) cerrarPanel();
    else if (seleccion) cerrarFicha();
  });

  /* ---------------- recordatorios de Mi agenda ---------------- */
  function revisarRecordatorios() {
    var n = ahora();
    if (n.fecha !== D.fecha) return;
    D.agenda.forEach(function (s) {
      if (!guardada(s)) return;
      var falta = hm(s.inicio) - n.min, id = idSesion(s);
      if (falta > 0 && falta <= 10 && avisados.indexOf(id) < 0) {
        avisados.push(id); guardar('lsAvisados', avisados);
        mostrarRecordatorio(s, falta);
      }
    });
  }
  function mostrarRecordatorio(s, falta) {
    var z = zonasDatos[s.zona]; if (!z) return;
    var r = $('#recordatorio');
    r.innerHTML = '<span class="rec-ico">' + icono('reloj', 22) + '</span>' +
      '<div class="rec-txt"><b>Empieza en ' + falta + ' min</b><span>' + esc(s.titulo) + '</span><small>' + esc(z.nombre) + ' · ' + hora(hm(s.inicio)) + '</small></div>' +
      '<button class="btn pri" data-rec="ir" data-zona="' + s.zona + '">' + icono('ruta', 16) + 'Ir</button>' +
      '<button class="btn-ico" data-rec="x" aria-label="Cerrar aviso">' + icono('x') + '</button>';
    r.hidden = false;
    try {
      var activo = !navigator.userActivation || navigator.userActivation.hasBeenActive;
      if (navigator.vibrate && activo) navigator.vibrate([80, 60, 80]);
    } catch (e) { /* sin vibración */ }
  }
  $('#recordatorio').addEventListener('click', function (e) {
    var b = e.target.closest('[data-rec]'); if (!b) return;
    $('#recordatorio').hidden = true;
    if (b.getAttribute('data-rec') === 'ir') {
      var id = b.getAttribute('data-zona');
      if (zona3d) { cerrar3D(); setTimeout(function () { seleccionar(id, true); mostrarRuta(id); }, 500); }
      else { cerrarPanel(); seleccionar(id, true); mostrarRuta(id); }
    }
  });

  /* ---------------- selección ---------------- */
  function seleccionar(id, volar, desdeMapa) {
    if (!zonasDatos[id]) return;
    // tocar otra vez la zona ya elegida abre su recorrido 3D
    if (desdeMapa && seleccion === id && tieneInterior(id)) { abrir3D(id); return; }
    if (filtro !== 'todo' && zonasDatos[id].tipo !== filtro) {
      filtro = 'todo';
      $('#filtros').querySelectorAll('.chip').forEach(function (c) { c.setAttribute('aria-pressed', c.getAttribute('data-f') === 'todo' ? 'true' : 'false'); });
    }
    if (rutaActiva && rutaActiva.id !== id) quitarRuta();
    seleccion = id;
    abrirFicha(id);
    aplicarEstados();
    actualizarURL();
    if (mapa) mapa.enfocar(id, volar);
    marcar('zona', id);
  }

  function aplicarEstados() {
    if (mapa) { mapa.estados(filtro, seleccion); mapa.vivos(zonasEnVivo(), filtro); }
    pintarEtiquetasEstado();
  }

  /* ---------------- guía de primera vez ---------------- */
  function mostrarGuia() {
    var g = $('#guia');
    var pasos = TACTIL
      ? [['mic', 'Toca una zona para ver qué pasa ahí ahora.'], ['cubo', 'Tócala otra vez para entrar al espacio en 3D.'], ['ruta', 'Usa «Cómo llegar» para ver el camino.'], ['estrella', 'Guarda charlas en «Mi agenda» y te avisamos.']]
      : [['mic', 'Haz clic en una zona para ver qué pasa ahí ahora.'], ['cubo', 'Haz clic otra vez para entrar al espacio en 3D.'], ['ruta', 'Arrastra para moverte, rueda para acercar, clic derecho para girar.'], ['estrella', 'Guarda charlas en «Mi agenda» y te avisamos.']];
    $('#guia-pasos').innerHTML = pasos.map(function (p) { return '<li><span class="ico">' + icono(p[0], 20) + '</span>' + esc(p[1]) + '</li>'; }).join('');
    g.hidden = false;
    $('#guia-ok').focus();
  }
  function cerrarGuia() {
    $('#guia').hidden = true;
    guardar('lsGuiaVista', true);
  }
  $('#guia-ok').addEventListener('click', cerrarGuia);
  $('#guia').addEventListener('click', function (e) { if (e.target === this) cerrarGuia(); });

  /* ======================================================================
     MAPA 3D
     ====================================================================== */
  var mapa = null, etiquetas = {};

  function hayWebGL() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }

  function crearMapa(opcionesMapa) {
    var THREE = window.THREE;
    var lienzo = $('#lienzo');
    var renderer = new THREE.WebGLRenderer({ antialias: !LIGERO, powerPreference: LIGERO ? 'default' : 'high-performance' });
    // nitidez: en celulares de buena pantalla se dibuja casi a la resolución real
    var PR_MAX = Math.min(window.devicePixelRatio || 1, CALIDAD === 'alta' ? 2.5 : CALIDAD === 'media' ? 2 : 1.25);
    var pr = PR_MAX;
    renderer.setPixelRatio(pr);
    // sombras reales de edificios, gente y árboles: se calculan una sola vez (la maqueta no se mueve)
    var SOMBRAS = !LIGERO;
    if (SOMBRAS) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false; }
    lienzo.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-hidden', 'true');

    var colores = {};
    Object.keys(tipos).forEach(function (k) { colores[k] = tipos[k].color; });
    var M = window.LSEscena.construir(THREE, {
      ligero: LIGERO, calidad: CALIDAD, colores: colores, sombras: SOMBRAS,
      aniso: renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 4
    });
    var escena = M.escena, zonas = M.zonas, L = M.limites;
    if (SOMBRAS) renderer.shadowMap.needsUpdate = true;

    // brillo de neón real (bloom) con antialias multimuestra: el «look» de las luces del evento
    var composer = null, pasoRender = null, pasoBrillo = null;
    if (!LIGERO && THREE.EffectComposer && THREE.UnrealBloomPass) {
      try {
        var rtBrillo = new THREE.WebGLRenderTarget(2, 2, { samples: renderer.capabilities.isWebGL2 ? 4 : 0 });
        composer = new THREE.EffectComposer(renderer, rtBrillo);
        pasoRender = new THREE.RenderPass(escena, null);
        composer.addPass(pasoRender);
        pasoBrillo = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.4, 0.78);
        composer.addPass(pasoBrillo);
      } catch (errBrillo) { composer = null; }
    }
    function dibujar(sc, cam) {
      if (composer) {
        pasoRender.scene = sc; pasoRender.camera = cam;
        pasoBrillo.strength = sc === escena ? 0.5 : 0.42;
        composer.render();
      } else renderer.render(sc, cam);
    }
    // si el teléfono no da abasto, baja un poco la resolución (y como último recurso el brillo)
    var muestras = [], ultimoCuadro = 0;
    function vigilar(t) {
      var d = t - ultimoCuadro; ultimoCuadro = t;
      if (d <= 0 || d > 200) return;
      muestras.push(d);
      if (muestras.length < 45) return;
      var prom = muestras.reduce(function (a, b) { return a + b; }, 0) / muestras.length;
      muestras = [];
      if (prom < 40) return;
      if (pr > 1.25) { pr = Math.max(1.25, pr - 0.5); renderer.setPixelRatio(pr); medir(); }
      else if (pasoBrillo && pasoBrillo.enabled) pasoBrillo.enabled = false;
    }

    var MITAD = 100;
    var camara = new THREE.OrthographicCamera(-MITAD, MITAD, MITAD, -MITAD, 1, 2000);
    // Vista inicial desde el sur, como el plano impreso (norte arriba), con un leve giro para dar volumen.
    var AZIMUT = 0.16, RADIO = 600;
    var V = M.vista || { centro: [13, 4], encuadre: [-82, 108, -58, 66] };
    var objetivo0 = new THREE.Vector3(V.centro[0], 0, V.centro[1]);
    function posicionar(t, az, pol) {
      camara.position.set(t.x + RADIO * Math.sin(pol) * Math.sin(az), RADIO * Math.cos(pol), t.z + RADIO * Math.sin(pol) * Math.cos(az));
      camara.lookAt(t);
      camara.updateMatrixWorld();
    }

    var controles = new THREE.OrbitControls(camara, renderer.domElement);
    controles.target.copy(objetivo0);
    controles.enableDamping = !REDUCIDO;
    controles.dampingFactor = 0.12;
    controles.screenSpacePanning = false;
    controles.minPolarAngle = 0.62;
    controles.maxPolarAngle = 1.12;
    controles.rotateSpeed = 0.6;
    controles.zoomSpeed = 1.1;
    controles.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    controles.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };

    /* --- tamaño --- */
    var ancho = 1, alto = 1, zoomBase = 1;
    function medir() {
      ancho = lienzo.clientWidth || window.innerWidth;
      alto = lienzo.clientHeight || window.innerHeight;
      var asp = ancho / alto;
      camara.left = -MITAD * asp; camara.right = MITAD * asp; camara.top = MITAD; camara.bottom = -MITAD;
      renderer.setSize(ancho, alto, false);
      if (composer) { composer.setPixelRatio(pr); composer.setSize(ancho, alto); }
      renderer.domElement.style.width = ancho + 'px';
      renderer.domElement.style.height = alto + 'px';
      camara.updateProjectionMatrix();
    }

    // Parte de la pantalla que no tapan la barra, los controles ni la ficha.
    function areaLibre() {
      var a = { x0: 8, x1: ancho - 8, y0: 112, y1: alto - 12 };
      if (ancho >= 900) {
        a.y1 = alto - 76;
        if (hoja.classList.contains('abierta')) a.x1 = ancho - hoja.offsetWidth - 40;
        if (!panel.hidden) a.x1 = Math.min(a.x1, ancho - 470);
      } else {
        a.x1 = ancho - 60;
        a.y1 = alto - (hoja.offsetHeight || 90) - 8;
      }
      if (a.y1 - a.y0 < 120) a.y0 = Math.max(60, a.y1 - 120);
      return a;
    }

    // Zoom para que un rectángulo del piso quepa en el área libre.
    var v = new THREE.Vector3();
    function zoomPara(x0, x1, z0, z1, alturaMax, area) {
      camara.updateMatrixWorld();
      var inv = camara.matrixWorldInverse;
      var mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity;
      [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].forEach(function (p) {
        [0, alturaMax].forEach(function (y) {
          v.set(p[0], y, p[1]).applyMatrix4(inv);
          mnx = Math.min(mnx, v.x); mxx = Math.max(mxx, v.x); mny = Math.min(mny, v.y); mxy = Math.max(mxy, v.y);
        });
      });
      var zx = (area.x1 - area.x0) / ancho * (camara.right - camara.left) / (mxx - mnx);
      var zy = (area.y1 - area.y0) / alto * (camara.top - camara.bottom) / (mxy - mny);
      return Math.min(zx, zy) * 0.94;
    }

    // Dónde poner el centro de la cámara para que el punto (x, z) quede en el medio del área libre.
    var vr = new THREE.Vector3(), vu = new THREE.Vector3(), vg = new THREE.Vector3();
    function objetivoPara(x, z, zoom, area) {
      camara.updateMatrixWorld();
      var e = camara.matrixWorld.elements;
      vr.set(e[0], e[1], e[2]); vu.set(e[4], e[5], e[6]);
      vg.set(vu.x, 0, vu.z); var lg = vg.length() || 1; vg.multiplyScalar(1 / lg);
      var upp = (camara.right - camara.left) / zoom / ancho;
      var cx = (area.x0 + area.x1) / 2 - ancho / 2;
      var cy = alto / 2 - (area.y0 + area.y1) / 2;
      return new THREE.Vector3(x, 0, z).addScaledVector(vr, -cx * upp).addScaledVector(vg, -cy * upp / lg);
    }

    function encuadreGeneral() {
      zoomBase = zoomPara(V.encuadre[0], V.encuadre[1], V.encuadre[2], V.encuadre[3], 12, areaLibre());
      controles.minZoom = zoomBase * 0.7;
      controles.maxZoom = zoomBase * 8;
      return zoomBase;
    }

    /* --- bucle a demanda: solo dibuja cuando algo cambia --- */
    var raf = 0, interactuando = false, animaciones = [];
    function pedir() { if (!raf) raf = requestAnimationFrame(cuadro); }
    function animar(dur, fn, fin) {
      if (REDUCIDO) dur = 1;
      animaciones.push({ t0: performance.now(), dur: dur, fn: fn, fin: fin });
      pedir();
    }
    function suave(k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }
    var ultimoZoom = -1, interior = null, ruta = null;
    function cuadro() {
      raf = 0;
      var ahoraMs = performance.now(), activas = false;
      for (var i = animaciones.length - 1; i >= 0; i--) {
        var a = animaciones[i], k = Math.min(1, (ahoraMs - a.t0) / a.dur);
        a.fn(suave(k));
        if (k >= 1) { animaciones.splice(i, 1); if (a.fin) a.fin(); } else activas = true;
      }
      if (interior) {
        var animando = !!interior.animar && (ahoraMs < interior.animarHasta || interior.ctrl.autoRotate || interior.moviendo);
        if (animando) interior.animar(ahoraMs / 1000);
        var movI = interior.intro ? false : interior.ctrl.update();
        dibujar(interior.escena, interior.cam);
        vigilar(ahoraMs);
        if (activas || movI || interior.moviendo || interior.ctrl.autoRotate || animando) pedir();
        return;
      }
      var rutaViva = false;
      if (ruta) {
        var s = (ahoraMs - ruta.t0) / 1000;
        ruta.flechas.offset.x = -((s * 0.8) % 1);
        var p = (s % 1.6) / 1.6;
        ruta.anillo.scale.setScalar(1 + p * 0.5);
        ruta.anillo.material.opacity = 0.9 * (1 - p);
        rutaViva = ahoraMs < ruta.hasta;
      }
      var movio = controles.update();
      limitar();
      dibujar(escena, camara);
      vigilar(ahoraMs);
      ubicarEtiquetas();
      if (camara.zoom !== ultimoZoom) {
        ultimoZoom = camara.zoom;
        app.classList.toggle('lejos', camara.zoom < zoomBase * 1.25);
      }
      if (activas || movio || interactuando || rutaViva) pedir();
    }
    controles.addEventListener('change', pedir);
    controles.addEventListener('start', function () { interactuando = true; app.classList.add('moviendo'); pedir(); });
    controles.addEventListener('end', function () { interactuando = false; app.classList.remove('moviendo'); pedir(); });

    var delta = new THREE.Vector3();
    function limitar() {
      var t = controles.target;
      var cx = Math.max(L.x0 + 5, Math.min(L.x1 - 5, t.x)), cz = Math.max(L.z0 + 5, Math.min(L.z1 - 5, t.z));
      if (cx !== t.x || cz !== t.z || t.y !== 0) {
        delta.set(cx - t.x, -t.y, cz - t.z);
        t.add(delta); camara.position.add(delta);
      }
    }

    /* --- movimientos de cámara --- */
    function volar(x, z, zoom, dur) {
      var t0 = controles.target.clone(), off = camara.position.clone().sub(t0);
      var t1 = objetivoPara(x, z, zoom, areaLibre()), z0 = camara.zoom;
      animar(dur || 750, function (k) {
        controles.target.lerpVectors(t0, t1, k);
        camara.position.copy(controles.target).add(off);
        camara.zoom = z0 + (zoom - z0) * k;
        camara.updateProjectionMatrix();
      });
    }
    var EJE_Y = new THREE.Vector3(0, 1, 0);
    function girar(dir) {
      var off0 = camara.position.clone().sub(controles.target), ang = dir * Math.PI / 2;
      animar(650, function (k) {
        camara.position.copy(controles.target).add(off0.clone().applyAxisAngle(EJE_Y, ang * k));
        camara.lookAt(controles.target);
      });
      marcar('girar', dir > 0 ? 'izq' : 'der');
    }
    function acercar(f) {
      var z0 = camara.zoom, z1 = Math.max(controles.minZoom, Math.min(controles.maxZoom, z0 * f));
      animar(300, function (k) { camara.zoom = z0 + (z1 - z0) * k; camara.updateProjectionMatrix(); });
    }
    function verTodo() {
      volar(objetivo0.x, objetivo0.z, encuadreGeneral(), 800);
    }

    /* --- selección, estados visuales y zonas en vivo --- */
    var elevado = null;
    function elevar(zona, alturaDestino) {
      var g = zona.grupo, y0 = g.position.y;
      animar(450, function (k) { g.position.y = y0 + (alturaDestino - y0) * k; });
    }
    function estados(f, sel) {
      Object.keys(zonas).forEach(function (id) {
        var dz = zonasDatos[id], z = zonas[id];
        var fuera = f !== 'todo' && dz && dz.tipo !== f;
        z.estado(fuera ? 'fuera' : sel ? (id === sel ? 'activo' : 'tenue') : 'normal');
      });
      var bajo = sel && zonas[sel] && zonas[sel].bajoSamanes;
      M.samanes.opacity = bajo ? 0.18 : 0.62;
      if (elevado && elevado !== sel && zonas[elevado]) elevar(zonas[elevado], 0);
      if (sel && zonas[sel] && elevado !== sel) elevar(zonas[sel], 1.2);
      elevado = sel || null;
      pedir();
    }
    function vivos(lista, f) {
      Object.keys(zonas).forEach(function (id) {
        var z = zonas[id]; if (!z.haz) return;
        var dz = zonasDatos[id];
        z.haz.visible = !!lista[id] && !(f !== 'todo' && dz && dz.tipo !== f);
      });
      pedir();
    }
    function enfocar(id, mover) {
      var z = zonas[id]; if (!z) return;
      if (mover === false) { pedir(); return; }
      var h = z.huella, pad = Math.max(8, z.tam * 0.35);
      var zoom = zoomPara(h[0] - pad, h[1] + pad, h[2] - pad, h[3] + pad, z.alto + 3, areaLibre());
      zoom = Math.max(zoomBase * 1.4, Math.min(controles.maxZoom, zoom));
      volar(z.centro.x, z.centro.z, zoom);
    }
    function soltar() { pedir(); }

    /* --- cómo llegar: camino más corto por la red de caminos --- */
    var red = M.red, vecinos = {};
    red.aristas.forEach(function (e) {
      (vecinos[e[0]] = vecinos[e[0]] || []).push(e[1]);
      (vecinos[e[1]] = vecinos[e[1]] || []).push(e[0]);
    });
    function largo(a, b) { return Math.sqrt((a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1])); }
    function nodoCercano(x, z) {
      var mejor = null, md = Infinity;
      Object.keys(red.nodos).forEach(function (n) { var d = largo(red.nodos[n], [x, z]); if (d < md) { md = d; mejor = n; } });
      return mejor;
    }
    function caminoMasCorto(a, b) {
      var dist = {}, prev = {}, pend = Object.keys(red.nodos);
      pend.forEach(function (n) { dist[n] = Infinity; });
      dist[a] = 0;
      while (pend.length) {
        pend.sort(function (x, y) { return dist[x] - dist[y]; });
        var u = pend.shift();
        if (u === b || dist[u] === Infinity) break;
        (vecinos[u] || []).forEach(function (w) {
          var d = dist[u] + largo(red.nodos[u], red.nodos[w]);
          if (d < dist[w]) { dist[w] = d; prev[w] = u; }
        });
      }
      if (dist[b] === Infinity) return null;
      var camino = [b];
      while (camino[0] !== a) camino.unshift(prev[camino[0]]);
      return camino;
    }
    function texturaLienzo(w, h, dibujar) {
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      dibujar(c.getContext('2d'), w, h);
      return new THREE.CanvasTexture(c);
    }
    var texFlecha = texturaLienzo(128, 64, function (x) {
      x.strokeStyle = '#ffffff'; x.lineWidth = 11; x.lineCap = 'round'; x.lineJoin = 'round';
      x.shadowColor = 'rgba(255,255,255,0.9)'; x.shadowBlur = 8;
      x.beginPath(); x.moveTo(44, 14); x.lineTo(78, 32); x.lineTo(44, 50); x.stroke();
    });
    texFlecha.wrapS = THREE.RepeatWrapping;
    var texBanda = texturaLienzo(4, 64, function (x) {
      var g = x.createLinearGradient(0, 0, 0, 64);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 4, 64);
    });
    function cinta(puntos, ancho, y) {
      var pos = [], uv = [], idx = [], u = 0;
      for (var i = 0; i < puntos.length - 1; i++) {
        var a = puntos[i], b = puntos[i + 1];
        var dx = b[0] - a[0], dz = b[1] - a[1], Ls = Math.sqrt(dx * dx + dz * dz);
        if (Ls < 0.01) continue;
        var ux = dx / Ls, uz = dz / Ls, nx = -uz * ancho / 2, nz = ux * ancho / 2;
        var ext = ancho * 0.35;
        var ax = a[0] - ux * ext, az = a[1] - uz * ext, bx = b[0] + ux * ext, bz = b[1] + uz * ext;
        var base = pos.length / 3;
        pos.push(ax + nx, y, az + nz, ax - nx, y, az - nz, bx + nx, y, bz + nz, bx - nx, y, bz - nz);
        var u1 = u + (Ls + 2 * ext) / 3;
        uv.push(u, 1, u, 0, u1, 1, u1, 0);
        idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
        u = u1;
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      return g;
    }
    function quitarRuta() {
      if (!ruta) return;
      escena.remove(ruta.grupo);
      ruta.grupo.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      ruta.flechas.dispose();
      ruta = null;
      pedir();
    }
    function trazarRuta(id) {
      quitarRuta();
      var destino = red.destino[id];
      if (!destino) return null;
      var origenNodo, origenPunto, desde;
      if (puntoQR) { origenNodo = nodoCercano(puntoQR.x, puntoQR.z); origenPunto = [puntoQR.x, puntoQR.z]; desde = 'desde donde estás'; }
      else { origenNodo = red.inicio; origenPunto = red.nodos[origenNodo]; desde = 'desde la entrada principal'; }
      var camino = caminoMasCorto(origenNodo, destino);
      if (!camino) return null;
      var pts = [origenPunto];
      camino.forEach(function (n) { var p = red.nodos[n]; if (largo(p, pts[pts.length - 1]) > 0.5) pts.push(p); });
      var metros = 0;
      for (var i = 0; i < pts.length - 1; i++) metros += largo(pts[i], pts[i + 1]);
      var color = zonas[id] ? zonas[id].color : new THREE.Color(0xE879F9);
      var colorRuta = new THREE.Color(0xE879F9);   // la ruta siempre en rosa de marca: se distingue sobre cualquier zona
      var grupo = new THREE.Group();
      var flechas = texFlecha.clone(); flechas.needsUpdate = true; flechas.wrapS = THREE.RepeatWrapping;
      if (pts.length > 1) {
        // la ruta se dibuja por encima de los edificios para que nunca quede tapada
        var brillo = new THREE.Mesh(cinta(pts, 4.2, 0.32), new THREE.MeshBasicMaterial({ map: texBanda, color: colorRuta, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
        var linea = new THREE.Mesh(cinta(pts, 1.7, 0.36), new THREE.MeshBasicMaterial({ map: flechas, color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
        brillo.renderOrder = 7; linea.renderOrder = 8;
        grupo.add(brillo, linea);
      }
      var fin = pts[pts.length - 1];
      var aro = new THREE.TorusGeometry(2.2, 0.16, 6, 48); aro.rotateX(Math.PI / 2);
      var anillo = new THREE.Mesh(aro, new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
      anillo.position.set(fin[0], 0.4, fin[1]);
      var disco = new THREE.Mesh(new THREE.CircleGeometry(1.1, 32), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false }));
      disco.rotation.x = -Math.PI / 2; disco.position.set(fin[0], 0.38, fin[1]);
      var inicio = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false }));
      inicio.rotation.x = -Math.PI / 2; inicio.position.set(pts[0][0], 0.38, pts[0][1]);
      anillo.renderOrder = disco.renderOrder = inicio.renderOrder = 9;
      grupo.add(anillo, disco, inicio);
      escena.add(grupo);
      var mnx = Infinity, mxx = -Infinity, mnz = Infinity, mxz = -Infinity;
      pts.forEach(function (p) { mnx = Math.min(mnx, p[0]); mxx = Math.max(mxx, p[0]); mnz = Math.min(mnz, p[1]); mxz = Math.max(mxz, p[1]); });
      ruta = { grupo: grupo, flechas: flechas, anillo: anillo, t0: performance.now(), hasta: performance.now() + (REDUCIDO ? 0 : 15000), caja: [mnx, mxx, mnz, mxz] };
      pedir();
      return { metros: Math.max(5, Math.round(metros / 5) * 5), minutos: Math.max(1, Math.round(metros / 70)), desde: desde, mismo: metros < 12 };
    }
    function encuadrarRuta() {
      if (!ruta) return;
      var c = ruta.caja, pad = 9;
      var zoom = zoomPara(c[0] - pad, c[1] + pad, c[2] - pad, c[3] + pad, 6, areaLibre());
      zoom = Math.max(controles.minZoom, Math.min(zoomBase * 4, zoom));
      volar((c[0] + c[1]) / 2, (c[2] + c[3]) / 2, zoom, 900);
      ruta.hasta = Math.max(ruta.hasta, performance.now() + (REDUCIDO ? 0 : 12000));
      pedir();
    }

    /* --- toque sobre el mapa --- */
    var rayo = new THREE.Raycaster(), ndc = new THREE.Vector2(), toques = [], abajo = null;
    Object.keys(zonas).forEach(function (id) { toques = toques.concat(zonas[id].toques); });
    renderer.domElement.addEventListener('pointerdown', function (e) { abajo = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    renderer.domElement.addEventListener('pointerup', function (e) {
      if (!abajo || interior) { abajo = null; return; }
      var dx = e.clientX - abajo.x, dy = e.clientY - abajo.y, dt = performance.now() - abajo.t;
      abajo = null;
      if (dx * dx + dy * dy > 64 || dt > 500) return;
      var r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      rayo.setFromCamera(ndc, camara);
      var hits = rayo.intersectObjects(toques, false), mejor = null;
      for (var i = 0; i < hits.length; i++) {
        var zz = hits[i].object.userData.zona, dz = zonasDatos[zz.id];
        if (filtro !== 'todo' && dz && dz.tipo !== filtro) continue;
        if (!mejor || zz.prioridad > mejor.prioridad) mejor = zz;
      }
      if (mejor) seleccionar(mejor.id, true, true);
      else if (seleccion) cerrarFicha();
    });
    renderer.domElement.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    /* --- etiquetas HTML sobre el modelo --- */
    var capa = $('#etiquetas');
    Object.keys(zonas).forEach(function (id) {
      var dz = zonasDatos[id]; if (!dz) return;
      var t = tipos[dz.tipo] || { color: '#C9AEFF' };
      var b = el('button', 'lbl' + (dz.privado || dz.menor ? ' menor' : ''),
        '<span class="ico">' + icono(ICONO_ZONA[id] || 'info', 15) + '</span><span class="txt">' + esc(dz.corto) + '</span><b class="envivo">EN VIVO</b>');
      b.style.setProperty('--c', t.color);
      b.setAttribute('aria-label', dz.nombre);
      b.addEventListener('click', function () { seleccionar(id, true, true); });
      capa.appendChild(b);
      etiquetas[id] = { el: b, pos: zonas[id].etiqueta, grupo: zonas[id].grupo };
    });
    var pin = null;
    if (puntoQR) {
      pin = { el: $('#pin'), pos: new THREE.Vector3(puntoQR.x, 0, puntoQR.z) };
      pin.el.hidden = false;
    }
    var p3 = new THREE.Vector3();
    function aPantalla(pos, dy, e, ancla) {
      p3.copy(pos); p3.y += dy || 0;
      p3.project(camara);
      var x = (p3.x + 1) / 2 * ancho, y = (1 - p3.y) / 2 * alto;
      var fuera = x < -60 || x > ancho + 60 || y < -20 || y > alto + 40;
      e.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)' + (ancla || '');
      e.style.visibility = fuera ? 'hidden' : '';
      return { x: x, y: y, fuera: fuera };
    }
    // Orden de importancia: si dos etiquetas se tapan, se oculta la de menos prioridad.
    // Orden de la lista de zonas en evento.js = importancia.
    var ORDEN = D.zonas.map(function (zd) { return zd.id; }).filter(function (k) { return !!zonas[k]; });
    function medirEtiquetas() {
      for (var id in etiquetas) { etiquetas[id].w = etiquetas[id].el.offsetWidth; etiquetas[id].h = etiquetas[id].el.offsetHeight; }
    }
    function choca(r, lista) {
      for (var i = 0; i < lista.length; i++) {
        var o = lista[i];
        if (r[0] < o[2] + 3 && r[2] > o[0] - 3 && r[1] < o[3] + 3 && r[3] > o[1] - 3) return true;
      }
      return false;
    }
    function ubicarEtiquetas() {
      var puestas = [];
      var vivosPrimero = ORDEN.filter(function (i) { return etiquetas[i] && etiquetas[i].el.classList.contains('vivo'); });
      var resto = ORDEN.filter(function (i) { return vivosPrimero.indexOf(i) < 0; });
      var base = vivosPrimero.concat(resto);
      var orden = seleccion ? [seleccion, 'pin'].concat(base.filter(function (i) { return i !== seleccion; })) : ['pin'].concat(base);
      for (var k = 0; k < orden.length; k++) {
        var id = orden[k], et = etiquetas[id];
        if (id === 'pin') {
          if (pin) {
            var pp = aPantalla(pin.pos, 0, pin.el);
            var rTexto = [pp.x - 46, pp.y + 14, pp.x + 46, pp.y + 44];
            var sinTexto = choca(rTexto, puestas);   // si tapa la etiqueta elegida, el pin se queda sin texto
            pin.el.classList.toggle('sin-texto', sinTexto);
            puestas.push(sinTexto ? [pp.x - 16, pp.y - 16, pp.x + 16, pp.y + 16] : [pp.x - 46, pp.y - 26, pp.x + 46, pp.y + 44]);
          }
          continue;
        }
        if (!et) continue;
        var s = aPantalla(et.pos, et.grupo.position.y, et.el, ' translate(-50%,-100%) translateY(-6px)');
        if (!et.w || et.vivoMedido !== et.el.classList.contains('vivo')) { et.w = et.el.offsetWidth; et.h = et.el.offsetHeight; et.vivoMedido = et.el.classList.contains('vivo'); }
        var r = [s.x - et.w / 2, s.y - et.h - 6, s.x + et.w / 2, s.y - 6];
        var oculta = et.el.classList.contains('fuera') || (app.classList.contains('lejos') && et.el.classList.contains('menor'));
        var tapa = !oculta && !s.fuera && choca(r, puestas);
        et.el.classList.toggle('choca', tapa);
        if (!oculta && !tapa && !s.fuera) puestas.push(r);
      }
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { medirEtiquetas(); pedir(); });

    /* --- controles en pantalla --- */
    $('#c-izq').addEventListener('click', function () { girar(1); });
    $('#c-der').addEventListener('click', function () { girar(-1); });
    $('#c-mas').addEventListener('click', function () { acercar(1.45); });
    $('#c-menos').addEventListener('click', function () { acercar(1 / 1.45); });
    $('#c-centro').addEventListener('click', function () {
      if (puntoQR) volar(puntoQR.x, puntoQR.z, zoomBase * 2.2);
      else verTodo();
    });

    window.addEventListener('resize', function () {
      medir(); encuadreGeneral(); medirEtiquetas();
      if (interior) { interior.cam.aspect = ancho / alto; interior.cam.updateProjectionMatrix(); }
      pedir();
    });

    /* --- recorrido 3D de una zona: misma pantalla, otra escena y cámara en perspectiva --- */
    function liberarInterior() {
      if (!interior) return;
      clearTimeout(interior.temporizador);
      interior.ctrl.dispose();
      interior.liberar();
      interior = null;
      if (renderer.renderLists) renderer.renderLists.dispose();
    }
    function entrar(id, extra) {
      if (!window.LSInteriores || !window.LSInteriores.tiene(id)) return;
      app.classList.add('transicion');
      setTimeout(function () {
        var I;
        try { I = window.LSInteriores.crear(THREE, id, { ligero: LIGERO, calidad: CALIDAD, vivo: extra && extra.vivo }); }
        catch (err) { if (window.console) console.error(err); app.classList.remove('transicion'); return; }
        liberarInterior();
        var cam = new THREE.PerspectiveCamera(45, ancho / alto, 0.1, 500);
        var obj = new THREE.Vector3().fromArray(I.obj), pos = new THREE.Vector3().fromArray(I.pos);
        if (alto > ancho) pos.sub(obj).multiplyScalar(1.25).add(obj);   // en celular un poco más lejos
        var ctrl = new THREE.OrbitControls(cam, renderer.domElement);
        ctrl.target.copy(obj);
        ctrl.enableDamping = !REDUCIDO;
        ctrl.dampingFactor = 0.08;
        ctrl.minDistance = I.dist[0];
        ctrl.maxDistance = I.dist[1];
        ctrl.minPolarAngle = 0.12;
        ctrl.maxPolarAngle = 1.47;
        ctrl.rotateSpeed = 0.7;
        ctrl.screenSpacePanning = true;
        ctrl.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
        ctrl.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
        ctrl.autoRotate = !REDUCIDO;
        ctrl.autoRotateSpeed = 0.6;
        var it = { id: id, escena: I.escena, cam: cam, ctrl: ctrl, liberar: I.liberar, animar: I.animar, animarHasta: performance.now() + 25000, moviendo: false, intro: true };
        ctrl.addEventListener('start', function () { it.moviendo = true; ctrl.autoRotate = false; $('#int-giro').setAttribute('aria-pressed', 'false'); pedir(); });
        ctrl.addEventListener('end', function () { it.moviendo = false; it.animarHasta = performance.now() + 20000; pedir(); });
        ctrl.addEventListener('change', pedir);
        it.temporizador = setTimeout(function () { ctrl.autoRotate = false; $('#int-giro').setAttribute('aria-pressed', 'false'); pedir(); }, 40000);
        $('#int-giro').setAttribute('aria-pressed', ctrl.autoRotate ? 'true' : 'false');
        // vuelo de entrada: llega desde lejos y arriba
        var desde = pos.clone().sub(obj).multiplyScalar(1.9).add(obj); desde.y += pos.y * 0.9;
        cam.position.copy(desde); cam.lookAt(obj);
        interior = it;
        controles.enabled = false;
        app.classList.add('en-interior');
        $('#interior').hidden = false;
        animar(1600, function (k) { cam.position.lerpVectors(desde, pos, k); cam.lookAt(obj); }, function () { it.intro = false; });
        requestAnimationFrame(function () { app.classList.remove('transicion'); });
        pedir();
      }, REDUCIDO ? 0 : 300);
    }
    function salir(listo) {
      if (!interior) return;
      app.classList.add('transicion');
      setTimeout(function () {
        liberarInterior();
        controles.enabled = true;
        app.classList.remove('en-interior');
        $('#interior').hidden = true;
        requestAnimationFrame(function () { app.classList.remove('transicion'); });
        pedir();
        if (listo) listo();
      }, REDUCIDO ? 0 : 280);
    }
    function giro() {
      if (!interior) return false;
      interior.ctrl.autoRotate = !interior.ctrl.autoRotate;
      if (interior.ctrl.autoRotate) { clearTimeout(interior.temporizador); interior.animarHasta = performance.now() + 20000; }
      pedir();
      return interior.ctrl.autoRotate;
    }

    // Vista inicial. En celular (pantalla vertical) se mira desde el occidente:
    // la taquilla queda abajo y el recorrido «sube» hacia la Caja de Arena y Gastrolabs.
    medir();
    var vertical = alto > ancho;
    posicionar(objetivo0, vertical ? -1.42 : AZIMUT, vertical ? 0.82 : 0.96);
    controles.target.copy(objetivo0);
    var zInicio = encuadreGeneral() * (vertical ? 1.32 : 1);
    var centroInicio = objetivo0;
    var tInicio = objetivoPara(centroInicio.x, centroInicio.z, zInicio, areaLibre());
    var offInicio = camara.position.clone().sub(controles.target);
    controles.target.copy(tInicio);
    camara.position.copy(tInicio).add(offInicio);
    camara.zoom = zInicio;
    camara.updateProjectionMatrix();

    // Entrada animada: la maqueta se levanta zona por zona mientras la cámara se acerca.
    if (opcionesMapa && opcionesMapa.intro && !REDUCIDO) {
      // la maqueta se levanta siguiendo el recorrido: de la taquilla hacia el oriente
      var ordenIntro = Object.keys(zonas).sort(function (a, b) { return zonas[a].centro.x - zonas[b].centro.x; });
      app.classList.add('intro');
      ordenIntro.forEach(function (id, i) {
        var g = zonas[id].grupo;
        g.scale.y = 0.001;
        setTimeout(function () { animar(650, function (k) { g.scale.y = Math.max(0.001, k); }); }, 150 + i * 85);
      });
      var zFin = camara.zoom;
      camara.zoom = zFin * 0.8; camara.updateProjectionMatrix();
      animar(1700, function (k) { camara.zoom = zFin * (0.8 + 0.2 * k); camara.updateProjectionMatrix(); });
      setTimeout(function () { app.classList.remove('intro'); medirEtiquetas(); if (SOMBRAS) renderer.shadowMap.needsUpdate = true; pedir(); }, 150 + ordenIntro.length * 85 + 450);
    }
    pedir();

    return {
      estados: estados, vivos: vivos, enfocar: enfocar, soltar: soltar, pedir: pedir,
      entrar: entrar, salir: salir, giro: giro, enInterior: function () { return !!interior; },
      ruta: trazarRuta, quitarRuta: quitarRuta, encuadrarRuta: encuadrarRuta,
      tieneRuta: function (id) { return !!red.destino[id]; },
      irAPunto: function (p) { volar(p.x, p.z, zoomBase * 2.2, 1100); },
      zonas: zonas, renderer: renderer
    };
  }

  function pintarEtiquetasEstado() {
    var n = ahora();
    Object.keys(etiquetas).forEach(function (id) {
      var dz = zonasDatos[id], e = etiquetas[id].el;
      var r = estadoZona(id, n);
      e.classList.toggle('vivo', !!(r.en && !r.en.pausa));
      e.classList.toggle('activa', seleccion === id);
      e.classList.toggle('fuera', filtro !== 'todo' && dz.tipo !== filtro);
      e.classList.toggle('tenue', !!seleccion && seleccion !== id);
    });
  }

  /* ---------------- refresco de datos y reloj ---------------- */
  function refrescar() {
    pintarFranja();
    if (seleccion && !$('#ficha').hidden) {
      var img = $('#ficha img'), y = hoja.scrollTop;
      pintarFicha(seleccion);
      hoja.scrollTop = y;
      if (img && $('#ficha img')) $('#ficha img').replaceWith(img);
    }
    if (!panel.hidden) pintarAgenda();
    if (zona3d) { var v = bloqueVivo(zona3d); $('#int-vivo').innerHTML = v; $('#int-vivo').hidden = !v; }
    if (mapa) mapa.vivos(zonasEnVivo(), filtro);
    pintarEtiquetasEstado();
    revisarRecordatorios();
  }

  function recargarDatos() {
    if (document.visibilityState !== 'visible' || navigator.onLine === false) return;
    var s = document.createElement('script');
    s.src = '/mapa/evento.js?ts=' + Date.now();
    s.onload = function () {
      var nuevo = window.LS_EVENTO;
      if (nuevo && nuevo.version !== D.version) { D = nuevo; tipos = D.tipos; indexar(); refrescar(); }
      s.remove();
    };
    s.onerror = function () { s.remove(); };
    document.head.appendChild(s);
  }

  /* ---------------- sin señal ---------------- */
  function estadoRed() {
    var sin = navigator.onLine === false;
    $('#sinred').hidden = !sin;
    app.classList.toggle('sin-senal', sin);
  }
  window.addEventListener('online', function () { estadoRed(); mostrarAviso('Conexión recuperada'); recargarDatos(); });
  window.addEventListener('offline', function () { estadoRed(); });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/mapa/sw.js', { scope: '/mapa/' }).catch(function () { /* sin modo sin señal */ });
    });
  }

  /* ---------------- arranque ---------------- */
  function iniciar() {
    indexar();
    construirFiltros();

    var p = params.get('p');
    if (p && D.puntos && Object.prototype.hasOwnProperty.call(D.puntos, p.toLowerCase())) {
      puntoQR = D.puntos[p.toLowerCase()];
      marcar('qr', p.toLowerCase());
    }
    var zInicial = params.get('z');

    var con3d = hayWebGL() && window.THREE && window.LSEscena && !params.has('lista');
    if (con3d) {
      try { mapa = crearMapa({ intro: !puntoQR && !zInicial }); } catch (err) { mapa = null; if (window.console) console.error(err); }
      if (DEV && mapa) window.LSMapa = mapa;   // solo para revisar con ?dev=1
    }
    if (!mapa) {
      app.classList.add('sin3d');
      abrirPanel('');
    }

    pintarFranja();
    if (puntoQR) {
      seleccion = null;
      setTimeout(function () {
        seleccionar(puntoQR.zona, false);
        if (mapa) mapa.irAPunto(puntoQR);
        mostrarAviso('Estás en: ' + puntoQR.nombre);
      }, 450);
    } else if (zInicial && zonasDatos[zInicial]) {
      setTimeout(function () {
        seleccionar(zInicial, true);
        if (params.get('ver') === '3d' && tieneInterior(zInicial)) setTimeout(function () { abrir3D(zInicial); }, 500);
      }, 450);
    } else if (mapa && !leer('lsGuiaVista', false) && !params.has('singuia')) {
      setTimeout(mostrarGuia, 1700);
    }
    aplicarEstados();
    estadoRed();
    revisarRecordatorios();

    setInterval(refrescar, 30000);
    setInterval(recargarDatos, 90000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { refrescar(); recargarDatos(); } });

    requestAnimationFrame(function () { app.classList.remove('cargando'); });
  }

  iniciar();
})();
