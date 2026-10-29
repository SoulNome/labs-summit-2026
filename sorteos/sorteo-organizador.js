/* Labs Summit 2026 · herramienta del organizador (/sorteos/organizador.html)
   Lee la lista de boletas (CSV o pegado desde Excel), cierra la lista, genera el
   archivo público (sin datos personales) y el privado, y al final muestra los
   datos de contacto de los ganadores. Nada sale de este computador. */
(function () {
  'use strict';

  var N = window.LSSorteo, V = window.LSVista, h = V.h, vaciar = V.vaciar;
  var $ = function (s) { return document.getElementById(s); };
  var est = { cabeceras: [], filas: [], archivos: [], publico: null, privado: null, control: null };
  var cargado = { privado: null, publico: null }, reintento = null;

  function sinTildes(s) { return N.limpiar(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function texto(id, t, clase) { var e = $(id); e.textContent = t || ''; e.className = clase || e.className; return e; }
  function mostrarError(t) { var e = $('o-error'); e.textContent = t; e.hidden = !t; }
  // Colombia no tiene horario de verano: siempre UTC−5
  function valorLocal(ms) { return new Date(ms - 5 * 3600e3).toISOString().slice(0, 16); }
  function msDeLocal(v) { return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v || '') ? Date.parse(v + ':00-05:00') : NaN; }
  function isoCol(ms) { return new Date(ms - 5 * 3600e3).toISOString().slice(0, 19) + '-05:00'; }

  /* ---------------- 1 · leer la lista ---------------- */
  $('o-archivo').addEventListener('change', function (e) {
    var fs = Array.prototype.slice.call(e.target.files || []);
    est.archivos = [];
    texto('o-archivos', '');
    if (!fs.length) return;
    Promise.all(fs.map(function (f) {
      return f.arrayBuffer().then(function (b) { return { nombre: f.name, texto: N.decodificar(b) }; });
    })).then(function (xs) {
      est.archivos = xs;
      texto('o-archivos', xs.map(function (x) { return x.nombre; }).join(', '));
      leer();
    });
  });
  $('o-leer').addEventListener('click', leer);
  $('o-encabezado').addEventListener('change', function () { if (est.filas.length) leer(); });

  function leer() {
    var fuentes = est.archivos.map(function (x) { return x.texto; });
    if ($('o-pegar').value.trim()) fuentes.push($('o-pegar').value);
    if (!fuentes.length) { texto('o-leido', 'Sube un archivo o pega la lista.', 'estado-o mal'); return; }
    var conTitulos = $('o-encabezado').checked, cab = null, filas = [], distintas = false;
    fuentes.forEach(function (t) {
      var tabla = N.leerTabla(t);
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
    texto('o-leido', 'Leímos ' + filas.length.toLocaleString('es-CO') + ' filas con ' + ancho + ' columnas.', 'estado-o bien');
    llenarColumnas();
    $('paso2').hidden = false;
    $('paso3').hidden = false;
    if (!$('o-hora').value) $('o-hora').value = valorLocal(Math.ceil((Date.now() + 20 * 60e3) / 3e5) * 3e5);
    pintarRonda();
  }

  /* ---------------- 2 · columnas ---------------- */
  function adivinar(patrones, excluir) {
    for (var p = 0; p < patrones.length; p++) {
      for (var i = 0; i < est.cabeceras.length; i++) {
        if (excluir.indexOf(i) < 0 && patrones[p].test(sinTildes(est.cabeceras[i]))) return i;
      }
    }
    return -1;
  }
  function opciones(sel, opcional, elegida) {
    vaciar(sel);
    if (opcional) sel.appendChild(h('option', { value: '', text: '— ninguna —' }));
    est.cabeceras.forEach(function (c, i) { sel.appendChild(h('option', { value: String(i), text: c })); });
    sel.value = elegida >= 0 ? String(elegida) : opcional ? '' : '0';
  }
  function llenarColumnas() {
    var cant = adivinar([/^(cantidad|cant\.?|qty|quantity)\b|cantidad de (boletas|entradas|tickets)/], []);
    var id = adivinar([/(codigo|cod\.)|boleta|ticket|entrada|orden|order|pedido|referencia|localizador/, /cedula|documento|identificacion|\bid\b|numero|correo|e-?mail/], [cant]);
    var nombre = adivinar([/nombre|name|comprador|asistente|cliente|titular/], [id, cant]);
    var filtro = adivinar([/^(estado|status)\b|estado (del )?pago|estado de la orden/], [id, nombre, cant]);
    opciones($('o-col-id'), false, id);
    opciones($('o-col-nombre'), true, nombre);
    opciones($('o-col-cantidad'), true, cant);
    opciones($('o-col-filtro'), true, filtro);
    pintarFiltro();
  }
  ['o-col-id', 'o-col-nombre', 'o-col-cantidad'].forEach(function (s) { $(s).addEventListener('change', pintarMuestra); });
  $('o-col-filtro').addEventListener('change', pintarFiltro);

  function col(sel) { var v = $(sel).value; return v === '' ? -1 : parseInt(v, 10); }
  function celda(fila, i) { return i >= 0 && i < fila.length ? fila[i] : ''; }

  // Valores que normalmente no deben participar (pagos pendientes, anulados…)
  var NO_PAGADO = /pendiente|cancel|rechaz|reembols|devol|devuelt|anulad|fallid|expirad|vencid|declin|refund|pending|failed|void/;
  function pintarFiltro() {
    var i = col('o-col-filtro'), caja = vaciar($('o-valores'));
    $('o-valores-filtro').hidden = i < 0;
    if (i >= 0) {
      var cuenta = Object.create(null), orden = [];
      est.filas.forEach(function (f) { var v = N.limpiar(celda(f, i)) || '(vacío)'; if (!cuenta[v]) { cuenta[v] = 0; orden.push(v); } cuenta[v]++; });
      if (orden.length > 40) {
        caja.appendChild(h('p', { class: 'aviso', text: 'Esta columna tiene ' + orden.length + ' valores distintos: no sirve para filtrar. Elige otra o «ninguna».' }));
      } else {
        orden.sort(function (a, b) { return cuenta[b] - cuenta[a]; }).forEach(function (v) {
          var marcado = !NO_PAGADO.test(sinTildes(v));
          caja.appendChild(h('label', { class: 'check' }, [h('input', { type: 'checkbox', value: v, checked: marcado, onchange: pintarMuestra }), ' ' + v + ' ', h('small', { text: '(' + cuenta[v].toLocaleString('es-CO') + ')' })]));
        });
      }
    }
    pintarMuestra();
  }
  function valoresPermitidos() {
    var i = col('o-col-filtro');
    if (i < 0) return null;
    var cajas = $('o-valores').querySelectorAll('input[type=checkbox]');
    if (!cajas.length) return null;
    var ok = Object.create(null);
    Array.prototype.forEach.call(cajas, function (c) { if (c.checked) ok[c.value] = true; });
    return { columna: i, ok: ok };
  }
  function registros() {
    var ci = col('o-col-id'), cn = col('o-col-nombre'), cc = col('o-col-cantidad'), filtro = valoresPermitidos();
    var r = [], fuera = 0;
    est.filas.forEach(function (f) {
      if (filtro && !filtro.ok[N.limpiar(celda(f, filtro.columna)) || '(vacío)']) { fuera++; return; }
      r.push({ id: celda(f, ci), nombre: cn >= 0 ? celda(f, cn) : '', cantidad: cc >= 0 ? celda(f, cc) : 1, fila: f });
    });
    return { lista: r, filtradas: fuera };
  }
  function pintarMuestra() {
    var r = registros().lista, caja = vaciar($('o-muestra'));
    r.slice(0, 6).forEach(function (x) { caja.appendChild(h('li', { text: N.etiquetaDe(x.nombre, x.id) })); });
    if (!r.length) caja.appendChild(h('li', { class: 'mal', text: 'Con este filtro no queda ninguna fila.' }));
    // ¿El identificador parece un token de acceso (QR)? Entonces no conviene usarlo.
    var muestra = r.slice(0, 50).map(function (x) { return N.limpiar(x.id); }).filter(Boolean);
    var largos = muestra.filter(function (v) { return /^[A-Za-z0-9_\-]{16,}$/.test(v) && /[A-Za-z]/.test(v) && /\d/.test(v); }).length;
    var aviso = $('o-aviso-id');
    aviso.hidden = !(muestra.length && largos / muestra.length > 0.5);
    aviso.textContent = 'Este identificador parece un código de acceso (como el del QR). Si es el que se escanea en la entrada, elige otra columna, por ejemplo el número de orden.';
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
    if (!est.filas.length) return mostrarError('Primero lee la lista de boletas (paso 1).');
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
      h('p', { class: 'grande' }, [h('b', { text: pub.participantes.length.toLocaleString('es-CO') }), ' boletas participan en «' + pub.titulo + '»']),
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
        h('b', { text: x.g.etiqueta + ' · boleta n.º ' + x.g.posicion }),
        h('p', { text: x.ok ? '✓ Coincide con el compromiso publicado.' : '✕ No coincide con el compromiso publicado.' }),
        x.p ? h('p', { text: 'Identificador: ' + x.p.idOriginal + (x.p.nombre ? ' · ' + x.p.nombre : '') }) : null,
        filas.length ? h('table', { class: 'datos-fila' }, [h('tbody', null, filas)]) : null
      ]));
    });
    if (todosOk) {
      caja.appendChild(h('p', { class: 'ayuda', text: 'Opcional: publica la revelación para que cualquiera compruebe que el ganador corresponde a esa boleta. Hazlo solo si el identificador es el código de la boleta o de la orden, nunca una cédula, un teléfono o un correo.' }));
      caja.appendChild(h('button', { type: 'button', class: 'btn', text: 'Descargar archivo público con la revelación', onclick: function () {
        var conRev = JSON.parse(JSON.stringify(pub));
        conRev.revelaciones = xs.map(function (x) { return { posicion: x.g.posicion, id: x.p.id, sal: x.p.sal }; });
        V.descargar(pub.id + '.json', jsonPublico(conRev), 'application/json');
      } }));
    }
  }
})();
