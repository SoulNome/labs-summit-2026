/* Labs Summit 2026 · el mapa funciona aunque se caiga la señal en el Coliseo.
   La primera visita guarda el mapa en el celular. Después:
   - archivos del mapa: se sirven desde el celular (rápido y sin datos)
   - evento.js (agenda): primero internet, y si no hay, la última versión guardada
   Al cambiar archivos del mapa, subir VERSION para que todos reciban lo nuevo. */
var VERSION = 'mapa-v4';
var BASE = [
  '/mapa/',
  '/mapa/mapa.css?v=4',
  '/mapa/vendor/three.min.js?v=147',
  '/mapa/vendor/OrbitControls.min.js?v=147',
  '/mapa/evento.js?v=4',
  '/mapa/escena.js?v=4',
  '/mapa/interiores.js?v=4',
  '/mapa/app.js?v=4'
];
var FOTOS = ['auditorio', 'expositores', 'marcas', 'podcast', 'workshops', 'foto', 'cafe', 'taquillas'].map(function (n) { return '/mapa/img/' + n + '.jpg'; });

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION).then(function (c) {
      return c.addAll(BASE).then(function () {
        // las fotos no deben frenar la instalación si alguna falla
        return Promise.all(FOTOS.map(function (u) { return c.add(u).catch(function () {}); }));
      });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k.indexOf('mapa-') === 0 && k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function conTiempo(promesa, ms) {
  return new Promise(function (ok, mal) {
    var t = setTimeout(function () { mal(new Error('tiempo')); }, ms);
    promesa.then(function (r) { clearTimeout(t); ok(r); }, function (err) { clearTimeout(t); mal(err); });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.indexOf('/mapa/') !== 0) return;

  // Página del mapa (con ?p=, ?z=, etc.): internet primero; sin señal, la guardada.
  if (req.mode === 'navigate') {
    e.respondWith(
      conTiempo(fetch(req), 4000).then(function (r) {
        var copia = r.clone();
        if (r.ok) caches.open(VERSION).then(function (c) { c.put('/mapa/', copia); });
        return r;
      }).catch(function () {
        return caches.match('/mapa/', { ignoreSearch: true });
      })
    );
    return;
  }

  // Agenda y datos: internet primero (para tener los cambios), si no, lo guardado.
  if (url.pathname === '/mapa/evento.js') {
    e.respondWith(
      conTiempo(fetch(req), 4000).then(function (r) {
        var copia = r.clone();
        if (r.ok) caches.open(VERSION).then(function (c) { c.put('/mapa/evento.js?v=4', copia); });
        return r;
      }).catch(function () {
        return caches.match('/mapa/evento.js?v=4').then(function (r) { return r || caches.match(req, { ignoreSearch: true }); });
      })
    );
    return;
  }

  // Todo lo demás del mapa: desde el celular si ya está guardado.
  e.respondWith(
    caches.match(req).then(function (r) {
      return r || fetch(req).then(function (resp) {
        if (resp.ok) { var copia = resp.clone(); caches.open(VERSION).then(function (c) { c.put(req, copia); }); }
        return resp;
      });
    })
  );
});
