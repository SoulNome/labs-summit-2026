/* Labs Summit 2026 · herramienta del organizador (/sorteos/organizador.html)
   Lee la lista de boletas (el Excel de Coccoa, CSV o filas pegadas desde Excel),
   cierra la lista, genera el archivo público (sin datos personales) y el privado,
   y al final muestra los datos de contacto de los ganadores. Nada sale de este computador. */
(function () {
  'use strict';

  var N = window.LSSorteo, V = window.LSVista, h = V.h, vaciar = V.vaciar;
  var $ = function (s) { return document.getElementById(s); };
  var est = { cabeceras: [], filas: [], archivos: [], publico: null, privado: null, control: null, fechas: -1 };
  var cargado = { privado: null, publico: null }, reintento = null;

  function sinTildes(s) { return N.limpiar(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function texto(id, t, clase) { var e = $(id); e.textContent = t || ''; e.className = clase || e.className; return e; }
  function mostrarError(t) { var e = $('o-error'); e.textContent = t; e.hidden = !t; }
  // Colombia no tiene horario de verano: siempre UTC−5
  function valorLocal(ms) { return new Date(ms - 5 * 3600e3).toISOString().slice(0, 16); }
  function msDeLocal(v) { return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v || '') ? Date.parse(v + ':00-05:00') : NaN; }
  function isoCol(ms) { return new Date(ms - 5 * 3600e3).toISOString().slice(0, 19) + '-05:00'; }
  function miles(n) { return n.toLocaleString('es-CO'); }

  /* ---------------- 1 · leer la lista ---------------- */
  $('o-archivo').addEventListener('change', function (e) {
    var fs = Array.prototype.slice.call(e.target.files || []);
    est.archivos = [];
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
    if (!$('o-hora').value) $('o-hora').value = valorLocal(Math.ceil((Date.now() + 20 * 60e3) / 3e5) * 3e5);
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
    var r = [], fuera = 0;
    est.filas.forEach(function (f) {
      for (var g = 0; g < filtros.length; g++) {
        if (!filtros[g].ok[N.limpiar(celda(f, filtros[g].columna)) || '(vacío)']) { fuera++; return; }
      }
      r.push({ id: celda(f, ci), nombre: cn >= 0 ? celda(f, cn) : '', visible: cv === -2 ? null : celda(f, cv), cantidad: cc >= 0 ? celda(f, cc) : 1, fila: f });
    });
    return { lista: r, filtradas: fuera };
  }
  function etiquetaPrevia(x) {
    return N.etiquetaDe(x.nombre, x.visible === null ? '' : N.limpiar(x.visible) ? x.visible : x.id);
  }
  function idDeEnlace() { return /^codigo del enlace/.test(sinTildes(est.cabeceras[col('o-col-id')] || '')); }

  function pintarMuestra() {
    var reg = registros(), r = reg.lista, caja = vaciar($('o-muestra'));
    r.slice(0, 6).forEach(function (x) { caja.appendChild(h('li', { text: etiquetaPrevia(x) })); });
    if (!r.length) caja.appendChild(h('li', { class: 'mal', text: 'Con estos filtros no queda nadie.' }));
    pintarAvisos(reg);
  }

  function pintarAvisos(reg) {
    var caja = vaciar($('o-avisos')), r = reg.lista;
    function aviso(t, clase) { caja.appendChild(h('p', { class: clase || 'aviso', text: t })); }
    aviso(miles(r.length) + ' de ' + miles(est.filas.length) + ' filas participan con estos filtros. Compara el total con tu fuente (el formulario del QR o Coccoa).', 'ayuda');
    // rango de ventas: confirma que el archivo se bajó a la hora de cierre y trae las ventas de hoy
    if (est.fechas >= 0) {
      var fechas = r.map(function (x) { return String(celda(x.fila, est.fechas)); }).filter(function (v) { return /^\d{4}-\d{2}-\d{2}/.test(v); }).sort();
      if (fechas.length) aviso('El archivo trae registros desde ' + fechas[0] + ' hasta ' + fechas[fechas.length - 1] + '. Si llegaron más después, vuelve a descargarlo.', 'ayuda');
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
  $('o-hora').addEventListener('input', pintarRonda);
  $('o-ensayo').addEventListener('change', pintarRonda);
  function pintarRonda() {
    var ms = msDeLocal($('o-hora').value), e = $('o-ronda');
    if (isNaN(ms)) { e.textContent = ''; return; }
    var r = N.rondaEn(ms), hora = N.horaDeRonda(r);
    var txt = 'Se usará la ronda ' + r.toLocaleString('es-CO') + ' de drand quicknet, que sale el ' + V.fechaCol(hora) + ' a las ' + V.horaCol(hora, true) + '.';
    if (!$('o-ensayo').checked && hora < Date.now() + 3 * 60e3) txt += ' ⚠ Debe ser al menos 3 minutos en el futuro.';
    e.textContent = txt;
  }

  $('o-generar').addEventListener('click', function () {
    mostrarError('');
    var titulo = N.limpiar($('o-titulo').value);
    var premios = $('o-premios').value.split(/\r?\n/).map(N.limpiar).filter(Boolean);
    var horaMs = msDeLocal($('o-hora').value), ensayo = $('o-ensayo').checked;
    if (!est.filas.length) return mostrarError('Primero lee la lista (paso 1).');
    if (!titulo) return mostrarError('Escribe el título del sorteo.');
    if (!premios.length) return mostrarError('Escribe al menos un premio.');
    if (premios.length > 50) return mostrarError('Máximo 50 premios por sorteo.');
    if (isNaN(horaMs)) return mostrarError('Elige la fecha y la hora del sorteo.');
    var ronda = N.rondaEn(horaMs);
    if (!ensayo && N.horaDeRonda(ronda) < Date.now() + 3 * 60e3) {
      return mostrarError('La hora del sorteo debe ser al menos 3 minutos después de cerrar la lista: así nadie conoce el azar cuando se cierra. Si solo quieres probar, marca «Es un ensayo».');
    }
    var reg = registros();
    var boton = $('o-generar');
    boton.disabled = true; boton.textContent = 'Generando…';
    N.prepararParticipantes(reg.lista).then(function (prep) {
      if (prep.participantes.length < premios.length) throw new Error('Hay ' + prep.participantes.length + ' participantes y ' + premios.length + ' premios: debe haber al menos un participante por premio.');
      var datos = { id: N.idSorteo(titulo, horaMs) + (ensayo ? '-ensayo' : ''), titulo: titulo, ensayo: ensayo, cierre: isoCol(Date.now()), premios: premios, ronda: ronda };
      return N.armarPublico(datos, prep.participantes).then(function (pub) {
        var problemas = N.validar(pub);
        if (problemas.length) throw new Error(problemas[0]);
        est.publico = pub;
        est.privado = {
          formato: N.FORMATO + '-privado',
          aviso: 'ARCHIVO PRIVADO: tiene datos personales y las sales de los compromisos. No lo publiques ni lo subas al repositorio.',
          id: pub.id, huella: pub.huella, columnas: est.cabeceras,
          revelable: !idDeEnlace(),   // el código del enlace abre la boleta: nunca se revela
          participantes: prep.participantes.map(function (p) {
            return { posicion: p.posicion, etiqueta: p.etiqueta, id: p.id, idOriginal: p.idOriginal, nombre: p.nombre, sal: p.sal, fila: p.fila };
          })
        };
        cargado.publico = null;
        pintarResumen(pub, prep, reg);
      });
    }).catch(function (e) { mostrarError(e.message || String(e)); })
      .finally(function () { boton.disabled = false; boton.textContent = 'Cerrar la lista y generar el sorteo'; });
  });

  function pintarResumen(pub, prep, reg) {
    var hora = N.horaDeRonda(pub.azar.ronda), caja = vaciar($('o-resumen'));
    var url = location.origin + '/sorteos/?id=' + pub.id;
    var fuera = [];
    if (reg.filtradas) fuera.push(reg.filtradas.toLocaleString('es-CO') + ' filas quedaron fuera por el filtro');
    if (prep.sinId) fuera.push(prep.sinId.toLocaleString('es-CO') + ' filas sin identificador');
    if (prep.duplicados) fuera.push(prep.duplicados.toLocaleString('es-CO') + ' repetidas (se contaron una vez)');
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
    $('paso4').hidden = false;
    $('paso4').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        var lista = ind && Array.isArray(ind.sorteos) ? ind.sorteos.filter(function (x) { return x && x.id !== p.id; }) : [];
        lista.push({ id: p.id, titulo: p.titulo, ensayo: p.ensayo, ronda: p.azar.ronda, participantes: p.participantes.length, huella: p.huella });
        V.descargar('indice.json', JSON.stringify({ formato: N.FORMATO, sorteos: lista }, null, 2) + '\n', 'application/json');
      });
  });

  /* ---------------- pantalla (vista previa local) ---------------- */
  $('o-pantalla').addEventListener('click', function () {
    if (!est.publico) return;
    $('o-pasos').hidden = true;
    $('o-vista-sec').hidden = false;
    document.body.classList.add('modo-pantalla');
    est.control = V.mostrar($('o-vista'), est.publico, { pantalla: true });
    $('o-vista').appendChild(h('p', { class: 'sv-pie-pantalla', text: 'Verifícalo en tu celular: labssummit.com/sorteos' }));
  });
  $('o-cerrar-vista').addEventListener('click', function () {
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
    var priv = cargado.privado, pub = cargado.publico || est.publico;
    vaciar($('o-ganadores'));
    if (!priv || !Array.isArray(priv.participantes)) return texto('o-estado-ganadores', 'Carga el archivo privado del sorteo.', 'estado-o');
    if (!pub) return texto('o-estado-ganadores', 'Carga también el archivo público del sorteo.', 'estado-o');
    if (priv.huella !== pub.huella) return texto('o-estado-ganadores', 'El archivo privado no corresponde a ese sorteo: las huellas son distintas.', 'estado-o mal');
    var problemas = N.validar(pub);
    if (problemas.length) return texto('o-estado-ganadores', problemas[0], 'estado-o mal');
    var hora = N.horaDeRonda(pub.azar.ronda);
    if (Date.now() < hora) {
      texto('o-estado-ganadores', 'El sorteo es a las ' + V.horaCol(hora, true) + '. Deja esta página abierta: los ganadores aparecen solos.', 'estado-o');
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

  function pintarGanadores(pub, priv, xs) {
    var caja = vaciar($('o-ganadores'));
    var todosOk = xs.every(function (x) { return x.ok; });
    texto('o-estado-ganadores', todosOk ? 'Sorteo verificado. Estos son los datos de contacto (privados) de los ganadores:' : 'Atención: algún ganador no coincide con el archivo privado. Revisa que sean los archivos correctos.', todosOk ? 'estado-o bien' : 'estado-o mal');
    xs.forEach(function (x) {
      var filas = [];
      if (x.p && Array.isArray(x.p.fila)) x.p.fila.forEach(function (v, i) { filas.push(h('tr', null, [h('th', { text: (priv.columnas && priv.columnas[i]) || 'Columna ' + (i + 1) }), h('td', { text: v })])); });
      caja.appendChild(h('article', { class: 'tarjeta-ganador' + (x.ok ? '' : ' mal') }, [
        h('span', { class: 'l', text: 'Premio ' + x.g.numeroPremio + ': ' + x.g.premio }),
        h('b', { text: x.g.etiqueta + ' · n.º ' + x.g.posicion }),
        h('p', { text: x.ok ? '✓ Coincide con el compromiso publicado.' : '✕ No coincide con el compromiso publicado.' }),
        x.p ? h('p', { text: 'Identificador: ' + x.p.idOriginal + (x.p.nombre ? ' · ' + x.p.nombre : '') }) : null,
        filas.length ? h('table', { class: 'datos-fila' }, [h('tbody', null, filas)]) : null
      ]));
    });
    if (todosOk && priv.revelable === false) {
      caja.appendChild(h('p', { class: 'ayuda', text: 'La revelación pública no está disponible: el identificador es el código del enlace de la boleta y con él se podría abrir.' }));
    } else if (todosOk) {
      caja.appendChild(h('p', { class: 'ayuda', text: 'Opcional: publica la revelación para que cualquiera compruebe que el ganador corresponde a esa boleta. Hazlo solo si el identificador es el código de la boleta o de la orden, nunca una cédula, un teléfono o un correo.' }));
      caja.appendChild(h('button', { type: 'button', class: 'btn', text: 'Descargar archivo público con la revelación', onclick: function () {
        var conRev = JSON.parse(JSON.stringify(pub));
        conRev.revelaciones = xs.map(function (x) { return { posicion: x.g.posicion, id: x.p.id, sal: x.p.sal }; });
        V.descargar(pub.id + '.json', jsonPublico(conRev), 'application/json');
      } }));
    }
  }
})();
