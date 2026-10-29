/* Labs Summit 2026 · herramienta del organizador (/sorteos/organizador.html)
   Trae los registros del QR (/api/registros, con la clave del sorteo) o lee un archivo
   (Excel, CSV o filas pegadas), cierra la lista, genera el archivo público (sin datos
   personales) y lo publica en /api/sorteos, y al final muestra los datos de contacto de
   los ganadores. Los datos personales y las sales nunca salen de este computador. */
(function () {
  'use strict';

  var N = window.LSSorteo, V = window.LSVista, h = V.h, vaciar = V.vaciar;
  var $ = function (s) { return document.getElementById(s); };
  var est = { cabeceras: [], filas: [], archivos: [], publico: null, privado: null, control: null, fechas: -1, fuente: '' };
  var cargado = { privado: null, publico: null }, reintento = null;

  function sinTildes(s) { return N.limpiar(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function texto(id, t, clase) { var e = $(id); e.textContent = t || ''; e.className = clase || e.className; return e; }
  function mostrarError(t) { var e = $('o-error'); e.textContent = t; e.hidden = !t; }
  // Colombia no tiene horario de verano: siempre UTC−5
  function valorLocal(ms) { return new Date(ms - 5 * 3600e3).toISOString().slice(0, 16); }
  function msDeLocal(v) { return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v || '') ? Date.parse(v + ':00-05:00') : NaN; }
  function isoCol(ms) { return new Date(ms - 5 * 3600e3).toISOString().slice(0, 19) + '-05:00'; }
  function miles(n) { return n.toLocaleString('es-CO'); }
  // Un sorteo oficial sale al menos 1 minuto después de cerrar la lista: nadie conoce todavía ese número de drand
  var MINIMO = 60e3;
  // «en N minutos», redondeado al minuto siguiente (el campo de hora va de minuto en minuto)
  function enMinutos(n) { return valorLocal(Math.ceil((Date.now() + n * 60e3 + 20e3) / 6e4) * 6e4); }

  /* ---------------- ganadores de hoy (no vuelven a participar) ---------------- */
  // Se guardan en este navegador: solo el identificador normalizado y la etiqueta pública.
  var CLAVE_GANADORES = 'lsSorteoGanadores', CLAVE_DIA = 'lsSorteosDelDia', CLAVE_HISTORIAL = 'lsSorteoHistorial';
  function leerLocal(clave) { try { var x = JSON.parse(localStorage.getItem(clave) || '[]'); return Array.isArray(x) ? x : []; } catch (e) { return []; } }
  function guardarLocal(clave, x) { try { localStorage.setItem(clave, JSON.stringify(x)); } catch (e) { /* sin almacenamiento: no se recuerdan */ } }
  function idBase(id) { return String(id).split('#')[0]; }
  function yaGano(id) { return leerLocal(CLAVE_GANADORES).some(function (g) { return g.id === idBase(id); }); }
  function marcarGanador(p, premio, sorteo, si) {
    var lista = leerLocal(CLAVE_GANADORES).filter(function (g) { return g.id !== idBase(p.id); });
    if (si) lista.push({ id: idBase(p.id), etiqueta: p.etiqueta, premio: premio, sorteo: sorteo });
    guardarLocal(CLAVE_GANADORES, lista);
    pintarExcluidos();
    pintarPremiosEvento();
    if (est.filas.length) pintarMuestra();
  }
  // «Marcar que recibió el premio»: también para un ganador de un ensayo que se usó como sorteo real
  function botonRecibio(persona, premio, titulo) {
    var b = h('button', { type: 'button', class: 'btn sec mini' });
    function pintar() { b.textContent = yaGano(persona.id) ? 'Recibió el premio ✓ (quitar)' : 'Marcar que recibió el premio'; }
    b.addEventListener('click', function () { marcarGanador(persona, premio, titulo, !yaGano(persona.id)); pintar(); });
    pintar();
    return b;
  }
  // Cada ganador que sale en esta pantalla queda anotado en este computador (aunque el sorteo no se publique)
  function guardarEnHistorial(pub, priv, ganadores) {
    if (!pub || !priv || priv.huella !== pub.huella || !ganadores || !ganadores.length) return;
    var lista = leerLocal(CLAVE_HISTORIAL).filter(function (x) { return !(x.id === pub.id && x.huella === pub.huella); });
    lista.unshift({ id: pub.id, huella: pub.huella, titulo: pub.titulo, ensayo: !!pub.ensayo, ronda: pub.azar.ronda, participantes: pub.participantes.length,
      ganadores: ganadores.map(function (g) {
        var p = priv.participantes[g.posicion - 1] || {};
        return { premio: g.premio, etiqueta: g.etiqueta, nombre: p.nombre || '', celular: p.idOriginal || '' };
      }) });
    guardarLocal(CLAVE_HISTORIAL, lista.slice(0, 60));
  }
  function pintarExcluidos() {
    var lista = leerLocal(CLAVE_GANADORES), caja = vaciar($('o-lista-excluidos'));
    $('o-excluidos').hidden = !lista.length;
    lista.forEach(function (g) {
      caja.appendChild(h('li', null, [g.etiqueta + ' · ' + g.premio + ' ', h('button', { type: 'button', class: 'btn sec mini', text: 'Quitar', onclick: function () { marcarGanador(g, '', '', false); } })]));
    });
  }
  $('o-borrar-excluidos').addEventListener('click', function () {
    if (confirm('¿Vaciar la lista? Quienes ya ganaron podrían volver a ganar.')) { guardarLocal(CLAVE_GANADORES, []); pintarExcluidos(); if (est.filas.length) pintarMuestra(); }
  });
  pintarExcluidos();

  /* ---------------- 1 · registros del QR (labssummit.com/participa) ---------------- */
  // La clave se queda en esta pestaña; en el computador solo si se marca «Recordarla»
  var CLAVE_API = 'lsSorteoClave';
  function clave() { return $('o-clave').value.trim(); }
  function guardarClave() {
    try {
      sessionStorage.setItem(CLAVE_API, clave());
      if ($('o-recordar').checked) localStorage.setItem(CLAVE_API, clave()); else localStorage.removeItem(CLAVE_API);
    } catch (e) { /* sin almacenamiento: hay que escribirla cada vez */ }
  }
  try {
    $('o-clave').value = sessionStorage.getItem(CLAVE_API) || localStorage.getItem(CLAVE_API) || '';
    $('o-recordar').checked = !!localStorage.getItem(CLAVE_API);
  } catch (e) { /* nada */ }
  $('o-recordar').addEventListener('change', function () { if (clave()) guardarClave(); else try { localStorage.removeItem(CLAVE_API); } catch (e) { /* nada */ } });

  function api(ruta, cuerpo) {
    var op = { method: cuerpo ? 'POST' : 'GET', headers: {}, cache: 'no-store', credentials: 'same-origin' };
    if (clave()) op.headers.Authorization = 'Bearer ' + clave();
    if (cuerpo) { op.headers['Content-Type'] = 'application/json'; op.body = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo); }
    return fetch(ruta, op).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.ok) { if (d && typeof d === 'object') Object.defineProperty(d, '_fecha', { value: r.headers.get('Date') }); return d; }
        var e = new Error(d.error || 'El servidor respondió con el error ' + r.status + '.');
        e.status = r.status;
        throw e;
      });
    }, function () { throw new Error('No hay conexión con labssummit.com.'); });
  }

  var qrAbierto = null;
  function pintarEstadoQR(abierto, total) {
    qrAbierto = abierto;
    texto('o-qr-estado', (abierto ? '● Registro abierto' : '● Registro cerrado') + ' · ' + miles(total) + (total === 1 ? ' persona registrada' : ' personas registradas'), 'estado-o ' + (abierto ? 'bien' : 'mal'));
    $('o-abrir-cerrar').textContent = abierto ? 'Cerrar el registro' : 'Abrir el registro';
    $('o-abrir-cerrar').hidden = false;
  }
  function consultarQR() {
    fetch('/api/participa', { cache: 'no-store', credentials: 'same-origin' }).then(function (r) {
      return r.json().then(function (d) { return { status: r.status, d: d }; });
    }).then(function (x) {
      if (x.status === 503) return texto('o-qr-estado', 'El registro del QR todavía no está activado en Cloudflare. ' + (x.d.motivo || 'Falta enlazar la base de datos SORTEO_DB.'), 'estado-o mal');
      if (x.status !== 200) throw new Error();
      pintarEstadoQR(x.d.abierto, x.d.total);
    }).catch(function () { texto('o-qr-estado', 'No se pudo consultar el registro del QR.', 'estado-o mal'); });
  }
  consultarQR();

  function conClave(boton, ruta, cuerpo, listo) {
    if (!clave()) { texto('o-qr-msg', 'Escribe la clave del sorteo.', 'estado-o mal'); $('o-clave').focus(); return; }
    boton.disabled = true;
    texto('o-qr-msg', 'Un momento…', 'estado-o');
    api(ruta, cuerpo).then(function (d) {
      guardarClave();
      if (typeof d.abierto === 'boolean') pintarEstadoQR(d.abierto, d.total);
      listo(d);
    }, function (e) { texto('o-qr-msg', e.message, 'estado-o mal'); })
      .finally(function () { boton.disabled = false; });
  }
  // «2026-10-29T15:04:05Z» → «2026-10-29 10:04» (hora de Colombia)
  function fechaRegistro(iso) { var ms = Date.parse(iso); return isNaN(ms) ? '' : valorLocal(ms).replace('T', ' '); }

  function usarRegistros(lista) {
    est.archivos = [{ nombre: 'Registros del QR', tabla: [['Fecha de registro', 'Nombre completo', 'Celular']].concat(lista.map(function (x) { return [fechaRegistro(x.creado), x.nombre, x.celular]; })) }];
    est.fuente = 'qr';
    $('o-pegar').value = '';
    $('o-encabezado').checked = true;
    texto('o-archivos', '');
    leer();
  }
  $('o-traer').addEventListener('click', function () {
    conClave(this, '/api/registros', null, function (d) {
      var lista = Array.isArray(d.registros) ? d.registros : [];
      if (!lista.length) return texto('o-qr-msg', 'Todavía no hay nadie registrado.', 'estado-o mal');
      texto('o-qr-msg', '✓ ' + miles(lista.length) + (lista.length === 1 ? ' registro traído' : ' registros traídos') + ' (' + V.horaCol(Date.now(), true) + '). Quienes se registren después entran en el próximo sorteo.', 'estado-o bien');
      usarRegistros(lista);
    });
  });
  $('o-abrir-cerrar').addEventListener('click', function () {
    var cerrar = qrAbierto !== false;
    if (cerrar && !confirm('¿Cerrar el registro? Nadie más podrá registrarse hasta que lo abras otra vez.')) return;
    conClave(this, '/api/registros', { accion: cerrar ? 'cerrar' : 'abrir' }, function (d) {
      texto('o-qr-msg', d.abierto ? 'El registro quedó abierto.' : 'El registro quedó cerrado.', 'estado-o bien');
    });
  });
  $('o-quitar').addEventListener('click', function () {
    var cel = N.limpiar($('o-quitar-cel').value);
    if (!cel) return $('o-quitar-cel').focus();
    if (!confirm('¿Quitar el registro del celular ' + cel + '?')) return;
    conClave(this, '/api/registros', { accion: 'quitar', celular: cel }, function () {
      $('o-quitar-cel').value = '';
      texto('o-qr-msg', 'Registro quitado.', 'estado-o bien');
    });
  });
  $('o-vaciar').addEventListener('click', function () {
    var r = prompt('Esto borra TODOS los registros del QR. Úsalo solo para limpiar las pruebas antes de abrir el registro al público.\n\nEscribe VACIAR para confirmar:');
    if (r === null) return;
    if (N.limpiar(r).toUpperCase() !== 'VACIAR') return texto('o-qr-msg', 'No se borró nada.', 'estado-o');
    conClave(this, '/api/registros', { accion: 'vaciar', confirmar: 'VACIAR' }, function () {
      texto('o-qr-msg', 'Se borraron todos los registros.', 'estado-o bien');
    });
  });

  // Después de las pruebas: todo en cero, en el servidor y en este navegador (la clave se conserva)
  $('o-reiniciar').addEventListener('click', function () {
    var r = prompt('Esto borra TODOS los registros del QR, TODOS los sorteos publicados en labssummit.com/sorteos (también los ensayos) y la lista de ganadores de este computador. No se puede deshacer.\n\nEscribe REINICIAR para confirmar:');
    if (r === null) return;
    if (N.limpiar(r).toUpperCase() !== 'REINICIAR') return texto('o-qr-msg', 'No se borró nada.', 'estado-o');
    conClave(this, '/api/registros', { accion: 'reiniciar', confirmar: 'REINICIAR' }, function () {
      [CLAVE_GANADORES, CLAVE_DIA, CLAVE_DIA + '.marcados', CLAVE_ULTIMO, CLAVE_HISTORIAL].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) { /* nada */ } });
      try { sessionStorage.setItem('lsSorteoReiniciado', '1'); } catch (e) { /* nada */ }
      location.reload();
    });
  });
  try {
    if (sessionStorage.getItem('lsSorteoReiniciado')) {
      sessionStorage.removeItem('lsSorteoReiniciado');
      texto('o-qr-msg', '✓ Todo quedó en cero: sin registros, sin sorteos publicados y sin ganadores. El registro está abierto.', 'estado-o bien');
    }
  } catch (e) { /* nada */ }

  /* ---------------- 1 · leer la lista ---------------- */
  $('o-archivo').addEventListener('change', function (e) {
    var fs = Array.prototype.slice.call(e.target.files || []);
    est.archivos = [];
    est.fuente = 'archivo';
    texto('o-archivos', '');
    if (!fs.length) return;
    texto('o-leido', 'Leyendo…', 'estado-o');
    Promise.all(fs.map(function (f) {
      return f.arrayBuffer().then(function (b) {
        if (N.esZip(b)) return N.leerXlsx(b).then(function (t) { return { nombre: f.name, tabla: t }; });
        if (/\.xls$/i.test(f.name)) throw new Error('«' + f.name + '» es un Excel antiguo (.xls). Ábrelo en Excel y guárdalo como .xlsx o CSV.');
        return { nombre: f.name, tabla: N.leerTabla(N.decodificar(b)) };
      });
    })).then(function (xs) {
      est.archivos = xs;
      texto('o-archivos', xs.map(function (x) { return x.nombre; }).join(', '));
      leer();
    }, function (err) { texto('o-leido', err.message || String(err), 'estado-o mal'); });
  });
  $('o-leer').addEventListener('click', leer);
  $('o-encabezado').addEventListener('change', function () { if (est.filas.length) leer(); });

  function leer() {
    var tablas = est.archivos.map(function (x) { return x.tabla.map(function (f) { return f.slice(); }); });
    if ($('o-pegar').value.trim()) tablas.push(N.leerTabla($('o-pegar').value));
    if (!tablas.length) { texto('o-leido', 'Sube un archivo o pega la lista.', 'estado-o mal'); return; }
    var conTitulos = $('o-encabezado').checked, cab = null, filas = [], distintas = false;
    tablas.forEach(function (tabla) {
      if (!tabla.length) return;
      if (conTitulos) {
        var c = tabla.shift().map(N.limpiar);
        if (cab && c.join('\u0001') !== cab.join('\u0001')) distintas = true;
        cab = cab || c;
      }
      for (var i = 0; i < tabla.length; i++) filas.push(tabla[i]);
    });
    if (distintas) { texto('o-leido', 'Los archivos no tienen las mismas columnas. Únelos en Excel en una sola hoja y vuelve a intentarlo.', 'estado-o mal'); return; }
    if (!filas.length) { texto('o-leido', 'No encontramos filas con datos.', 'estado-o mal'); return; }
    var ancho = filas.reduce(function (m, f) { return Math.max(m, f.length); }, cab ? cab.length : 0);
    var nombres = [];
    for (var k = 0; k < ancho; k++) nombres.push((cab && cab[k]) || 'Columna ' + (k + 1));
    est.cabeceras = nombres;
    est.filas = filas;
    convertirFechas();
    texto('o-leido', 'Leímos ' + miles(filas.length) + ' filas con ' + ancho + ' columnas.', 'estado-o bien');
    llenarColumnas();
    $('paso2').hidden = false;
    $('paso3').hidden = false;
    if (!$('o-hora').value) $('o-hora').value = enMinutos(10);
    pintarRonda();
  }

  // Coccoa exporta la fecha de venta como número de serie de Excel («46324.7083»): se pasa a «2026-10-29 17:00»
  function convertirFechas() {
    est.fechas = -1;
    est.cabeceras.forEach(function (c, i) {
      if (!/fecha|dia|date|hora|vendid|marca temporal|timestamp/.test(sinTildes(c))) return;
      var serie = est.filas.filter(function (f) { return /^\d{5}(\.\d+)?$/.test(String(celda(f, i)).trim()); }).length;
      if (serie && serie >= est.filas.length * 0.9) est.filas.forEach(function (f) { if (i < f.length) f[i] = N.fechaDeExcel(f[i]); });
      est.filas.forEach(function (f) {
        var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})[ ,T]+(\d{1,2}):(\d{2})/.exec(String(celda(f, i)).trim());   // día/mes/año, como en Colombia
        if (m) f[i] = m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) + ' ' + ('0' + m[4]).slice(-2) + ':' + m[5];
      });
      var iso = est.filas.filter(function (f) { return /^\d{4}-\d{2}-\d{2}/.test(String(celda(f, i))); }).length;
      if (est.fechas < 0 && iso >= est.filas.length * 0.9) est.fechas = i;
    });
  }

  /* ---------------- 2 · columnas ---------------- */
  // Qué tan distintos son los valores de una columna (1 = todos distintos)
  function unicidad(i) {
    var vistos = Object.create(null), n = 0, d = 0;
    est.filas.forEach(function (f) { var v = N.normalizarId(celda(f, i)); if (!v) return; n++; if (!vistos[v]) { vistos[v] = true; d++; } });
    return n ? d / n : 0;
  }
  // La primera columna cuyo título coincide con un patrón (en orden de preferencia).
  // Con «minimo», solo valen columnas con valores casi todos distintos y gana la más única:
  // así «Visualizar código» (siempre «Ver código») no se confunde con el código de la boleta.
  function adivinar(patrones, excluir, minimo) {
    for (var p = 0; p < patrones.length; p++) {
      var mejor = -1, mejorU = -1;
      for (var i = 0; i < est.cabeceras.length; i++) {
        if (excluir.indexOf(i) >= 0 || !patrones[p].test(sinTildes(est.cabeceras[i]))) continue;
        if (!minimo) return i;
        var u = unicidad(i);
        if (u >= minimo && u > mejorU) { mejor = i; mejorU = u; }
      }
      if (mejor >= 0) return mejor;
    }
    return -1;
  }
  function opciones(sel, extras, elegida) {
    vaciar(sel);
    (extras || []).forEach(function (x) { sel.appendChild(h('option', { value: x[0], text: x[1] })); });
    est.cabeceras.forEach(function (c, i) { sel.appendChild(h('option', { value: String(i), text: c })); });
    sel.value = elegida >= 0 ? String(elegida) : extras && extras.length ? extras[0][0] : '0';
  }
  function llenarColumnas() {
    var cant = adivinar([/^(cantidad|cant\.?|qty|quantity)\b|cantidad de (boletas|entradas|tickets)/], []);
    var id = adivinar([/^codigo del enlace/, /codigo|cod\.|boleta|ticket|entrada|orden|order|pedido|referencia|localizador/,
      /cedula|documento|identificacion|\bid\b|numero|correo|e-?mail/, /\btel|celular|\bcel\b|movil|telefono|phone|whatsapp/], [cant], 0.5);
    if (id < 0) {   // ningún título conocido: la columna con más valores distintos
      var u = est.cabeceras.map(function (c, i) { return i === cant || i === est.fechas ? -1 : unicidad(i); });
      id = u.indexOf(Math.max.apply(null, u.concat([0])));
    }
    var nombre = adivinar([/nombre|name|comprador|asistente|cliente|titular/], [id, cant]);
    var cel = adivinar([/\btel|celular|\bcel\b|movil|telefono|phone|whatsapp/], [id, nombre, cant]);
    opciones($('o-col-id'), null, id);
    opciones($('o-col-nombre'), [['', '— ninguna —']], nombre);
    opciones($('o-col-cantidad'), [['', '— ninguna —']], cant);
    opciones($('o-col-visible'), [['', '— el identificador —'], ['nada', '— nada —']], cel);
    pintarFiltros();
  }
  ['o-col-id', 'o-col-nombre', 'o-col-cantidad', 'o-col-visible'].forEach(function (s) { $(s).addEventListener('change', pintarMuestra); });

  function col(sel) { var v = $(sel).value; return v === '' ? -1 : parseInt(v, 10); }
  function colVisible() { var v = $('o-col-visible').value; return v === '' ? col('o-col-id') : v === 'nada' ? -2 : parseInt(v, 10); }
  function celda(fila, i) { return i >= 0 && i < fila.length ? fila[i] : ''; }

  // Valores que normalmente no deben participar (pagos pendientes, anulados, boletas no válidas…)
  var NO_VALE = /pendiente|cancel|rechaz|reembols|devol|devuelt|anulad|fallid|expirad|vencid|declin|refund|pending|failed|void|no valid|invalid|eliminad|bloquead/;
  // Columnas de Coccoa que son botones de la tabla, no datos
  var NO_FILTRO = /^(cambiar estado|visualizar codigo|eliminar boleta|reenviar|entrada|firma|comision|codigo del enlace)/;

  // Un grupo de casillas por cada columna con pocos valores distintos (tipo, etapa, estado, promotor…)
  function pintarFiltros() {
    var caja = vaciar($('o-grupos')), hay = false;
    est.cabeceras.forEach(function (c, i) {
      if (NO_FILTRO.test(sinTildes(c)) || i === est.fechas) return;
      var cuenta = Object.create(null), orden = [];
      est.filas.forEach(function (f) { var v = N.limpiar(celda(f, i)) || '(vacío)'; if (!(v in cuenta)) { cuenta[v] = 0; orden.push(v); } cuenta[v]++; });
      if (orden.length < 2 || orden.length > 12 || orden.length > est.filas.length / 2) return;
      if (orden.every(function (v) { return v === '(vacío)' || /^[\d.,\s$-]+$/.test(v); })) return;   // precios, ids de pago…
      hay = true;
      var grupo = h('fieldset', { class: 'valores', 'data-col': i }, [h('legend', { text: c })]);
      orden.sort(function (a, b) { return cuenta[b] - cuenta[a]; }).forEach(function (v) {
        grupo.appendChild(h('label', { class: 'check' }, [
          h('input', { type: 'checkbox', value: v, checked: !NO_VALE.test(sinTildes(v)), onchange: pintarMuestra }),
          ' ' + v + ' ', h('small', { text: '(' + miles(cuenta[v]) + ')' })
        ]));
      });
      caja.appendChild(grupo);
    });
    $('o-filtros').hidden = !hay;
    pintarMuestra();
  }
  function filtrosActivos() {
    return Array.prototype.map.call($('o-grupos').querySelectorAll('fieldset[data-col]'), function (g) {
      var ok = Object.create(null);
      Array.prototype.forEach.call(g.querySelectorAll('input[type=checkbox]'), function (c) { if (c.checked) ok[c.value] = true; });
      return { columna: parseInt(g.getAttribute('data-col'), 10), ok: ok };
    });
  }
  function registros() {
    var ci = col('o-col-id'), cn = col('o-col-nombre'), cc = col('o-col-cantidad'), cv = colVisible(), filtros = filtrosActivos();
    var r = [], fuera = 0, ganaron = 0, excluir = Object.create(null);
    leerLocal(CLAVE_GANADORES).forEach(function (g) { excluir[g.id] = true; });
    est.filas.forEach(function (f) {
      for (var g = 0; g < filtros.length; g++) {
        if (!filtros[g].ok[N.limpiar(celda(f, filtros[g].columna)) || '(vacío)']) { fuera++; return; }
      }
      if (excluir[N.normalizarId(celda(f, ci))]) { ganaron++; return; }
      r.push({ id: celda(f, ci), nombre: cn >= 0 ? celda(f, cn) : '', visible: cv === -2 ? null : celda(f, cv), cantidad: cc >= 0 ? celda(f, cc) : 1, fila: f });
    });
    return { lista: r, filtradas: fuera, yaGanaron: ganaron };
  }
  function etiquetaPrevia(x) {
    return N.etiquetaDe(x.nombre, x.visible === null ? '' : N.limpiar(x.visible) ? x.visible : x.id);
  }
  function idDeEnlace() { return /^codigo del enlace/.test(sinTildes(est.cabeceras[col('o-col-id')] || '')); }
  // Solo un código de boleta u orden se puede revelar en público; nunca un celular, una cédula o un correo
  function idRevelable() {
    var c = sinTildes(est.cabeceras[col('o-col-id')] || '');
    return !idDeEnlace() && /codigo|cod\.|boleta|ticket|orden|order|pedido|referencia|localizador/.test(c) && !/\btel|celular|\bcel\b|movil|cedula|documento|correo|e-?mail/.test(c);
  }

  function pintarMuestra() {
    var reg = registros(), r = reg.lista, caja = vaciar($('o-muestra'));
    r.slice(0, 6).forEach(function (x) { caja.appendChild(h('li', { text: etiquetaPrevia(x) })); });
    if (!r.length) caja.appendChild(h('li', { class: 'mal', text: 'Con estos filtros no queda nadie.' }));
    pintarAvisos(reg);
  }

  function pintarAvisos(reg) {
    var caja = vaciar($('o-avisos')), r = reg.lista;
    function aviso(t, clase) { caja.appendChild(h('p', { class: clase || 'aviso', text: t })); }
    aviso(est.fuente === 'qr' && r.length === est.filas.length ? miles(r.length) + (r.length === 1 ? ' persona registrada participa.' : ' personas registradas participan.') : miles(r.length) + ' de ' + miles(est.filas.length) + ' filas participan con estos filtros. Compara el total con tu fuente.', 'ayuda');
    if (reg.yaGanaron) aviso(miles(reg.yaGanaron) + (reg.yaGanaron === 1 ? ' fila es de alguien que ya ganó hoy y no participa' : ' filas son de personas que ya ganaron hoy y no participan') + ' (lista en el paso 5).', 'ayuda');
    // rango de ventas: confirma que el archivo se bajó a la hora de cierre y trae las ventas de hoy
    if (est.fechas >= 0) {
      var fechas = r.map(function (x) { return String(celda(x.fila, est.fechas)); }).filter(function (v) { return /^\d{4}-\d{2}-\d{2}/.test(v); }).sort();
      if (fechas.length) aviso((est.fuente === 'qr' ? 'Registros desde ' + fechas[0] + ' hasta ' + fechas[fechas.length - 1] + '. Para incluir a los que lleguen después, vuelve a pulsar «Traer los registros».' : 'El archivo trae registros desde ' + fechas[0] + ' hasta ' + fechas[fechas.length - 1] + '. Si llegaron más después, vuelve a descargarlo.'), 'ayuda');
    }
    if (idDeEnlace()) aviso('El identificador es el código del enlace de cada boleta. En la lista pública solo aparecen sus últimos 4 dígitos y nunca se publica completo: con él se puede abrir la boleta.', 'ayuda');
    else {
      // ¿Parece un código de acceso (QR)? Entonces no conviene usarlo.
      var muestra = r.slice(0, 50).map(function (x) { return N.limpiar(x.id); }).filter(Boolean);
      var largos = muestra.filter(function (v) { return /^[A-Za-z0-9_\-]{16,}$/.test(v) && /[A-Za-z]/.test(v) && /\d/.test(v); }).length;
      if (muestra.length && largos / muestra.length > 0.5) aviso('Este identificador parece un código de acceso (como el del QR). Si es el que se escanea en la entrada, elige otra columna, por ejemplo el número de orden.');
    }
    // Un mismo identificador con nombres distintos: se juntarían personas diferentes en una sola participación
    var nombres = Object.create(null), mezclados = 0, filas = 0;
    r.forEach(function (x) { var k = N.normalizarId(x.id); if (!k) return; (nombres[k] = nombres[k] || []).push(sinTildes(x.nombre)); });
    Object.keys(nombres).forEach(function (k) {
      var distintos = nombres[k].filter(function (v, i, a) { return v && a.indexOf(v) === i; }).length;
      if (distintos > 1) { mezclados++; filas += nombres[k].length; }
    });
    if (mezclados) aviso('Ojo: ' + miles(mezclados) + (mezclados === 1 ? ' valor' : ' valores') + ' de «' + est.cabeceras[col('o-col-id')] + '» se repite' + (mezclados === 1 ? '' : 'n') + ' con nombres distintos (' + miles(filas) + ' boletas). Con este identificador esas personas contarían como una sola. Usa el código de cada boleta.');
    // Cortesías: decisión del organizador
    var cortesias = 0;
    filtrosActivos().forEach(function (g) {
      Object.keys(g.ok).forEach(function (v) { if (/cortes/.test(sinTildes(v))) cortesias += r.filter(function (x) { return N.limpiar(celda(x.fila, g.columna)) === v; }).length; });
    });
    if (cortesias) aviso(miles(cortesias) + ' de las que participan son de cortesía («Cortesía»). Desmárcalas arriba si no deben entrar.', 'ayuda');
  }

  /* ---------------- 3 · datos del sorteo ---------------- */
  // Los premios de Labs Summit 2026, en el orden en que se sortean
  var PREMIOS_EVENTO = [
    { boton: 'Bono $500.000', titulo: 'Sorteo del bono de $500.000', premio: 'Bono de $500.000 para arreglos de dispositivos tecnológicos' },
    { boton: 'iPad', titulo: 'Sorteo del iPad', premio: 'iPad' },
    { boton: 'Hospedaje', titulo: 'Sorteo del hospedaje', premio: 'Hospedaje' },
    { boton: 'Reloj', titulo: 'Sorteo del reloj', premio: 'Reloj' },
    { boton: 'iPhone 17', titulo: 'Sorteo del iPhone 17', premio: 'iPhone 17' }
  ];
  var premioElegido = null;
  function ponerPremio() {
    if (!premioElegido) return;
    $('o-titulo').value = premioElegido.titulo;
    $('o-premios').value = premioElegido.premio + ($('o-con-suplentes').checked ? '\nSuplente 1\nSuplente 2' : '');
  }
  // Un botón por premio; los que ya se sortearon hoy (oficiales) llevan ✓
  function pintarPremiosEvento() {
    var hechos = Object.create(null), caja = vaciar($('o-premios-evento'));
    leerLocal(CLAVE_DIA).forEach(function (x) { if (x && !x.ensayo) hechos[x.titulo] = true; });
    leerLocal(CLAVE_GANADORES).forEach(function (g) { if (g && g.sorteo) hechos[g.sorteo] = true; });   // marcados a mano
    PREMIOS_EVENTO.forEach(function (p, i) {
      var activo = premioElegido === p;
      caja.appendChild(h('button', { type: 'button', class: 'btn sec chip' + (activo ? ' activo' : '') + (hechos[p.titulo] ? ' hecho' : ''), 'aria-pressed': activo ? 'true' : 'false',
        title: hechos[p.titulo] ? 'Ya se sorteó hoy' : null, text: (i + 1) + '. ' + p.boton + (hechos[p.titulo] ? ' ✓' : ''),
        onclick: function () { premioElegido = p; ponerPremio(); pintarPremiosEvento(); } }));
    });
  }
  $('o-con-suplentes').addEventListener('change', ponerPremio);
  pintarPremiosEvento();

  function textoGenerar() { return $('o-ensayo').checked ? 'Cerrar la lista y generar el ENSAYO' : 'Cerrar la lista y generar el sorteo'; }
  $('o-ensayo').addEventListener('change', function () { $('o-generar').textContent = textoGenerar(); });
  $('o-hora').addEventListener('input', pintarRonda);
  $('o-ensayo').addEventListener('change', pintarRonda);
  function pintarRonda() {
    var ms = msDeLocal($('o-hora').value), e = $('o-ronda');
    if (isNaN(ms)) { e.textContent = ''; return; }
    var r = N.rondaEn(ms), hora = N.horaDeRonda(r);
    var txt = 'Se usará la ronda ' + r.toLocaleString('es-CO') + ' de drand quicknet, que sale el ' + V.fechaCol(hora) + ' a las ' + V.horaCol(hora, true);
    if (!$('o-ensayo').checked && hora < Date.now() + MINIMO) txt += ' ⚠ Debe ser al menos 1 minuto en el futuro.';
    e.textContent = txt;
  }

  // «En 3 / 5 / 10 min»: para un sorteo que se decide en el momento
  Array.prototype.forEach.call(document.querySelectorAll('#o-rapido [data-min]'), function (b) {
    b.addEventListener('click', function () { $('o-hora').value = enMinutos(parseInt(b.getAttribute('data-min'), 10)); pintarRonda(); });
  });

  $('o-generar').addEventListener('click', function () {
    var boton = $('o-generar');
    boton.disabled = true; boton.textContent = 'Generando…';
    generar({}).catch(function () { /* el error ya se muestra */ })
      .finally(function () { boton.disabled = false; boton.textContent = textoGenerar(); });
  });

  // Cierra la lista y arma el sorteo. op.ronda: la ronda de drand ya elegida (sorteo en vivo).
  function generar(op) {
    mostrarError('');
    var titulo = N.limpiar($('o-titulo').value);
    var premios = $('o-premios').value.split(/\r?\n/).map(N.limpiar).filter(Boolean);
    var horaMs = op.ronda ? N.horaDeRonda(op.ronda) : msDeLocal($('o-hora').value), ensayo = $('o-ensayo').checked;
    function falla(t) { mostrarError(t); return Promise.reject(new Error(t)); }
    if (!est.filas.length) return falla('Primero lee la lista (paso 1).');
    if (!titulo) return falla('Escribe el título del sorteo.');
    if (!premios.length) return falla('Escribe al menos un premio.');
    if (premios.length > 50) return falla('Máximo 50 premios por sorteo.');
    if (isNaN(horaMs)) return falla('Elige la fecha y la hora del sorteo.');
    var ronda = op.ronda || N.rondaEn(horaMs);
    if (!op.ronda && !ensayo && N.horaDeRonda(ronda) < Date.now() + MINIMO) {
      return falla('La hora del sorteo debe ser al menos 1 minuto después de cerrar la lista: así nadie conoce el azar cuando se cierra. Si solo quieres probar, marca «Es un ensayo».');
    }
    var reg = registros();
    return N.prepararParticipantes(reg.lista).then(function (prep) {
      // con pocos inscritos sobran suplentes: se quitan los que no alcanzan
      while (premios.length > prep.participantes.length && premios.length > 1 && /^suplente\b/i.test(premios[premios.length - 1])) premios.pop();
      if (prep.participantes.length < premios.length) throw new Error('Hay ' + prep.participantes.length + ' participantes y ' + premios.length + ' premios: debe haber al menos un participante por premio.');
      var id = N.idSorteo(titulo, horaMs);
      if (op.ronda) id = id.slice(0, 15) + isoCol(horaMs).slice(17, 19) + id.slice(15);   // «2026-10-29-1551» → «2026-10-29-155112»
      var datos = { id: id + (ensayo ? '-ensayo' : ''), titulo: titulo, ensayo: ensayo, cierre: isoCol(Date.now()), premios: premios, ronda: ronda };
      return N.armarPublico(datos, prep.participantes).then(function (pub) {
        var problemas = N.validar(pub);
        if (problemas.length) throw new Error(problemas[0]);
        est.publico = pub;
        est.privado = {
          formato: N.FORMATO + '-privado',
          aviso: 'ARCHIVO PRIVADO: tiene datos personales y las sales de los compromisos. No lo publiques ni lo subas al repositorio.',
          id: pub.id, huella: pub.huella, columnas: est.cabeceras,
          revelable: idRevelable(),   // el código del enlace abre la boleta y el celular es un dato personal: no se revelan
          participantes: prep.participantes.map(function (p) {
            return { posicion: p.posicion, etiqueta: p.etiqueta, id: p.id, idOriginal: p.idOriginal, nombre: p.nombre, sal: p.sal, fila: p.fila };
          })
        };
        cargado.publico = null;
        cargado.privado = null;
        if (!pub.ensayo) {
          var dia = leerLocal(CLAVE_DIA).filter(function (x) { return x.id !== pub.id; });
          dia.push(entradaIndice(pub));
          guardarLocal(CLAVE_DIA, dia);
          pintarPremiosEvento();
        }
        guardarUltimo();
        pintarResumen(pub, prep, reg, !!op.ronda);
        publicar(pub);
        buscarGanadores();
        return pub;
      });
    }).catch(function (e) { mostrarError(e.message || String(e)); throw e; });
  }

  function pintarResumen(pub, prep, reg, sinMover) {
    var hora = N.horaDeRonda(pub.azar.ronda), caja = vaciar($('o-resumen'));
    var url = location.origin + '/sorteos/?id=' + pub.id;
    var fuera = [];
    if (reg.filtradas) fuera.push(reg.filtradas.toLocaleString('es-CO') + ' filas quedaron fuera por el filtro');
    if (prep.sinId) fuera.push(prep.sinId.toLocaleString('es-CO') + ' filas sin identificador');
    if (prep.duplicados) fuera.push(prep.duplicados.toLocaleString('es-CO') + ' repetidas (se contaron una vez)');
    if (reg.yaGanaron) fuera.push(reg.yaGanaron.toLocaleString('es-CO') + ' de quienes ya ganaron hoy');
    caja.appendChild(h('div', null, [
      pub.ensayo ? h('span', { class: 'sello-ensayo', text: 'Ensayo · no oficial' }) : null,
      h('p', { class: 'grande' }, [h('b', { text: pub.participantes.length.toLocaleString('es-CO') }), ' participaciones en «' + pub.titulo + '»']),
      fuera.length ? h('p', { class: 'ayuda', text: 'No participan: ' + fuera.join(' · ') + '.' }) : null,
      h('p', { text: 'Sorteo: ' + V.fechaCol(hora) + ' a las ' + V.horaCol(hora, true) + ' · ronda ' + pub.azar.ronda.toLocaleString('es-CO') + ' de drand quicknet.' }),
      h('p', { class: 'l', text: 'Huella del acta (muéstrala en pantalla antes del sorteo):' }),
      h('p', { class: 'huella-grande', text: pub.huella.slice(0, 8) + ' ' + pub.huella.slice(8, 16) }),
      h('code', { class: 'sv-huella-txt', text: pub.huella }),
      h('p', null, ['Enlace público: ', h('code', { text: url })]),
      h('p', null, ['Pantalla del evento: ', h('code', { text: url + '&pantalla' })])
    ]));
    $('o-enlace-pantalla').href = '/sorteos/?id=' + encodeURIComponent(pub.id) + '&pantalla';
    $('o-enlace-pantalla').hidden = true;
    $('o-publicar').hidden = true;
    $('o-despublicar').hidden = true;
    $('paso4').hidden = false;
    if (!sinMover) $('paso4').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------------- 4 · archivos ---------------- */
  // El archivo público queda legible y con un participante por línea (fácil de revisar en GitHub).
  function jsonPublico(s) {
    var copia = {}, orden = ['formato', 'id', 'titulo', 'ensayo', 'cierre', 'premios', 'azar', 'huella', 'revelaciones'];
    orden.forEach(function (k) { if (s[k] !== undefined) copia[k] = s[k]; });
    var cuerpo = JSON.stringify(copia, null, 2);
    return cuerpo.slice(0, -2) + ',\n  "participantes": [\n' + s.participantes.map(function (p) { return '    ' + JSON.stringify(p); }).join(',\n') + '\n  ]\n}\n';
  }
  $('o-bajar-publico').addEventListener('click', function () { if (est.publico) V.descargar(est.publico.id + '.json', jsonPublico(est.publico), 'application/json'); });
  $('o-bajar-privado').addEventListener('click', function () { if (est.privado) V.descargar(est.privado.id + '.privado.json', JSON.stringify(est.privado, null, 1), 'application/json'); });
  $('o-bajar-indice').addEventListener('click', function () {
    if (!est.publico) return;
    var p = est.publico;
    fetch('/sorteos/datos/indice.json', { cache: 'no-store', credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
      .then(function (ind) {
        var lista = ind && Array.isArray(ind.sorteos) ? ind.sorteos.filter(function (x) { return x && x.id; }) : [];
        // también los sorteos de hoy generados en este computador que aún no se publicaron
        leerLocal(CLAVE_DIA).concat([entradaIndice(p)]).forEach(function (x) {
          lista = lista.filter(function (y) { return y.id !== x.id; });
          lista.push(x);
        });
        V.descargar('indice.json', JSON.stringify({ formato: N.FORMATO, sorteos: lista }, null, 2) + '\n', 'application/json');
      });
  });

  function entradaIndice(p) { return { id: p.id, titulo: p.titulo, ensayo: p.ensayo, ronda: p.azar.ronda, participantes: p.participantes.length, huella: p.huella }; }

  /* ---------------- publicar en labssummit.com/sorteos (/api/sorteos) ---------------- */
  // Va solo el archivo público: la huella, la ronda y las etiquetas. Nada del archivo privado.
  function publicar(pub) {
    if (!clave()) {
      texto('o-publicado', 'No se publicó solo porque falta la clave del sorteo (paso 1). Escríbela y pulsa «Publicar otra vez», o descarga los archivos y súbelos a GitHub.', 'estado-o mal');
      mostrarBoton('o-publicar', true);
      return;
    }
    texto('o-publicado', 'Publicando en labssummit.com/sorteos…', 'estado-o');
    mostrarBoton('o-publicar', false);
    api('/api/sorteos', jsonPublico(pub)).then(function () {
      if (est.publico !== pub) return;
      guardarClave();
      texto('o-publicado', '✓ Publicado en labssummit.com/sorteos (' + V.horaCol(Date.now(), true) + ')' + (pub.ensayo ? ', marcado como ensayo.' : '. Cualquiera puede revisarlo desde su celular antes de que salga el número.'), 'estado-o bien');
      mostrarBoton('o-enlace-pantalla', true);
      mostrarBoton('o-despublicar', !!pub.ensayo);
    }, function (e) {
      if (est.publico !== pub) return;
      var porque = e.status === 503 ? 'la publicación automática todavía no está activada en Cloudflare.' : e.message;
      texto('o-publicado', 'No se pudo publicar: ' + porque + ' El sorteo sigue siendo válido: proyecta la pantalla desde aquí y luego sube los archivos a GitHub.', 'estado-o mal');
      mostrarBoton('o-publicar', e.status !== 409);
    });
  }
  function mostrarBoton(id, si) { $(id).hidden = !si; }
  $('o-publicar').addEventListener('click', function () { if (est.publico) publicar(est.publico); });
  $('o-despublicar').addEventListener('click', function () {
    var pub = est.publico;
    if (!pub || !confirm('¿Quitar «' + pub.titulo + '» de labssummit.com/sorteos?')) return;
    api('/api/sorteos', { accion: 'borrar', id: pub.id }).then(function () {
      texto('o-publicado', 'Se quitó de la página.', 'estado-o');
      mostrarBoton('o-despublicar', false);
      mostrarBoton('o-enlace-pantalla', false);
      mostrarBoton('o-publicar', true);
    }, function (e) { texto('o-publicado', e.message, 'estado-o mal'); });
  });

  // El último sorteo generado se guarda en este navegador (2 días): si la página se recarga, el paso 5 sigue funcionando
  var CLAVE_ULTIMO = 'lsSorteoUltimo';
  function guardarUltimo() {
    try { localStorage.setItem(CLAVE_ULTIMO, JSON.stringify({ guardado: Date.now(), publico: est.publico, privado: est.privado })); } catch (e) { try { localStorage.removeItem(CLAVE_ULTIMO); } catch (e2) { /* nada */ } }
  }
  function recuperarUltimo() {
    try {
      var u = JSON.parse(localStorage.getItem(CLAVE_ULTIMO) || 'null');
      if (u && !(Date.now() - u.guardado < 2 * 864e5)) { localStorage.removeItem(CLAVE_ULTIMO); return false; }
      if (u && u.publico && u.privado && u.privado.huella === u.publico.huella && !N.validar(u.publico).length) { est.publico = u.publico; est.privado = u.privado; return true; }
    } catch (e) { /* nada */ }
    return false;
  }

  // Nombre completo de quien está en la posición n (sale del archivo privado: solo en esta pantalla, nunca en la web)
  var PARTICULAS = ['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'das', 'do', 'dos', 'van', 'von', 'di'];
  function nombreBonito(nombre) {
    var n = N.limpiar(nombre);
    if (!n || (n !== n.toUpperCase() && n !== n.toLowerCase())) return n;   // si ya viene bien escrito, se deja igual
    return n.toLocaleLowerCase('es').split(' ').map(function (w, i) {
      return i && PARTICULAS.indexOf(w) >= 0 ? w : w.charAt(0).toLocaleUpperCase('es') + w.slice(1);
    }).join(' ');
  }
  function nombreCompleto(pos) {
    var p = est.privado && Array.isArray(est.privado.participantes) ? est.privado.participantes[pos - 1] : null;
    return p ? nombreBonito(p.nombre) : '';
  }

  /* ---------------- sorteo en vivo: N minutos para inscribirse y el ganador ~10 s después ---------------- */
  var PRUEBA_VIVO = window.__LS_SORTEO_PRUEBA || {};   // solo para las pruebas automáticas
  var vivo = null;
  function mostrarPantalla() {
    $('o-pasos').hidden = true;
    $('o-vista-sec').hidden = false;
    document.body.classList.add('modo-pantalla');
  }
  function premioPrincipal() { return $('o-premios').value.split(/\r?\n/).map(N.limpiar).filter(Boolean)[0] || ''; }
  $('o-iniciar').addEventListener('click', function () {
    texto('o-vivo-msg', '');
    if (!clave()) { texto('o-vivo-msg', 'Escribe la clave del sorteo (arriba).', 'estado-o mal'); return $('o-clave').focus(); }
    if (!N.limpiar($('o-titulo').value) || !premioPrincipal()) return texto('o-vivo-msg', 'Elige el premio de este sorteo.', 'estado-o mal');
    var minutos = parseInt($('o-ventana').value, 10) || 5;
    if (est.control) est.control.detener();
    vivo = { fin: Date.now() + (PRUEBA_VIVO.ventanaMs || minutos * 60e3), cerrando: false };
    mostrarPantalla();
    $('o-cerrar-ya').hidden = false;
    var ensayo = $('o-ensayo').checked;
    vaciar($('o-vista')).appendChild(h('div', { class: 'sv-inscripcion' }, [
      h('div', { class: 'svi-texto' }, [
        ensayo ? h('span', { class: 'sello-ensayo', text: 'Ensayo · no es un sorteo oficial' }) : null,
        h('p', { class: 'svi-etiqueta', text: 'Sorteo en vivo' }),
        h('h1', { class: 'sv-titulo', text: N.limpiar($('o-titulo').value) }),
        h('p', { class: 'svi-premio', text: premioPrincipal() }),
        h('div', { class: 'sv-estado' }, [
          h('span', { class: 'l', id: 'svi-l', text: 'Inscríbete antes de que llegue a cero' }),
          h('b', { class: 'sv-cuenta-num', id: 'svi-cuenta', text: '' }),
          h('small', { id: 'svi-nota', text: 'Escanea el QR o entra a labssummit.com/participa. Si ya te registraste hoy, ya estás participando.' })
        ]),
        h('p', { class: 'svi-inscritos', id: 'svi-inscritos' })
      ]),
      h('figure', { class: 'svi-qr' }, [
        h('img', { src: '/sorteos/qr-participa.svg', alt: 'QR para inscribirse: labssummit.com/participa', width: 360, height: 360 }),
        h('figcaption', null, ['labssummit.com/', h('b', { text: 'participa' })])
      ])
    ]));
    vivo.reloj = setInterval(ticVivo, 250);
    vivo.conteo = setInterval(contarInscritos, 10000);
    ticVivo();
    contarInscritos();
  });
  function ticVivo() {
    if (!vivo || vivo.cerrando) return;
    var falta = vivo.fin - Date.now();
    if (falta <= 0) return cerrarEnVivo();
    var m = Math.floor(falta / 6e4), sg = Math.ceil(falta % 6e4 / 1e3);
    if (sg === 60) { m++; sg = 0; }
    var e = $('svi-cuenta'), txt = (m < 10 ? '0' : '') + m + ':' + (sg < 10 ? '0' : '') + sg;
    if (e.textContent !== txt) e.textContent = txt;
    e.classList.toggle('final', falta < 10500);
  }
  function contarInscritos() {
    fetch('/api/participa', { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (d) {
      var e = $('svi-inscritos');
      if (e && typeof d.total === 'number') e.textContent = d.total === 1 ? '1 persona inscrita' : miles(d.total) + ' personas inscritas';
    }).catch(function () { /* sin señal: queda el último número */ });
  }
  function pararVivo() {
    if (!vivo) return;
    clearInterval(vivo.reloj);
    clearInterval(vivo.conteo);
    clearTimeout(vivo.reintento);
    vivo = null;
    $('o-cerrar-ya').hidden = true;
  }
  // Al llegar a cero: trae los inscritos, cierra la lista, elige una ronda de drand ~10 s después (con la hora del servidor) y la publica
  function cerrarEnVivo() {
    if (!vivo || vivo.cerrando) return;
    vivo.cerrando = true;
    clearInterval(vivo.reloj);
    clearInterval(vivo.conteo);
    $('o-cerrar-ya').hidden = true;
    var aviso = function (t, mal) {
      var l = $('svi-l'), c = $('svi-cuenta'), n = $('svi-nota');
      if (l) l.textContent = '¡Se cerró la inscripción!';
      if (c) { c.textContent = '00:00'; c.classList.remove('final'); }
      if (n) { n.textContent = t; n.className = mal ? 'mal' : ''; }
    };
    aviso('Preparando el sorteo…');
    var intentos = 0;
    (function intentar() {
      api('/api/registros').then(function (d) {
        var lista = Array.isArray(d.registros) ? d.registros : [];
        if (!lista.length) throw new Error('No hay nadie inscrito.');
        usarRegistros(lista);
        var desfase = d._fecha ? Date.parse(d._fecha) - Date.now() : 0;
        if (!(Math.abs(desfase) > 1500)) desfase = 0;   // la cabecera Date va de segundo en segundo
        return generar({ ronda: PRUEBA_VIVO.rondaVivo || N.rondaEn(Date.now() + desfase + 10000) });
      }).then(function (pub) {
        pararVivo();
        var priv = est.privado;
        est.control = V.mostrar($('o-vista'), pub, { pantalla: true, nombres: nombreCompleto, alTerminar: function (r) { guardarEnHistorial(pub, priv, r.ganadores); } });
        $('o-vista').appendChild(h('p', { class: 'sv-pie-pantalla', text: 'Verifícalo en tu celular: labssummit.com/sorteos' }));
      }, function (e) {
        if (!vivo) return;
        var deRed = !e.status && /conexión/.test(e.message || '') || e.status >= 500;
        if (deRed && ++intentos < 6) { aviso('Sin conexión, reintentando…'); vivo.reintento = setTimeout(intentar, 2500); return; }
        aviso('No se pudo hacer el sorteo: ' + (e.message || e) + ' Vuelve a la herramienta para revisarlo.', true);
        pararVivo();
      });
    })();
  }
  $('o-cerrar-ya').addEventListener('click', function () {
    if (vivo && confirm('¿Cerrar la inscripción ya? Participan los inscritos hasta este momento.')) cerrarEnVivo();
  });

  /* ---------------- pantalla (vista previa local) ---------------- */
  $('o-pantalla').addEventListener('click', function () {
    if (!est.publico) return;
    $('o-pasos').hidden = true;
    $('o-vista-sec').hidden = false;
    document.body.classList.add('modo-pantalla');
    var pub = est.publico, priv = est.privado && est.privado.huella === est.publico.huella ? est.privado : null;
    est.control = V.mostrar($('o-vista'), pub, { pantalla: true, nombres: priv ? nombreCompleto : null, alTerminar: function (r) { guardarEnHistorial(pub, priv, r.ganadores); } });
    $('o-vista').appendChild(h('p', { class: 'sv-pie-pantalla', text: 'Verifícalo en tu celular: labssummit.com/sorteos' }));
  });
  $('o-cerrar-vista').addEventListener('click', function () {
    if (vivo && !vivo.cerrando && !confirm('¿Cancelar el sorteo en vivo? Todavía no se ha cerrado la lista.')) return;
    pararVivo();
    if (est.control) est.control.detener();
    document.body.classList.remove('modo-pantalla');
    $('o-vista-sec').hidden = true;
    $('o-pasos').hidden = false;
  });

  /* ---------------- 5 · ganadores (con el archivo privado) ---------------- */
  function leerJSON(input, clave) {
    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      if (!f) return;
      f.text().then(JSON.parse).then(function (x) { cargado[clave] = x; buscarGanadores(); },
        function () { texto('o-estado-ganadores', 'El archivo «' + f.name + '» no es un JSON válido.', 'estado-o mal'); });
    });
  }
  leerJSON($('o-privado'), 'privado');
  leerJSON($('o-publico'), 'publico');

  function buscarGanadores() {
    clearTimeout(reintento);
    var priv = cargado.privado || est.privado, pub = cargado.publico || est.publico;
    vaciar($('o-ganadores'));
    if (!priv || !Array.isArray(priv.participantes)) return texto('o-estado-ganadores', 'Genera un sorteo o carga el archivo privado de uno anterior.', 'estado-o');
    if (!pub) return texto('o-estado-ganadores', 'Carga también el archivo público del sorteo.', 'estado-o');
    if (priv.huella !== pub.huella) return texto('o-estado-ganadores', 'El archivo privado no corresponde a ese sorteo: las huellas son distintas.', 'estado-o mal');
    var problemas = N.validar(pub);
    if (problemas.length) return texto('o-estado-ganadores', problemas[0], 'estado-o mal');
    var hora = N.horaDeRonda(pub.azar.ronda);
    if (Date.now() < hora) {
      texto('o-estado-ganadores', 'El sorteo es a las ' + V.horaCol(hora, true) + ': deja esta página abierta y los ganadores aparecen solos.', 'estado-o');
      reintento = setTimeout(buscarGanadores, Math.min(hora - Date.now() + 1500, 60e3));
      return;
    }
    texto('o-estado-ganadores', 'Trayendo la ronda ' + pub.azar.ronda + ' de drand…', 'estado-o');
    N.pedirRonda(pub.azar.ronda).then(function (ronda) { return N.verificar(pub, ronda); }).then(function (res) {
      if (res.problemas.length) return texto('o-estado-ganadores', res.problemas[0], 'estado-o mal');
      return Promise.all(res.ganadores.map(function (g) {
        var p = priv.participantes[g.posicion - 1];
        if (!p) return { g: g, p: null, ok: false };
        return N.compromisoDe(p.sal, p.id).then(function (c) { return { g: g, p: p, ok: c === g.compromiso }; });
      })).then(function (xs) { pintarGanadores(pub, priv, xs); });
    }, function (e) {
      texto('o-estado-ganadores', e.tipo === 'pendiente' ? 'La ronda aún no sale. Reintentando…' : e.message + ' Reintentando…', 'estado-o');
      reintento = setTimeout(buscarGanadores, e.tipo === 'pendiente' ? 2000 : 5000);
    });
  }

  // Quien gana un premio (no un puesto de suplente) queda fuera de los próximos sorteos del día.
  // Si un suplente recibe el premio, se marca con su botón; si un ganador no lo recibió, se quita.
  function botonGanador(x, pub) {
    var b = h('button', { type: 'button', class: 'btn sec' });
    function pintar() { b.textContent = yaGano(x.p.id) ? 'Recibió el premio ✓ (quitar)' : 'Marcar que recibió el premio'; }
    b.addEventListener('click', function () { marcarGanador(x.p, x.g.premio, pub.titulo, !yaGano(x.p.id)); pintar(); });
    pintar();
    return b;
  }
  function pintarGanadores(pub, priv, xs) {
    var caja = vaciar($('o-ganadores'));
    var todosOk = xs.every(function (x) { return x.ok; });
    var marcados = Object.create(null);
    leerLocal(CLAVE_DIA + '.marcados').forEach(function (id) { marcados[id] = true; });
    if (todosOk) guardarEnHistorial(pub, priv, xs.map(function (x) { return x.g; }));
    if (todosOk && !pub.ensayo && !marcados[pub.id]) {   // solo la primera vez que se ven los ganadores de este sorteo
      xs.forEach(function (x) { if (!/suplente/i.test(x.g.premio)) marcarGanador(x.p, x.g.premio, pub.titulo, true); });
      guardarLocal(CLAVE_DIA + '.marcados', Object.keys(marcados).concat([pub.id]));
    }
    texto('o-estado-ganadores', todosOk ? 'Sorteo verificado. Estos son los datos de contacto (privados) de los ganadores:' : 'Atención: algún ganador no coincide con el archivo privado. Revisa que sean los archivos correctos.', todosOk ? 'estado-o bien' : 'estado-o mal');
    xs.forEach(function (x) {
      var filas = [];
      if (x.p && Array.isArray(x.p.fila)) x.p.fila.forEach(function (v, i) { filas.push(h('tr', null, [h('th', { text: (priv.columnas && priv.columnas[i]) || 'Columna ' + (i + 1) }), h('td', { text: v })])); });
      caja.appendChild(h('article', { class: 'tarjeta-ganador' + (x.ok ? '' : ' mal') }, [
        h('span', { class: 'l', text: 'Premio ' + x.g.numeroPremio + ': ' + x.g.premio }),
        h('b', { text: x.g.etiqueta + ' · n.º ' + x.g.posicion }),
        h('p', { text: x.ok ? '✓ Coincide con el compromiso publicado.' : '✕ No coincide con el compromiso publicado.' }),
        x.p ? h('p', { text: 'Identificador: ' + x.p.idOriginal + (x.p.nombre ? ' · ' + x.p.nombre : '') }) : null,
        filas.length ? h('table', { class: 'datos-fila' }, [h('tbody', null, filas)]) : null,
        x.p && x.ok ? botonGanador(x, pub) : null
      ]));
    });
    if (todosOk && priv.revelable !== true) {
      caja.appendChild(h('p', { class: 'ayuda', text: 'Este sorteo no tiene revelación pública: el identificador es un dato personal (como el celular) o el código que abre la boleta.' }));
    } else if (todosOk) {
      caja.appendChild(h('p', { class: 'ayuda', text: 'Opcional: publica la revelación para que cualquiera compruebe que el ganador corresponde a esa boleta. Hazlo solo si el identificador es el código de la boleta o de la orden, nunca una cédula, un teléfono o un correo.' }));
      caja.appendChild(h('button', { type: 'button', class: 'btn', text: 'Descargar archivo público con la revelación', onclick: function () {
        var conRev = JSON.parse(JSON.stringify(pub));
        conRev.revelaciones = xs.map(function (x) { return { posicion: x.g.posicion, id: x.p.id, sal: x.p.sal }; });
        V.descargar(pub.id + '.json', jsonPublico(conRev), 'application/json');
      } }));
    }
  }

  // Si el último sorteo aún no sale (o salió hace poco), vuelve a quedar a mano la pantalla
  /* ---------------- historial de ganadores (todos los sorteos publicados, también los ensayos) ---------------- */
  // El ganador sale de la fórmula pública; su nombre completo y su celular, de los registros del QR
  // (la etiqueta pública «Ana P. · …1234» se busca entre los inscritos) o del archivo privado si es el último de este computador.
  $('o-ver-historial').addEventListener('click', function () {
    var b = this;
    if (!clave()) { texto('o-historial-estado', 'Escribe la clave del sorteo (paso 1).', 'estado-o mal'); return $('o-clave').focus(); }
    b.disabled = true;
    vaciar($('o-historial-lista'));
    texto('o-historial-estado', 'Buscando los sorteos…', 'estado-o');
    var locales = leerLocal(CLAVE_HISTORIAL), local = Object.create(null);
    locales.forEach(function (l) { local[l.id + '|' + l.huella] = l; });
    Promise.all([api('/api/sorteos').catch(function () { return null; }), api('/api/registros').catch(function () { return {}; })]).then(function (xs) {
      var servidor = xs[0] ? (xs[0].sorteos || []).slice(0, 30) : [], porEtiqueta = Object.create(null), enServidor = Object.create(null);
      (xs[1].registros || []).forEach(function (r) { var e = N.etiquetaDe(r.nombre, r.celular); (porEtiqueta[e] = porEtiqueta[e] || []).push(r); });
      servidor.forEach(function (x) { enServidor[x.id + '|' + x.huella] = true; });
      var todos = servidor.map(function (x) { return { x: x, local: local[x.id + '|' + x.huella] || null }; })
        .concat(locales.filter(function (l) { return !enServidor[l.id + '|' + l.huella]; }).map(function (l) { return { x: l, local: l, soloAqui: true }; }));
      todos.sort(function (a, b) { return b.x.ronda - a.x.ronda; });
      if (!todos.length) return texto('o-historial-estado', xs[0] ? 'No hay sorteos publicados.' : 'No se pudo consultar labssummit.com.', 'estado-o');
      texto('o-historial-estado', miles(todos.length) + (todos.length === 1 ? ' sorteo' : ' sorteos') + ', del más reciente al más antiguo' + (xs[0] ? ':' : ' (sin conexión: solo los de este computador):'), 'estado-o bien');
      return todos.reduce(function (cadena, t) { return cadena.then(function () { return tarjetaHistorial(t, porEtiqueta); }); }, Promise.resolve());
    }).catch(function (e) { texto('o-historial-estado', e.message || String(e), 'estado-o mal'); })
      .finally(function () { b.disabled = false; });
  });
  function filaHistorial(premio, quien, etiqueta, titulo) {
    return h('li', null, [
      h('span', { class: 'pr', text: premio }),
      h('b', { text: quien.length ? quien.map(function (q) { return nombreBonito(q.nombre) + ' · ' + q.celular; }).join(' / ') : etiqueta }),
      quien.length === 1 ? botonRecibio({ id: N.normalizarId(quien[0].celular), etiqueta: etiqueta }, premio, titulo)
        : h('small', { text: quien.length ? '(' + quien.length + ' inscritos tienen esa misma etiqueta)' : '(ya no está en los registros: ' + etiqueta + ')' })
    ]);
  }
  function tarjetaHistorial(t, porEtiqueta) {
    var x = t.x, hora = N.horaDeRonda(x.ronda), nota = h('p', { class: 'ayuda', text: 'Calculando el resultado…' });
    var tarjeta = h('article', { class: 'tarjeta-historial' + (t.soloAqui ? ' solo-aqui' : '') }, [
      h('div', { class: 'th-cab' }, [
        x.ensayo ? h('span', { class: 'sello-ensayo', text: 'Ensayo' }) : null,
        h('b', { text: x.titulo }),
        h('small', { text: V.fechaCol(hora) + ' · ' + V.horaCol(hora, true) + ' · ' + miles(x.participantes) + ' participantes' }),
        t.soloAqui ? h('small', { class: 'th-aviso', text: 'No quedó publicado en labssummit.com: está anotado en este computador.' }) : null
      ]),
      nota
    ]);
    $('o-historial-lista').appendChild(tarjeta);
    // lo anotado en este computador trae el nombre exacto de quien salió en la pantalla
    if (t.local) {
      tarjeta.replaceChild(h('ul', { class: 'th-ganadores' }, t.local.ganadores.map(function (g) {
        return filaHistorial(g.premio, g.nombre ? [{ nombre: g.nombre, celular: g.celular }] : [], g.etiqueta, x.titulo);
      })), nota);
      return Promise.resolve();
    }
    if (Date.now() < hora) { nota.textContent = 'Todavía no sale: es a las ' + V.horaCol(hora, true) + '.'; return Promise.resolve(); }
    return api('/api/sorteos?id=' + encodeURIComponent(x.id)).then(function (pub) {
      return N.pedirRonda(pub.azar.ronda).then(function (ronda) { return N.verificar(pub, ronda); }).then(function (r) {
        if (r.problemas.length) { nota.textContent = r.problemas[0]; return; }
        var privado = est.privado && est.privado.huella === pub.huella ? est.privado : null;
        tarjeta.replaceChild(h('ul', { class: 'th-ganadores' }, r.ganadores.map(function (g) {
          var p = privado ? privado.participantes[g.posicion - 1] : null;
          return filaHistorial(g.premio, p ? [{ nombre: p.nombre, celular: p.idOriginal }] : porEtiqueta[g.etiqueta] || [], g.etiqueta, pub.titulo);
        })), nota);
      });
    }).catch(function (e) { nota.textContent = 'No se pudo calcular: ' + (e.message || e); });
  }

  if (recuperarUltimo()) {
    if (N.horaDeRonda(est.publico.azar.ronda) > Date.now() - 30 * 60e3) {
      pintarResumen(est.publico, {}, {}, true);
      texto('o-publicado', 'Es el último sorteo que generaste en este computador. Si no alcanzó a publicarse, pulsa «Publicar otra vez».', 'estado-o');
      mostrarBoton('o-publicar', true);
      mostrarBoton('o-enlace-pantalla', true);
    }
    buscarGanadores();
  }
})();
