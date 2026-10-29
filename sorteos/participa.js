/* Labs Summit 2026 · registro para los sorteos (/participa)
   /participa          → formulario (nombre, celular y autorización)
   /participa?pantalla → QR grande para proyectar, con el número de registrados
   Habla con /api/participa (functions/api/[[ruta]].js). Todo el texto va con textContent. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var CLAVE = 'lsParticipa';
  var vistas = ['p-form', 'p-listo', 'p-cerrado', 'p-pronto'];

  function miles(n) { return Number(n).toLocaleString('es-CO'); }
  function leerGuardado() {
    try { var x = JSON.parse(localStorage.getItem(CLAVE) || 'null'); return x && typeof x.etiqueta === 'string' ? x : null; } catch (e) { return null; }
  }
  function guardar(x) { try { localStorage.setItem(CLAVE, JSON.stringify(x)); } catch (e) { /* sin almacenamiento: no se recuerda */ } }
  function olvidar() { try { localStorage.removeItem(CLAVE); } catch (e) { /* nada */ } }

  function pedir(metodo, cuerpo) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var t = ctl ? setTimeout(function () { ctl.abort(); }, 15000) : null;
    return fetch('/api/participa', {
      method: metodo,
      headers: cuerpo ? { 'Content-Type': 'application/json' } : {},
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      credentials: 'same-origin',
      signal: ctl ? ctl.signal : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, d: d || {} }; });
    }).finally(function () { if (t) clearTimeout(t); });
  }

  /* ---------------- pantalla grande con el QR ---------------- */
  if (new URLSearchParams(location.search).has('pantalla')) {
    document.body.classList.add('modo-registro');
    $('p-pantalla').hidden = false;
    var cuantos = function () {
      pedir('GET').then(function (r) {
        if (r.status !== 200 || typeof r.d.total !== 'number') return;
        $('pp-total').textContent = miles(r.d.total);
        $('pp-total-txt').textContent = r.d.total === 1 ? 'persona ya participa' : 'personas ya participan';
        $('pp-cuenta').hidden = r.d.total < 1;
      }, function () { /* sin señal: se queda el último número */ });
    };
    cuantos();
    setInterval(cuantos, 20000);
    return;
  }

  /* ---------------- formulario ---------------- */
  function mostrar(id) { vistas.forEach(function (v) { $(v).hidden = v !== id; }); }
  function contador(total) {
    if (typeof total !== 'number' || total < 1) return;
    $('p-contador-txt').textContent = total === 1 ? '1 persona ya participa' : miles(total) + ' personas ya participan';
    $('p-contador').hidden = false;
  }
  function listo(etiqueta, nota) {
    $('p-etiqueta').textContent = etiqueta;
    $('p-listo-ya').textContent = nota || '';
    $('p-listo-ya').hidden = !nota;
    mostrar('p-listo');
    $('p-listo').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  var campos = { nombre: $('p-nombre'), celular: $('p-celular'), autoriza: $('p-autoriza') };
  function errorCampo(nombre, msg) {
    var e = $('p-' + nombre + '-error');
    e.textContent = msg || '';
    e.hidden = !msg;
    if (msg) campos[nombre].setAttribute('aria-invalid', 'true'); else campos[nombre].removeAttribute('aria-invalid');
  }
  function errorGeneral(msg) { $('p-error').textContent = msg || ''; $('p-error').hidden = !msg; }
  Object.keys(campos).forEach(function (k) {
    campos[k].addEventListener(k === 'autoriza' ? 'change' : 'input', function () { if (campos[k].hasAttribute('aria-invalid')) errorCampo(k, ''); });
  });

  // Las mismas reglas que el servidor (que es quien decide)
  function celularValido(v) {
    var t = String(v).replace(/[\s.\-_\/()]/g, '');
    var m = /^\+?57(3\d{9})$/.exec(t);
    if (m) t = m[1];
    return /^(3\d{9}|\+\d{10,15})$/.test(t);
  }
  function revisar() {
    var nombre = campos.nombre.value.replace(/\s+/g, ' ').trim(), errores = {};
    if (nombre.length < 3 || !/\p{L}.*\p{L}/u.test(nombre)) errores.nombre = 'Escribe tu nombre completo.';
    if (!celularValido(campos.celular.value)) errores.celular = 'Escribe tu celular de 10 dígitos (empieza por 3).';
    if (!campos.autoriza.checked) errores.autoriza = 'Para participar debes autorizar el uso de tus datos en el sorteo.';
    return errores;
  }
  function pintarErrores(errores) {
    var primero = null;
    Object.keys(campos).forEach(function (k) {
      errorCampo(k, errores[k]);
      if (errores[k] && !primero) primero = campos[k];
    });
    if (primero) primero.focus();
    return !!primero;
  }

  var boton = $('p-enviar'), textoBoton = boton.querySelector('.p-boton-txt'), enviando = false;
  function ocupado(si) {
    enviando = si;
    boton.disabled = si;
    boton.classList.toggle('cargando', si);
    textoBoton.textContent = si ? 'Registrando…' : 'Quiero participar';
  }

  $('p-formulario').addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (enviando) return;
    errorGeneral('');
    if (pintarErrores(revisar())) return;
    ocupado(true);
    pedir('POST', { nombre: campos.nombre.value, celular: campos.celular.value, autoriza: campos.autoriza.checked, sitio: $('p-sitio').value })
      .then(function (r) {
        if ((r.status === 200 || r.status === 201) && r.d.ok) {
          guardar({ etiqueta: r.d.etiqueta, cuando: new Date().toISOString() });
          contador(r.d.total);
          listo(r.d.etiqueta, r.status === 200 ? 'Este celular ya estaba registrado.' : '');
          return;
        }
        if (r.status === 400 && r.d.errores) { pintarErrores(r.d.errores); errorGeneral(r.d.error); return; }
        if (r.status === 409 && r.d.cerrado) { mostrar('p-cerrado'); return; }
        if (r.status === 503) { mostrar('p-pronto'); return; }
        errorGeneral(r.d.error || 'No pudimos registrarte. Inténtalo de nuevo en un momento.');
      }, function () {
        errorGeneral('No pudimos conectarnos. Revisa tu señal o tus datos móviles e inténtalo de nuevo: tus datos siguen escritos.');
      })
      .finally(function () { ocupado(false); });
  });

  $('p-otra').addEventListener('click', function () {
    olvidar();
    $('p-formulario').reset();
    Object.keys(campos).forEach(function (k) { errorCampo(k, ''); });
    errorGeneral('');
    mostrar('p-form');
    campos.nombre.focus();
  });

  function revisarEstado() {
    return pedir('GET').then(function (r) {
      if (r.status === 503) { if (!leerGuardado()) mostrar('p-pronto'); return; }
      if (r.status !== 200) return;
      contador(r.d.total);
      if (r.d.abierto === false && !leerGuardado()) mostrar('p-cerrado');
      else if (!$('p-pronto').hidden) mostrar('p-form');
    }, function () { /* sin señal: el formulario sigue disponible */ });
  }
  $('p-reintentar').addEventListener('click', function () {
    var b = $('p-reintentar');
    b.disabled = true;
    revisarEstado().finally(function () { b.disabled = false; });
  });

  var antes = leerGuardado();
  if (antes) listo(antes.etiqueta, 'Ya te registraste desde este celular.');
  revisarEstado();
})();
