/* ==========================================================================
   Labs Summit 2026 · Recorridos 3D de cada zona (día 29)
   --------------------------------------------------------------------------
   Cada función arma la escena detallada de un espacio a partir de los renders
   oficiales. Unidades ≈ metros, origen en el centro del espacio.
   Todo se dibuja con geometría simple fusionada e instancias para que corra
   en celulares sencillos. Al salir, la escena se libera de memoria.
   ========================================================================== */
(function () {
  'use strict';
  var T, M, TEX, LIGERO, BRILLO, VIVO, ANIM = [];
  function anima(fn) { ANIM.push(fn); }

  /* ---------------- geometría ---------------- */
  function B(x0, x1, y0, y1, z0, z1) {
    var g = new T.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return g;
  }
  function BR(w, h, d, x, y, z, ry) {
    var g = new T.BoxGeometry(w, h, d);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    return g;
  }
  function CIL(rt, rb, h, seg, x, y, z) {
    var g = new T.CylinderGeometry(rt, rb, h, seg || 12);
    g.translate(x, y, z);
    return g;
  }
  function BOLA(r, x, y, z, sx, sy, sz, det) {
    var g = new T.IcosahedronGeometry(r, det === undefined ? (LIGERO ? 0 : 1) : det);
    g.scale(sx || 1, sy || 1, sz || 1);
    g.translate(x, y, z);
    return g;
  }
  var _o;
  function BARRA(a, b, t) {
    var dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    var L = Math.sqrt(dx * dx + dy * dy + dz * dz);
    var g = new T.BoxGeometry(t, t, L);
    _o.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    _o.lookAt(b[0], b[1], b[2]);
    _o.updateMatrix();
    g.applyMatrix4(_o.matrix);
    return g;
  }
  function fusionar(lista) {
    var partes = [], n = 0, i;
    for (i = 0; i < lista.length; i++) {
      var g = lista[i].index ? lista[i].toNonIndexed() : lista[i];
      partes.push(g);
      n += g.attributes.position.count;
    }
    var pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), o = 0;
    for (i = 0; i < partes.length; i++) {
      pos.set(partes[i].attributes.position.array, o * 3);
      nor.set(partes[i].attributes.normal.array, o * 3);
      o += partes[i].attributes.position.count;
    }
    var m = new T.BufferGeometry();
    m.setAttribute('position', new T.BufferAttribute(pos, 3));
    m.setAttribute('normal', new T.BufferAttribute(nor, 3));
    m.computeBoundingSphere();
    return m;
  }

  // Kit: junta muchas piezas por material y las dibuja en una sola llamada.
  function Kit() { this.b = {}; }
  Kit.prototype.g = function (mat, geo) { (this.b[mat] || (this.b[mat] = [])).push(geo); return this; };
  Kit.prototype.box = function (mat, x0, x1, y0, y1, z0, z1) { return this.g(mat, B(x0, x1, y0, y1, z0, z1)); };
  Kit.prototype.armar = function (escena) {
    for (var k in this.b) {
      if (!this.b.hasOwnProperty(k)) continue;
      if (!M[k]) throw new Error('Material desconocido: ' + k);
      var m = new T.Mesh(fusionar(this.b[k]), M[k]);
      if (M[k].transparent) m.renderOrder = 2;
      escena.add(m);
    }
  };

  /* ---------------- materiales y texturas ---------------- */
  function lam(c, o) { var p = { color: c }; if (o) for (var k in o) p[k] = o[k]; return new T.MeshLambertMaterial(p); }
  function bas(c, o) { var p = { color: c }; if (o) for (var k in o) p[k] = o[k]; return new T.MeshBasicMaterial(p); }
  function materiales() {
    var transp = { transparent: true, depthWrite: false, side: T.DoubleSide };
    M = {
      piso: lam(0x17131F), pisoClaro: lam(0x2B2737), pisoOscuro: lam(0x0F0C15), concreto: lam(0x3A3541),
      negro: lam(0x0D0B12), blanco: lam(0xE7E2F0), gris: lam(0x3B3548), acero: lam(0x6A6378), cortina: lam(0x0C0910),
      madera: lam(0x6E4B33), maderaClara: lam(0xA9805A), maderaOscura: lam(0x2E2433), mimbre: lam(0xB98A55),
      amarillo: lam(0xC9A53E), hoja: lam(0x2E7A4C, { flatShading: true }), hojaOscura: lam(0x1C5636, { flatShading: true }),
      cesped: lam(0x2F7D45), tronco: lam(0x5A4636), troncoClaro: lam(0x8E8170), maceta: lam(0x2A2230), tela: lam(0xE9E1D2),
      azulSofa: lam(0x1F2E5C), rojo: lam(0xC2283F), rosa: lam(0xD84FA0), lila: lam(0x9B6AE0), adoquin: lam(0x6B4A44),
      vidrio: lam(0xC9B6FF, { transparent: true, opacity: 0.12, depthWrite: false, side: T.DoubleSide }),
      lona: lam(0xF4EFFC, { transparent: true, opacity: 0.22, depthWrite: false, side: T.DoubleSide }),
      techoT: lam(0x3A3346, { transparent: true, opacity: 0.55, depthWrite: false, side: T.DoubleSide }),
      techoCafe: lam(0xD9D2C6, { transparent: true, opacity: 0.22, depthWrite: false, side: T.DoubleSide }),
      telaV: lam(0x8B3FE0, { transparent: true, opacity: 0.6, depthWrite: false, side: T.DoubleSide }),
      telaN: lam(0x15101C, { transparent: true, opacity: 0.6, depthWrite: false, side: T.DoubleSide }),
      telaB: lam(0xEADFC8, { transparent: true, opacity: 0.45, depthWrite: false, side: T.DoubleSide }),
      neonV: bas(0xA855F7), neonR: bas(0xE879F9), neonC: bas(0x22D3EE), calido: bas(0xFFC46B), verdeLed: bas(0x22C55E),
      luz: bas(0xF5F0FF), pantallaOff: bas(0x1A1030)
    };
    M.__transp = transp;
  }

  var texturas = [];
  function lienzo(w, h, dibujar) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d');
    dibujar(x, w, h);
    var t = new T.CanvasTexture(c);
    t.anisotropy = 4;
    texturas.push(t);
    return t;
  }
  function texBrillo() {
    return lienzo(128, 128, function (x) {
      var g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    });
  }
  function texHaz() {  // brillo vertical para las luces sobre las cortinas
    return lienzo(64, 256, function (x) {
      var g = x.createLinearGradient(0, 256, 0, 0);
      g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.5, 'rgba(255,255,255,.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 256);
      var h = x.createLinearGradient(0, 0, 64, 0);
      h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)');
      x.globalCompositeOperation = 'destination-out'; x.fillStyle = h; x.fillRect(0, 0, 64, 256);
    });
  }
  function texPantalla(t1, t2) {
    return lienzo(512, 256, function (x, w, h) {
      var g = x.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#16042C'); g.addColorStop(1, '#4A1188');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.strokeStyle = 'rgba(232,121,249,.6)'; x.lineWidth = 4;
      x.beginPath(); x.moveTo(60, 14); x.lineTo(112, 108); x.lineTo(84, 116); x.lineTo(140, 240); x.stroke();
      x.beginPath(); x.moveTo(452, 24); x.lineTo(408, 120); x.lineTo(436, 128); x.lineTo(386, 236); x.stroke();
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.shadowColor = '#E879F9'; x.shadowBlur = 18;
      x.fillStyle = '#F4EDFF'; x.font = 'bold 92px Arial, Helvetica, sans-serif'; x.fillText(t1 || 'LABS', w / 2, 112);
      x.shadowBlur = 0; x.fillStyle = '#D8C6FF'; x.font = '600 34px Arial, Helvetica, sans-serif'; x.fillText(t2 || 'SUMMIT 2026', w / 2, 182);
    });
  }
  // Letrero: lineas = [{t, f, c, y, g}]  (y en fracción de alto, g = color de brillo)
  function texTexto(lineas, o) {
    o = o || {};
    var W = o.w || 1024, H = o.h || 256;
    return lienzo(W, H, function (x) {
      if (o.fondo) { x.fillStyle = o.fondo; x.fillRect(0, 0, W, H); }
      if (o.marco) { x.strokeStyle = o.marco; x.lineWidth = o.grosor || 10; x.strokeRect(8, 8, W - 16, H - 16); }
      x.textAlign = 'center'; x.textBaseline = 'middle';
      for (var i = 0; i < lineas.length; i++) {
        var l = lineas[i];
        x.font = l.f; x.fillStyle = l.c || '#fff';
        if (l.g) { x.shadowColor = l.g; x.shadowBlur = l.b || 26; } else x.shadowBlur = 0;
        x.fillText(l.t, W / 2, l.y * H);
        if (l.g) x.fillText(l.t, W / 2, l.y * H);
      }
    });
  }
  function texRejilla(color, fondo, paso) {
    var t = lienzo(256, 256, function (x) {
      x.fillStyle = fondo; x.fillRect(0, 0, 256, 256);
      x.strokeStyle = color; x.lineWidth = 2;
      for (var i = 0; i <= 256; i += paso) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(256, i); x.stroke(); }
    });
    t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  }
  function texCortina() {
    var t = lienzo(256, 64, function (x) {
      for (var i = 0; i < 256; i += 16) {
        var g = x.createLinearGradient(i, 0, i + 16, 0);
        g.addColorStop(0, '#07050B'); g.addColorStop(0.5, '#1B1524'); g.addColorStop(1, '#07050B');
        x.fillStyle = g; x.fillRect(i, 0, 16, 64);
      }
    });
    t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  }

  /* ---------------- piezas reutilizables ---------------- */
  function cartel(escena, tex, w, h, x, y, z, ry, o) {
    o = o || {};
    var mat = new T.MeshBasicMaterial({ map: tex, transparent: !!o.transp, alphaTest: o.alphaTest || 0, side: o.doble ? T.DoubleSide : T.FrontSide, color: o.color || 0xffffff, depthWrite: !o.aditivo });
    if (o.aditivo) mat.blending = T.AdditiveBlending;
    var m = new T.Mesh(new T.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z);
    m.rotation.y = ry || 0;
    if (o.rx) m.rotation.x = o.rx;
    if (o.transp || o.aditivo) m.renderOrder = 3;
    escena.add(m);
    return m;
  }
  function charco(escena, x, z, rx, rz, color, op) {
    var m = new T.Mesh(new T.PlaneGeometry(rx * 2, rz * 2), new T.MeshBasicMaterial({ map: BRILLO, color: color, transparent: true, opacity: op || 0.35, blending: T.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.03, z);
    m.renderOrder = 1;
    escena.add(m);
  }
  function cono(escena, x, y, z, alto, radio, color, op, haciaArriba) {
    // la punta queda en (x, y, z); el cono se abre hacia abajo, o hacia arriba si haciaArriba
    var g = new T.ConeGeometry(radio, alto, 20, 1, true);
    g.translate(0, -alto / 2, 0);
    var m = new T.Mesh(g, new T.MeshBasicMaterial({ color: color, transparent: true, opacity: op || 0.07, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    m.position.set(x, y, z);
    if (haciaArriba) m.rotation.x = Math.PI;
    m.renderOrder = 4;
    escena.add(m);
    return m;
  }
  // luces de escenario que barren suavemente
  function barrer(conos, amplitud, velocidad) {
    anima(function (t) {
      for (var i = 0; i < conos.length; i++) {
        var c = conos[i], base = c.userData.baseX || 0;
        c.rotation.z = Math.sin(t * velocidad + i * 1.7) * amplitud;
        c.rotation.x = base + Math.cos(t * velocidad * 0.8 + i * 2.3) * amplitud * 0.8;
      }
    });
  }
  // pantallas que alternan su contenido
  function alternar(pantallas, texs, cada) {
    if (texs.length < 2) return;
    var actual = -1;
    anima(function (t) {
      var i = Math.floor(t / cada) % texs.length;
      if (i === actual) return;
      actual = i;
      for (var k = 0; k < pantallas.length; k++) pantallas[k].material.map = texs[i];
    });
  }
  // neón que respira entre dos colores
  function respirar(mat, c1, c2, vel) {
    var a = new T.Color(c1), b = new T.Color(c2);
    anima(function (t) { mat.color.copy(a).lerp(b, 0.5 + 0.5 * Math.sin(t * vel)); });
  }
  // luces puntuales que titilan
  function titilar(puntos, vel, rango) {
    var base = puntos.material.size;
    anima(function (t) { puntos.material.size = base * (1 - rango / 2 + rango / 2 * Math.sin(t * vel)); });
  }
  function inst(escena, geo, mat, items, colores) {
    if (!items.length) return null;
    var m = new T.InstancedMesh(geo, mat, items.length), i;
    for (i = 0; i < items.length; i++) {
      var it = items[i];
      _o.position.set(it[0], it[1], it[2]);
      _o.rotation.set(0, it[3] || 0, 0);
      var s = it[4] || 1;
      _o.scale.set(s, it[5] || s, it[6] || s);
      _o.updateMatrix();
      m.setMatrixAt(i, _o.matrix);
      if (colores) m.setColorAt(i, colores[i % colores.length]);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    escena.add(m);
    return m;
  }
  function luces(escena, puntos, color, tam) {
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(puntos, 3));
    var p = new T.Points(g, new T.PointsMaterial({ color: color || 0xFFCF8A, size: tam || 0.22, map: BRILLO, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    p.renderOrder = 5;
    escena.add(p);
    return p;
  }
  function guirnalda(arr, a, b, caida, n) {
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      arr.push(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(Math.PI * t) * caida, a[2] + (b[2] - a[2]) * t);
    }
  }
  function lineas(escena, arr, color, op) {
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(arr, 3));
    escena.add(new T.LineSegments(g, new T.LineBasicMaterial({ color: color, transparent: true, opacity: op === undefined ? 0.7 : op })));
  }

  // silla plástica blanca (mira hacia -z)
  function geoSilla(simple) {
    var p = [B(-0.23, 0.23, 0.43, 0.48, -0.22, 0.22), B(-0.23, 0.23, 0.48, 0.92, 0.17, 0.22)];
    if (!simple) {
      p.push(B(-0.21, -0.17, 0, 0.43, -0.2, -0.16), B(0.17, 0.21, 0, 0.43, -0.2, -0.16), B(-0.21, -0.17, 0, 0.43, 0.16, 0.2), B(0.17, 0.21, 0, 0.43, 0.16, 0.2));
    }
    return fusionar(p);
  }
  function geoSillon() {
    return fusionar([B(-0.45, 0.45, 0.15, 0.45, -0.4, 0.4), B(-0.45, 0.45, 0.45, 1.0, 0.25, 0.42), B(-0.48, -0.36, 0.15, 0.7, -0.38, 0.4), B(0.36, 0.48, 0.15, 0.7, -0.38, 0.4),
      B(-0.4, -0.36, 0, 0.15, -0.35, -0.31), B(0.36, 0.4, 0, 0.15, -0.35, -0.31), B(-0.4, -0.36, 0, 0.15, 0.31, 0.35), B(0.36, 0.4, 0, 0.15, 0.31, 0.35)]);
  }
  function geoTaburete() { return fusionar([CIL(0.2, 0.2, 0.06, 12, 0, 0.76, 0), CIL(0.03, 0.03, 0.74, 6, 0, 0.37, 0), CIL(0.18, 0.18, 0.02, 12, 0, 0.01, 0)]); }
  function geoMesaAlta() { return fusionar([CIL(0.38, 0.38, 0.04, 16, 0, 1.06, 0), CIL(0.04, 0.04, 1.04, 6, 0, 0.52, 0), CIL(0.25, 0.25, 0.03, 12, 0, 0.015, 0)]); }
  function geoMesaRedonda(r) { return fusionar([CIL(r, r, 0.05, 18, 0, 0.74, 0), CIL(0.05, 0.05, 0.72, 6, 0, 0.36, 0), CIL(0.25, 0.25, 0.03, 12, 0, 0.015, 0)]); }

  // personas: piernas, torso con brazos y cabeza; sentado = más bajo
  var ROPA, PIEL, PANTALON;
  var CABEZA_Y = 1.6;
  function gente(escena, lista) {
    if (!lista.length) return;
    var piernas = fusionar([CIL(0.085, 0.07, 0.82, 6, -0.09, 0.41, 0), CIL(0.085, 0.07, 0.82, 6, 0.09, 0.41, 0)]);
    var torso = fusionar([CIL(0.21, 0.17, 0.6, 8, 0, 1.1, 0), CIL(0.225, 0.21, 0.1, 8, 0, 1.43, 0),
      CIL(0.055, 0.048, 0.56, 5, -0.255, 1.12, 0), CIL(0.055, 0.048, 0.56, 5, 0.255, 1.12, 0)]);
    var cabeza = new T.SphereGeometry(0.115, 10, 8); cabeza.translate(0, CABEZA_Y, 0);
    var a = [];
    for (var i = 0; i < lista.length; i++) {
      var p = lista[i], s = p[3] ? 0.82 : 1, y = p[3] ? 0.12 : 0;
      a.push([p[0], y, p[1], p[2] || 0, 1, s, 1]);
    }
    inst(escena, piernas, lam(0xffffff), a, PANTALON);
    inst(escena, torso, lam(0xffffff), a, ROPA);
    inst(escena, cabeza, lam(0xffffff), a, PIEL);
  }
  function genteAleatoria(lista, n, x0, x1, z0, z1, semilla, sentado) {
    var s = semilla || 7;
    function r() { s = (s * 9301 + 49297) % 233280; return s / 233280; }
    for (var i = 0; i < n; i++) lista.push([x0 + (x1 - x0) * r(), z0 + (z1 - z0) * r(), r() * Math.PI * 2, sentado]);
    return lista;
  }
  function planta(k, x, z, alto, ancho, maceta) {
    if (maceta !== false) k.g(maceta || 'maceta', CIL(ancho * 0.45, ancho * 0.35, 0.55, 10, x, 0.275, z));
    k.g('hoja', BOLA(ancho * 0.7, x, alto * 0.65, z, 1, 1.25, 1));
    k.g('hojaOscura', BOLA(ancho * 0.55, x + ancho * 0.25, alto * 0.45, z - ancho * 0.15, 1, 1.1, 1));
  }
  function arbol(k, x, z, alto, copa, transp) {
    k.g('tronco', CIL(0.22 + copa * 0.04, 0.35 + copa * 0.05, alto * 0.6, 7, x, alto * 0.3, z));
    k.g(transp ? 'copaT' : 'hoja', BOLA(copa, x, alto * 0.75, z, 1, 0.8, 1));
    k.g(transp ? 'copaT' : 'hojaOscura', BOLA(copa * 0.7, x + copa * 0.4, alto * 0.62, z + copa * 0.2, 1, 0.8, 1));
  }
  function saman(k, x, z, escala) {
    var e = escala || 1;
    k.g('tronco', CIL(0.7 * e, 1.0 * e, 6 * e, 9, x, 3 * e, z));
    for (var i = 0; i < 5; i++) {
      var a = i * Math.PI * 2 / 5 + 0.4;
      k.g('tronco', BARRA([x, 5.4 * e, z], [x + Math.cos(a) * 5 * e, 9 * e, z + Math.sin(a) * 5 * e], 0.45 * e));
    }
    k.g('copaT', BOLA(11 * e, x, 10.6 * e, z, 1, 0.24, 1));
    k.g('copaT', BOLA(7 * e, x + 5 * e, 10 * e, z + 3 * e, 1, 0.28, 1));
    k.g('copaT', BOLA(7 * e, x - 5 * e, 10.2 * e, z - 3 * e, 1, 0.28, 1));
  }
  function suelo(escena, color, tam) {
    var t = texRejilla('rgba(201,174,255,0.07)', color, 32);
    t.repeat.set((tam || 300) / 8, (tam || 300) / 8);
    var m = new T.Mesh(new T.PlaneGeometry(tam || 300, tam || 300), new T.MeshBasicMaterial({ map: t }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = -0.02;
    escena.add(m);
  }
  function escenaBase(cerca, lejos) {
    var e = new T.Scene();
    e.background = new T.Color(0x07020F);
    e.fog = new T.Fog(0x07020F, cerca || 40, lejos || 140);
    e.add(new T.HemisphereLight(0xDCD2FF, 0x1A0F2E, 0.95));
    var d = new T.DirectionalLight(0xffffff, 0.55);
    d.position.set(25, 45, 30);
    e.add(d);
    return e;
  }
  function cortina(escena, w, h, x, y, z, ry) {
    var t = TEX.cortina.clone(); t.needsUpdate = true; t.repeat.set(w / 2.4, 1); texturas.push(t);
    var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshLambertMaterial({ map: t, side: T.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = ry || 0;
    escena.add(m);
  }
  function haz(escena, x, y, z, ry, color, alto) {
    cartel(escena, TEX.haz, 1.8, alto || 5, x, y + (alto || 5) / 2, z, ry, { aditivo: true, transp: true, color: color });
  }
  function hexa(c) { return new T.Color(c); }

  /* ======================================================================
     AUDITORIO PRINCIPAL (Pabellón 1)
     ====================================================================== */
  function auditorio() {
    var e = escenaBase(55, 150), k = new Kit(), i, x, z;
    suelo(e, '#0A0612');
    k.box('piso', -27, 27, 0, 0.12, -19, 19);
    // gradería al occidente
    for (i = 0; i < 7; i++) k.box('gris', -27 - (i + 1) * 1.15, -27, 0, 0.55 * (i + 1), -16, 16);
    k.box('acero', -35.1, -35, 3.85, 4.9, -16, 16);
    for (z = -16; z <= 16; z += 4) k.box('acero', -35.1, -35, 3.85, 4.9, z - 0.04, z + 0.04);
    k.box('acero', -27.05, -26.95, 0.55, 1.5, -16, 16);
    // estructura y techo
    var cols = [-27, -18, -9, 0, 9, 18, 27], tr = [];
    for (i = 0; i < cols.length; i++) {
      x = cols[i];
      k.box('acero', x - 0.22, x + 0.22, 0, 11, -19.6, -19.2);
      k.box('acero', x - 0.22, x + 0.22, 0, 11, 19.2, 19.6);
      tr.push(x, 11, -19.4, x, 15, 0, x, 15, 0, x, 11, 19.4, x, 11, -19.4, x, 11, 19.4);
      for (var s = -19.4; s < 19.4; s += 4.85) {
        var y1 = 11 + 4 * (1 - Math.abs(s) / 19.4), s2 = s + 4.85, y2 = 11 + 4 * (1 - Math.abs(s2) / 19.4);
        tr.push(x, 11, s, x, y2, s2, x, 11, s2, x, y2, s2);
      }
    }
    for (z = -19.4; z <= 19.5; z += 4.85) { var yz = 11 + 4 * (1 - Math.abs(z) / 19.4); tr.push(-27, yz, z, 27, yz, z); }
    lineas(e, tr, 0x8C7FB0, 0.55);
    var techo = new T.BufferGeometry();
    techo.setAttribute('position', new T.Float32BufferAttribute([-27, 11, -19.4, 27, 11, -19.4, 27, 15, 0, -27, 11, -19.4, 27, 15, 0, -27, 15, 0,
      -27, 15, 0, 27, 15, 0, 27, 11, 19.4, -27, 15, 0, 27, 11, 19.4, -27, 11, 19.4], 3));
    techo.computeVertexNormals();
    var mt = new T.Mesh(techo, lam(0x2A2238, { transparent: true, opacity: 0.18, depthWrite: false, side: T.DoubleSide }));
    mt.renderOrder = 2; e.add(mt);
    // cortinas negras con luces violeta
    cortina(e, 54, 7, 0, 3.5, -19, 0);
    cortina(e, 38, 7, 27, 3.5, 0, -Math.PI / 2);
    for (x = -24; x <= 24; x += 6) { haz(e, x, 0.1, -18.9, 0, 0x9D4DFF, 6); k.box('negro', x - 0.25, x + 0.25, 0, 0.25, -18.8, -18.4); k.box('neonV', x - 0.18, x + 0.18, 0.25, 0.3, -18.75, -18.45); }
    for (z = -15; z <= 15; z += 6) { haz(e, 26.9, 0.1, z, -Math.PI / 2, 0x9D4DFF, 6); }
    // escenario central
    var cz = -2;
    k.box('negro', -5, 5, 0, 1.4, cz - 5, cz + 5);
    k.box('neonV', -5.05, 5.05, 1.36, 1.44, cz + 4.98, cz + 5.06);
    k.box('neonV', -5.05, 5.05, 1.36, 1.44, cz - 5.06, cz - 4.98);
    k.box('neonV', 4.98, 5.06, 1.36, 1.44, cz - 5.05, cz + 5.05);
    k.box('neonV', -5.06, -4.98, 1.36, 1.44, cz - 5.05, cz + 5.05);
    k.box('negro', -1.6, 1.6, 0, 0.7, cz + 5, cz + 6);
    // torres de truss y marco superior
    var esq = [[-5, cz - 5], [5, cz - 5], [5, cz + 5], [-5, cz + 5]];
    for (i = 0; i < 4; i++) {
      var ex = esq[i][0], ez = esq[i][1];
      k.box('acero', ex - 0.3, ex + 0.3, 1.4, 12, ez - 0.3, ez + 0.3);
    }
    k.box('acero', -5.3, 5.3, 11.6, 12.2, cz - 5.3, cz - 4.7); k.box('acero', -5.3, 5.3, 11.6, 12.2, cz + 4.7, cz + 5.3);
    k.box('acero', -5.3, -4.7, 11.6, 12.2, cz - 5.3, cz + 5.3); k.box('acero', 4.7, 5.3, 11.6, 12.2, cz - 5.3, cz + 5.3);
    for (x = -4.4; x <= 4.4; x += 1.1) { k.box('negro', x - 0.18, x + 0.18, 11.2, 11.6, cz - 5.18, cz - 4.82); k.box('negro', x - 0.18, x + 0.18, 11.2, 11.6, cz + 4.82, cz + 5.18); }
    // pantallas LED a los cuatro lados
    var pan = TEX.pantalla;
    var pantallas = [
      cartel(e, pan, 7.6, 4.2, 0, 8.8, cz + 5.35, 0),
      cartel(e, pan, 7.6, 4.2, 0, 8.8, cz - 5.35, Math.PI),
      cartel(e, pan, 7.6, 4.2, 5.35, 8.8, cz, Math.PI / 2),
      cartel(e, pan, 7.6, 4.2, -5.35, 8.8, cz, -Math.PI / 2)
    ];
    alternar(pantallas, VIVO ? [TEX.pantalla, TEX.vivo] : [TEX.pantalla, TEX.lema], VIVO ? 5 : 7);
    k.box('negro', -3.8, 3.8, 6.6, 11, cz + 5.0, cz + 5.3); k.box('negro', -3.8, 3.8, 6.6, 11, cz - 5.3, cz - 5.0);
    k.box('negro', 5.0, 5.3, 6.6, 11, cz - 3.8, cz + 3.8); k.box('negro', -5.3, -5.0, 6.6, 11, cz - 3.8, cz + 3.8);
    // luces sobre el escenario
    barrer([
      cono(e, -3, 11.2, cz - 3, 9.8, 2.6, 0xA855F7, 0.07),
      cono(e, 3, 11.2, cz + 3, 9.8, 2.6, 0xE879F9, 0.07),
      cono(e, 3, 11.2, cz - 3, 9.8, 2.2, 0x22D3EE, 0.05),
      cono(e, -3, 11.2, cz + 3, 9.8, 2.2, 0xA855F7, 0.06)
    ], 0.22, 0.55);
    respirar(M.neonV, 0xA855F7, 0xE879F9, 1.6);
    charco(e, 0, cz, 14, 14, 0x8B3FE0, 0.45);
    // parlantes
    k.box('negro', -6.6, -5.6, 0, 3.2, cz + 4.2, cz + 5.2); k.box('negro', 5.6, 6.6, 0, 3.2, cz + 4.2, cz + 5.2);
    // mesas largas con mantel blanco alrededor del escenario
    k.box('blanco', -11, 11, 0.12, 0.78, cz - 11.8, cz - 11);
    k.box('blanco', -12.2, -11.4, 0.12, 0.78, cz - 11, cz + 8.6);
    k.box('blanco', 11.4, 12.2, 0.12, 0.78, cz - 11, cz + 8.6);
    k.box('blanco', -11, -2.4, 0.12, 0.78, cz + 8.6, cz + 9.4);
    k.box('blanco', 2.4, 11, 0.12, 0.78, cz + 8.6, cz + 9.4);
    // estaciones de café
    k.box('negro', -9.8, -7, 0.12, 0.95, cz + 6.4, cz + 7.2); k.box('negro', 7, 9.8, 0.12, 0.95, cz + 6.4, cz + 7.2);
    for (i = 0; i < 3; i++) { k.g('acero', CIL(0.16, 0.16, 0.55, 10, -9.3 + i * 0.9, 1.22, cz + 6.8)); k.g('acero', CIL(0.16, 0.16, 0.55, 10, 7.5 + i * 0.9, 1.22, cz + 6.8)); }
    planta(k, -8.4, cz + 7.6, 1.2, 0.6, false); planta(k, 8.4, cz + 7.6, 1.2, 0.6, false);
    k.armar(e);

    // sillas
    var sillas = [], paso = 0.62;
    function bloque(x0, x1, z0, z1, px, pz, ry) { for (var a = x0; a <= x1 + 1e-6; a += px) for (var b = z0; b <= z1 + 1e-6; b += pz) sillas.push([a, 0.12, b, ry]); }
    bloque(-15, -2.6, cz + 12.2, cz + 18.2, paso, 0.95, 0);        // frente izquierda (miran al escenario)
    bloque(2.6, 15, cz + 12.2, cz + 18.2, paso, 0.95, 0);          // frente derecha
    bloque(-24.5, -14.6, cz - 12, cz + 8, 0.95, paso, -Math.PI / 2); // lado occidental
    bloque(14.6, 24.5, cz - 12, cz + 8, 0.95, paso, Math.PI / 2);    // lado oriental
    bloque(-10, 10, cz - 16, cz - 13.4, paso, 0.95, Math.PI);       // detrás del escenario
    // sillas de las mesas largas
    for (x = -10.5; x <= 10.5; x += 0.75) sillas.push([x, 0.12, cz - 12.4, Math.PI]);
    for (z = cz - 10.5; z <= cz + 8; z += 0.75) { sillas.push([-12.8, 0.12, z, -Math.PI / 2]); sillas.push([12.8, 0.12, z, Math.PI / 2]); }
    inst(e, geoSilla(LIGERO), M.blanco, sillas);

    var g = [];
    genteAleatoria(g, 34, -20, 20, cz + 9.6, cz + 11.6, 3);
    genteAleatoria(g, 12, -4, 4, cz + 12, cz + 18, 11);
    g.push([-8.4, cz + 5.9, 0], [8.4, cz + 5.9, 0], [0.3, cz + 1, 0.2]);
    gente(e, g);
    return { escena: e, pos: [-18, 22, 42], obj: [0, 2, -2], dist: [10, 85] };
  }

  /* ======================================================================
     ZONA EXPOSITORES (pabellón de vidrio en la plaza)
     ====================================================================== */
  function expositores() {
    var e = escenaBase(40, 110), k = new Kit(), i, x;
    suelo(e, '#0E0819');
    k.box('pisoOscuro', -30, 30, 0, 0.05, -22, 22);
    k.box('pisoClaro', -13, 13, 0, 0.15, -7, 7);
    // estructura negra
    var xs = [-13, -9.75, -6.5, -3.25, 0, 3.25, 6.5, 9.75, 13];
    for (i = 0; i < xs.length; i++) {
      x = xs[i];
      k.box('negro', x - 0.1, x + 0.1, 0.15, 5, -7.1, -6.9);
      k.box('negro', x - 0.1, x + 0.1, 0.15, 5, 6.9, 7.1);
      k.g('negro', BARRA([x, 5, -7], [x, 7.2, 0], 0.16));
      k.g('negro', BARRA([x, 7.2, 0], [x, 5, 7], 0.16));
    }
    k.box('negro', -13.1, 13.1, 4.9, 5.1, -7.1, -6.9); k.box('negro', -13.1, 13.1, 4.9, 5.1, 6.9, 7.1);
    k.box('negro', -13.1, 13.1, 7.1, 7.3, -0.1, 0.1);
    k.box('negro', -13.1, -12.9, 0.15, 5, -7, 7); k.box('negro', 12.9, 13.1, 0.15, 5, -7, 7);
    // vidrio
    k.box('vidrio', -13, 13, 0.15, 5, -7.02, -6.98); k.box('vidrio', 12.98, 13.02, 0.15, 5, -7, 7);
    k.box('vidrio', -13, -1.8, 0.15, 5, 6.98, 7.02); k.box('vidrio', 1.8, 13, 0.15, 5, 6.98, 7.02);
    var techo = new T.BufferGeometry();
    techo.setAttribute('position', new T.Float32BufferAttribute([-13, 5, -7, 13, 5, -7, 13, 7.2, 0, -13, 5, -7, 13, 7.2, 0, -13, 7.2, 0,
      -13, 7.2, 0, 13, 7.2, 0, 13, 5, 7, -13, 7.2, 0, 13, 5, 7, -13, 5, 7], 3));
    techo.computeVertexNormals();
    k.g('vidrio', techo);
    // stands blancos con pantalla
    var stands = [];
    for (x = -11.4; x <= 11.5; x += 3.3) stands.push([x, -1]);
    for (x = -11.4; x <= 11.5; x += 3.3) if (Math.abs(x) > 2) stands.push([x, 1]);
    for (i = 0; i < stands.length; i++) {
      var sx = stands[i][0], lado = stands[i][1], zf = lado * 6.8, zi = lado * 4.5;
      var z0 = Math.min(zf, zi), z1 = Math.max(zf, zi);
      k.box('blanco', sx - 1.6, sx + 1.6, 0.15, 2.8, lado < 0 ? z0 : z1 - 0.1, lado < 0 ? z0 + 0.1 : z1);
      k.box('blanco', sx - 1.6, sx - 1.5, 0.15, 2.8, z0, z1);
      k.box('blanco', sx + 1.5, sx + 1.6, 0.15, 2.8, z0, z1);
      k.box('blanco', sx - 1.6, sx + 1.6, 2.8, 3.25, lado < 0 ? z1 - 0.12 : z0, lado < 0 ? z1 : z0 + 0.12);
      k.box('neonV', sx - 1.5, sx + 1.5, 2.72, 2.8, lado < 0 ? z1 - 0.14 : z0 + 0.02, lado < 0 ? z1 - 0.02 : z0 + 0.14);
      k.box('blanco', sx - 0.6, sx + 0.6, 0.15, 1.05, (z0 + z1) / 2 - 0.3, (z0 + z1) / 2 + 0.3);
      k.box('negro', sx - 0.25, sx + 0.25, 1.05, 1.08, (z0 + z1) / 2 - 0.15, (z0 + z1) / 2 + 0.15);
      cartel(e, TEX.tv, 1.5, 0.85, sx, 1.75, lado < 0 ? z0 + 0.12 : z1 - 0.12, lado < 0 ? 0 : Math.PI);
      cartel(e, TEX.labs, 1.4, 0.32, sx, 3.02, lado < 0 ? z1 + 0.01 : z0 - 0.01, lado < 0 ? 0 : Math.PI);
    }
    // zona de networking
    k.g('madera', CIL(3.4, 3.4, 0.12, 32, 0, 0.21, 0));
    for (i = 0; i < 3; i++) {
      var sofa = new T.TorusGeometry(2.55, 0.32, 8, 20, 1.55);
      sofa.rotateX(Math.PI / 2); sofa.rotateY(i * 2.09 + 0.25); sofa.scale(1, 0.75, 1); sofa.translate(0, 0.55, 0);
      k.g('azulSofa', sofa);
      var resp = new T.TorusGeometry(2.95, 0.12, 6, 20, 1.55);
      resp.rotateX(Math.PI / 2); resp.rotateY(i * 2.09 + 0.25); resp.scale(1, 3.6, 1); resp.translate(0, 0.75, 0);
      k.g('azulSofa', resp);
    }
    k.g('madera', CIL(0.95, 0.95, 0.08, 20, 0, 0.75, 0)); k.g('negro', CIL(0.2, 0.3, 0.6, 10, 0, 0.42, 0));
    cartel(e, TEX.networking, 4.6, 0.9, 0, 3.3, 3.35, 0, { transp: true });
    cartel(e, TEX.networking, 4.6, 0.9, 0, 3.3, -3.35, Math.PI, { transp: true });
    k.box('negro', -2.4, -2.3, 0.2, 3.8, 3.3, 3.4); k.box('negro', 2.3, 2.4, 0.2, 3.8, 3.3, 3.4);
    k.box('negro', -2.4, -2.3, 0.2, 3.8, -3.4, -3.3); k.box('negro', 2.3, 2.4, 0.2, 3.8, -3.4, -3.3);
    // muro de bienvenida con el logo
    k.box('blanco', -12.9, -12.5, 0.15, 4.4, -3.6, 3.6);
    cartel(e, TEX.logo, 6.6, 3.3, -12.48, 2.5, 0, Math.PI / 2, { transp: true });
    haz(e, -12.4, 0.2, -2.8, Math.PI / 2, 0xA855F7, 4); haz(e, -12.4, 0.2, 2.8, Math.PI / 2, 0xA855F7, 4);
    for (i = 0; i < 6; i++) planta(k, -10 + i * 4, i % 2 ? -3.6 : 3.6, 1.6, 0.7);
    // samanes de la plaza
    saman(k, -22, -17, 0.8); saman(k, 21, -18, 0.75);
    charco(e, 0, 0, 12, 7, 0xE879F9, 0.25);
    charco(e, 0, 0, 4, 4, 0x22D3EE, 0.3);
    k.armar(e);
    var g = [];
    genteAleatoria(g, 26, -11, 11, -3.4, 3.4, 5);
    for (i = 0; i < stands.length; i += 2) g.push([stands[i][0] + 0.8, stands[i][1] * 5.9, stands[i][1] < 0 ? 0 : Math.PI]);
    gente(e, g);
    return { escena: e, pos: [17, 13, 21], obj: [0, 1.4, 0], dist: [6, 60] };
  }

  /* ======================================================================
     PABELLÓN DE MARCAS (carpa con stands, lounge y DJ)
     ====================================================================== */
  function marcas() {
    var e = escenaBase(45, 130), k = new Kit(), i, x;
    suelo(e, '#0B0714');
    k.box('pisoOscuro', -24, 24, 0, 0.1, -12, 12);
    // carpa
    var carpa = new T.CylinderGeometry(10, 10, 42, 28, 1, true, 0, Math.PI);
    carpa.rotateZ(Math.PI / 2); carpa.scale(1, 0.92, 1);
    var mc = new T.Mesh(carpa, M.lona); mc.renderOrder = 2; e.add(mc);
    var arcos = [];
    for (x = -21; x <= 21; x += 6) {
      for (i = 0; i < 16; i++) {
        var f1 = Math.PI * i / 16, f2 = Math.PI * (i + 1) / 16;
        arcos.push(x, Math.sin(f1) * 9.2, Math.cos(f1) * 10, x, Math.sin(f2) * 9.2, Math.cos(f2) * 10);
        arcos.push(x, Math.sin(f1) * 8.6, Math.cos(f1) * 9.4, x, Math.sin(f2) * 8.6, Math.cos(f2) * 9.4);
      }
      k.box('acero', x - 0.12, x + 0.12, 0, 0.6, -10.1, -9.8); k.box('acero', x - 0.12, x + 0.12, 0, 0.6, 9.8, 10.1);
    }
    var cumbres = [Math.PI / 2, Math.PI / 3, 2 * Math.PI / 3, Math.PI / 6, 5 * Math.PI / 6];
    for (i = 0; i < cumbres.length; i++) arcos.push(-21, Math.sin(cumbres[i]) * 9.2, Math.cos(cumbres[i]) * 10, 21, Math.sin(cumbres[i]) * 9.2, Math.cos(cumbres[i]) * 10);
    lineas(e, arcos, 0xCFC6E6, 0.55);
    // telas cruzadas (violeta, negra y beige)
    var telas = [['telaV', -14, 0.55], ['telaN', -8, -0.5], ['telaB', -2, 0.6], ['telaV', 4, -0.55], ['telaN', 10, 0.5], ['telaV', 16, -0.6]];
    for (i = 0; i < telas.length; i++) {
      var tg = new T.PlaneGeometry(1.6, 19);
      tg.rotateX(Math.PI / 2); tg.rotateZ(0.32 * (i % 2 ? 1 : -1)); tg.rotateY(telas[i][2]); tg.translate(telas[i][1], 7.2, 0);
      var mt = new T.Mesh(tg, M[telas[i][0]]); mt.renderOrder = 3; e.add(mt);
    }
    // stands a ambos lados
    var nombres = ['tech', 'innovate', 'data', 'future', 'ecom', 'ia', 'mkt', 'log'];
    var n = 0;
    function stand(sx, lado) {
      var z0 = lado < 0 ? -9.8 : 6.8, z1 = lado < 0 ? -6.8 : 9.8, zf = lado < 0 ? z1 : z0;
      k.box('blanco', sx - 1.95, sx + 1.95, 0.1, 3, lado < 0 ? z0 : z1 - 0.1, lado < 0 ? z0 + 0.1 : z1);
      k.box('blanco', sx - 1.95, sx - 1.85, 0.1, 3, z0, z1); k.box('blanco', sx + 1.85, sx + 1.95, 0.1, 3, z0, z1);
      k.box('negro', sx - 1.95, sx + 1.95, 3, 3.6, zf - 0.08, zf + 0.08);
      cartel(e, TEX.marcas[nombres[n++ % nombres.length]], 3.7, 0.55, sx, 3.3, zf + (lado < 0 ? 0.1 : -0.1), lado < 0 ? 0 : Math.PI);
      cartel(e, TEX.tv, 1.6, 0.9, sx - 0.6, 1.8, (lado < 0 ? z0 + 0.12 : z1 - 0.12), lado < 0 ? 0 : Math.PI);
      k.box('negro', sx - 0.2, sx + 1.3, 0.1, 1.05, (z0 + z1) / 2 - 0.3, (z0 + z1) / 2 + 0.3);
      k.box('neonV', sx - 0.2, sx + 1.3, 1.0, 1.05, (z0 + z1) / 2 + (lado < 0 ? 0.3 : -0.32), (z0 + z1) / 2 + (lado < 0 ? 0.32 : -0.3));
    }
    for (x = -10; x <= 19; x += 4) stand(x, -1);
    for (x = -19; x <= 19; x += 4) stand(x, 1);
    // podcast al fondo
    k.box('negro', -20.5, -14.5, 0.1, 3.4, -9.8, -9.6); k.box('blanco', -20.5, -20.4, 0.1, 3.4, -9.8, -5.8); k.box('blanco', -14.6, -14.5, 0.1, 3.4, -9.8, -5.8);
    k.box('negro', -20.5, -14.5, 3.4, 3.9, -6, -5.8);
    var aro = new T.TorusGeometry(1, 0.05, 6, 32); aro.translate(-17.5, 2, -9.55); k.g('neonV', aro);
    cartel(e, TEX.podcastLetrero, 5.6, 0.45, -17.5, 3.65, -5.78, 0);
    // lounge central: césped, DJ, sofás y mesas altas
    k.g('cesped', CIL(6.2, 6.2, 0.08, 40, 0, 0.14, 0));
    var borde = new T.TorusGeometry(6.2, 0.06, 4, 48); borde.rotateX(Math.PI / 2); borde.translate(0, 0.18, 0); k.g('blanco', borde);
    k.g('negro', CIL(1.9, 1.9, 1.2, 28, 0, 0.78, 0));
    var a1 = new T.TorusGeometry(1.92, 0.05, 4, 40); a1.rotateX(Math.PI / 2); a1.translate(0, 1.38, 0); k.g('neonV', a1);
    var a2 = new T.TorusGeometry(1.92, 0.05, 4, 40); a2.rotateX(Math.PI / 2); a2.translate(0, 0.25, 0); k.g('neonV', a2);
    var banda = new T.Mesh(new T.CylinderGeometry(1.93, 1.93, 0.5, 40, 1, true), new T.MeshBasicMaterial({ map: TEX.conecta, transparent: true }));
    banda.position.y = 0.8; banda.renderOrder = 3; e.add(banda);
    k.box('negro', -1.2, 1.2, 1.38, 1.5, -0.5, 0.5);
    k.box('negro', -2.8, -2.1, 0.18, 1.7, -0.4, 0.4); k.box('negro', 2.1, 2.8, 0.18, 1.7, -0.4, 0.4);
    for (i = 0; i < 4; i++) {
      var ang = i * Math.PI / 2 + Math.PI / 4;
      var so = new T.TorusGeometry(1.4, 0.38, 8, 16, 2.2);
      so.rotateX(Math.PI / 2); so.rotateY(-ang - 1.1); so.scale(1, 0.7, 1);
      so.translate(Math.cos(ang) * 4.6, 0.5, Math.sin(ang) * 4.6);
      k.g('tela', so);
      k.g('maderaClara', CIL(0.45, 0.45, 0.4, 16, Math.cos(ang) * 4.6, 0.4, Math.sin(ang) * 4.6));
    }
    var altas = [], tab = [];
    for (i = 0; i < 6; i++) {
      var an = i * Math.PI / 3, mx = Math.cos(an) * 8.2, mz = Math.sin(an) * 3.6;
      altas.push([mx, 0.1, mz, 0]);
      tab.push([mx + 0.6, 0.1, mz, 0], [mx - 0.6, 0.1, mz, 0]);
    }
    inst(e, geoMesaAlta(), M.negro, altas);
    inst(e, geoTaburete(), M.negro, tab);
    for (i = 0; i < 8; i++) { var pa = i * Math.PI / 4; planta(k, Math.cos(pa) * 6.9, Math.sin(pa) * 6.9 * 0.85, 2.2, 0.8, 'mimbre'); }
    // lámparas de mimbre colgantes y luces cálidas
    var lp = [], cables = [];
    for (x = -18; x <= 18; x += 4.5) {
      for (var zz = -3; zz <= 3; zz += 6) {
        var hy = 6.2 + (Math.abs(x) % 3) * 0.3;
        k.g('mimbre', CIL(0.32, 0.45, 0.6, 10, x, hy, zz));
        lp.push(x, hy - 0.35, zz);
        cables.push(x, hy + 0.3, zz, x, 8.5, zz);
      }
    }
    titilar(luces(e, lp, 0xFFC46B, 0.9), 1.3, 0.18);
    respirar(M.neonV, 0xA855F7, 0xE879F9, 2.4);
    lineas(e, cables, 0x5B5070, 0.6);
    var g1 = [];
    guirnalda(g1, [-21, 8.2, -2], [21, 8.2, -2], 0.8, 70); guirnalda(g1, [-21, 8.2, 2], [21, 8.2, 2], 0.8, 70);
    titilar(luces(e, g1, 0xFFD39A, 0.18), 3.1, 0.5);
    charco(e, 0, 0, 9, 9, 0x8B3FE0, 0.35);
    k.armar(e);
    var gg = [];
    genteAleatoria(gg, 46, -19, 19, -5.6, 5.6, 9);
    gg.push([0, -0.9, Math.PI]);
    gente(e, gg);
    return { escena: e, pos: [-28, 8.5, 5], obj: [3, 2.2, 0], dist: [6, 70] };
  }

  /* ======================================================================
     PODCAST STUDIO
     ====================================================================== */
  function podcast() {
    var e = escenaBase(14, 45), k = new Kit(), i, x;
    suelo(e, '#0B0714', 80);
    k.box('pisoOscuro', -9, 9, 0, 0.05, -7, 7);
    k.box('negro', -3, 3, 0.05, 0.2, -2.25, 2.25);
    // pared de listones con luz violeta
    k.box('negro', -3, 3, 0.2, 3.3, -2.35, -2.25);
    for (x = -2.8; x <= 2.81; x += 0.17) k.box('maderaOscura', x - 0.04, x + 0.04, 0.2, 3.25, -2.25, -2.15);
    k.box('neonV', -2.92, -2.86, 0.2, 3.25, -2.2, -2.12); k.box('neonV', 2.86, 2.92, 0.2, 3.25, -2.2, -2.12);
    haz(e, -2.75, 0.2, -2.1, 0, 0xA855F7, 3.2); haz(e, 2.75, 0.2, -2.1, 0, 0xA855F7, 3.2);
    var aro = new T.TorusGeometry(1.08, 0.045, 6, 48); aro.translate(0, 2.05, -2.05); k.g('neonV', aro);
    var disco = new T.Mesh(new T.CircleGeometry(1.05, 48), new T.MeshBasicMaterial({ map: TEX.podcastLogo }));
    disco.position.set(0, 2.05, -2.08); e.add(disco);
    cartel(e, TEX.iconos, 4.6, 1.15, 0, 2.05, -2.06, 0, { transp: true });
    cartel(e, TEX.ideas, 1.6, 0.22, 0, 0.82, -2.1, 0, { transp: true });
    // paredes laterales y letrero superior
    k.box('blanco', -3.1, -3, 0.2, 3.5, -2.35, 2.25); k.box('blanco', 3, 3.1, 0.2, 3.5, -2.35, 2.25);
    k.box('blanco', -3.1, 3.1, 3.3, 3.5, -2.35, 2.25);
    k.box('negro', -3.1, 3.1, 3.5, 4.1, 2.1, 2.3);
    cartel(e, TEX.podcastLetrero, 5.8, 0.48, 0, 3.8, 2.31, 0);
    cartel(e, TEX.grabando, 0.95, 1.7, 2.94, 1.75, 0.6, -Math.PI / 2);
    // sillones, mesa, micrófonos
    var son = geoSillon();
    inst(e, son, M.tela, [[-1.2, 0.2, 0.15, 0.5], [1.2, 0.2, 0.15, -0.5]]);
    k.g('negro', CIL(0.42, 0.36, 0.5, 20, 0, 0.45, -0.1));
    k.g('maderaOscura', CIL(0.07, 0.07, 0.12, 8, -0.15, 0.76, -0.05)); k.g('maderaOscura', CIL(0.07, 0.07, 0.12, 8, 0.18, 0.76, 0));
    planta(k, 0, -0.15, 1.25, 0.18, false);
    var mics = [[-0.75, -0.55, -1], [0.75, -0.55, 1]];
    for (i = 0; i < mics.length; i++) {
      var mx = mics[i][0], mz = mics[i][1], d = mics[i][2];
      k.g('negro', CIL(0.03, 0.03, 1.2, 6, mx - d * 0.6, 0.8, mz - 0.4));
      k.g('negro', BARRA([mx - d * 0.6, 1.4, mz - 0.4], [mx, 1.15, mz], 0.04));
      k.g('negro', CIL(0.06, 0.06, 0.22, 10, mx, 1.12, mz));
    }
    // plantas, cajas y faroles
    planta(k, -2.5, -1.6, 2.4, 0.5, 'maceta');
    k.box('maderaClara', -2.85, -1.95, 0.2, 0.85, 0.9, 1.7); k.box('maderaClara', -2.75, -2.05, 0.85, 1.45, 1, 1.6);
    k.box('maderaClara', -1.95, -1.25, 0.2, 0.75, 1.1, 1.8);
    k.g('calido', CIL(0.09, 0.09, 0.22, 8, -2.4, 1.6, 1.3)); k.g('calido', CIL(0.08, 0.08, 0.2, 8, -1.6, 0.86, 1.45));
    planta(k, 2.45, -1.6, 2.0, 0.45, 'maceta');
    titilar(luces(e, [-2.4, 1.6, 1.3, -1.6, 0.86, 1.45, -1.5, 3.25, 0, 1.5, 3.25, 0, 0, 3.25, 1.2], 0xFFC46B, 0.5), 2.2, 0.25);
    respirar(M.neonV, 0x9333EA, 0xC084FC, 1.2);
    if (VIVO) {
      var rojo = cartel(e, TEX.alAire, 1.3, 0.34, 2.2, 3.05, -2.08, 0, { transp: true });
      anima(function (t) { rojo.material.opacity = 0.55 + 0.45 * Math.abs(Math.sin(t * 2.4)); });
    }
    charco(e, 0, 0, 4, 3, 0xA855F7, 0.4);
    // entorno de la carpa
    for (x = -8; x <= 8; x += 4) { if (Math.abs(x) < 4) continue; k.box('blanco', x - 1.8, x + 1.8, 0, 2.8, -6.5, -6.4); k.box('negro', x - 1.8, x + 1.8, 2.8, 3.3, -6.6, -6.4); }
    k.armar(e);
    gente(e, [[-1.2, 0.05, Math.PI + 0.5, true], [1.2, 0.05, Math.PI - 0.5, true], [-0.6, 4.8, Math.PI], [0.9, 5.2, Math.PI], [3.8, 4.4, -2.6]]);
    return { escena: e, pos: [4.6, 2.9, 7.6], obj: [0, 1.4, -0.6], dist: [3, 18] };
  }

  /* ======================================================================
     ZONA DE WORKSHOPS (cubierta metálica bajo los árboles)
     ====================================================================== */
  function workshops() {
    var e = escenaBase(35, 100), k = new Kit(), i, x, z;
    suelo(e, '#0C0816');
    k.box('concreto', -14, 14, 0, 0.08, -10, 10);
    var px = [-13, -4.33, 4.33, 13], tr = [];
    for (i = 0; i < px.length; i++) {
      k.box('acero', px[i] - 0.15, px[i] + 0.15, 0, 6.2, -9.6, -9.3);
      k.box('acero', px[i] - 0.15, px[i] + 0.15, 0, 6.2, 9.3, 9.6);
      tr.push(px[i], 6.2, -9.5, px[i], 6.2, 9.5);
      for (z = -9.5; z < 9.5; z += 1.9) tr.push(px[i], 6.2, z, px[i], 6.9, z + 0.95, px[i], 6.9, z + 0.95, px[i], 6.2, z + 1.9);
      tr.push(px[i], 6.9, -9.5, px[i], 6.9, 9.5);
    }
    tr.push(-13, 6.2, -9.5, 13, 6.2, -9.5, -13, 6.2, 9.5, 13, 6.2, 9.5);
    lineas(e, tr, 0x8A84A0, 0.6);
    k.box('techoT', -14, 14, 6.9, 7.05, -10.2, 10.2);
    cortina(e, 26, 5.6, 0, 2.8, -9.4, 0);
    cortina(e, 7, 5.6, -13.1, 2.8, -5.9, Math.PI / 2);
    cortina(e, 7, 5.6, 13.1, 2.8, -5.9, -Math.PI / 2);
    for (x = -11; x <= 11; x += 5.5) haz(e, x, 0.1, -9.3, 0, 0x9D4DFF, 5);
    // tarima y pantalla
    k.box('negro', -6, 6, 0, 0.8, -9.2, -6);
    alternar([cartel(e, TEX.pantalla, 7, 3.9, 0, 3.6, -9.3, 0)], VIVO ? [TEX.pantalla, TEX.vivo] : [TEX.pantalla, TEX.lema], VIVO ? 5 : 7);
    k.box('negro', -7.3, -6.7, 0, 2.8, -7.8, -7.2); k.box('negro', 6.7, 7.3, 0, 2.8, -7.8, -7.2);
    k.box('negro', -0.3, 0.3, 0.8, 1.9, -7, -6.6);
    barrer([cono(e, -3, 6.1, -7.4, 5.3, 1.6, 0xA855F7, 0.07), cono(e, 3, 6.1, -7.4, 5.3, 1.6, 0xE879F9, 0.06)], 0.2, 0.6);
    charco(e, 0, -7.5, 8, 4, 0x8B3FE0, 0.4);
    // árboles que atraviesan la cubierta
    k.g('tronco', CIL(0.55, 0.75, 9, 8, -14.6, 4.5, -2));
    k.g('tronco', BARRA([-14.6, 7, -2], [-18, 10, 0], 0.4)); k.g('tronco', BARRA([-14.6, 7.5, -2], [-12, 10.5, -5], 0.35));
    k.g('copaT', BOLA(7, -15, 11, -2, 1, 0.45, 1)); k.g('copaT', BOLA(5, -11, 10.6, -6, 1, 0.45, 1));
    arbol(k, 17, 6, 9, 4.5, true); arbol(k, 16, -12, 10, 5, true); arbol(k, -18, 12, 8, 4, true);
    k.armar(e);
    // sillas y público con audífonos
    var sillas = [], pub = [], aud = [], semilla = 13;
    function r() { semilla = (semilla * 9301 + 49297) % 233280; return semilla / 233280; }
    for (z = -3.6; z <= 7.4; z += 1.0) {
      for (x = -11; x <= 11.01; x += 0.62) {
        if (Math.abs(x) < 0.9) continue;
        sillas.push([x, 0.08, z, 0]);
        if (r() < 0.72) { pub.push([x, z + 0.02, 0, true]); aud.push([x, 0.12 + CABEZA_Y * 0.82 + 0.04, z + 0.02, 0]); }
      }
    }
    inst(e, geoSilla(LIGERO), M.blanco, sillas);
    gente(e, pub.concat([[0, -7.6, 0]]));
    var auri = new T.TorusGeometry(0.13, 0.03, 4, 12, Math.PI);
    inst(e, auri, M.neonC, aud.map(function (a) { return [a[0], a[1] - 0.04, a[2], 0]; }));
    return { escena: e, pos: [0, 7.4, 22], obj: [0, 2.2, -3], dist: [6, 60] };
  }

  /* ======================================================================
     ZONA FOTOGRÁFICA
     ====================================================================== */
  function foto() {
    var e = escenaBase(22, 70), k = new Kit(), i;
    suelo(e, '#120C1C', 120);
    k.box('concreto', -14, 14, 0, 0.04, -12, 10);
    // tarima redonda
    k.g('negro', CIL(2.7, 2.8, 0.38, 40, 0, 0.21, -1));
    var ar = new T.TorusGeometry(2.72, 0.05, 4, 60); ar.rotateX(Math.PI / 2); ar.translate(0, 0.4, -1); k.g('neonV', ar);
    cartel(e, TEX.labsChico, 0.9, 0.22, 0, 0.22, 1.8, 0, { transp: true });
    // árbol grande con telas
    var tx = 0, tz = -7.5;
    k.g('tronco', CIL(0.75, 1.1, 6, 10, tx, 3, tz));
    var ramas = [[-6, 9.4, -5], [6, 9.6, -4.5], [-3.5, 10.2, -11], [4, 10.5, -11.5], [0, 11, -3.5]], fl = [];
    for (i = 0; i < ramas.length; i++) {
      k.g('tronco', BARRA([tx, 5.5, tz], ramas[i], 0.42));
      guirnalda(fl, [tx, 5.6, tz], ramas[i], 0.3, 18);
    }
    k.g('copaT', BOLA(9, 0, 12, -7.5, 1, 0.3, 1)); k.g('copaT', BOLA(6, -5, 11.4, -4, 1, 0.3, 1)); k.g('copaT', BOLA(6, 5, 11.6, -4.5, 1, 0.3, 1));
    titilar(luces(e, fl, 0xFFD39A, 0.2), 2.6, 0.55);
    var colg = [[-5.2, -4.9, 'telaV'], [-3.6, -5.2, 'telaN'], [-1.8, -5.6, 'telaV'], [1.9, -5.4, 'telaV'], [3.7, -5.0, 'telaN'], [5.3, -4.6, 'telaV'], [-4.4, -7.2, 'telaB'], [4.6, -7, 'telaB']];
    for (i = 0; i < colg.length; i++) {
      var pg = new T.PlaneGeometry(1.1, 7.4); pg.rotateY(0.3 * (i % 2 ? 1 : -1)); pg.translate(colg[i][0], 5.6, colg[i][1]);
      k.g(colg[i][2], pg);
    }
    var curvas = [[[-6, 9.2, -5], [-2.5, 6.2, -4.6], [0, 7.8, -4.2]], [[0, 7.8, -4.2], [2.6, 6.0, -4.4], [6, 9.4, -4.5]], [[-5.8, 9.0, -5.2], [-4.6, 5.8, -3.8], [-3.2, 7.6, -4.6]], [[3.2, 7.6, -4.4], [4.6, 5.9, -3.9], [5.8, 9.2, -4.8]]];
    for (i = 0; i < curvas.length; i++) {
      var cv = new T.CatmullRomCurve3(curvas[i].map(function (p) { return new T.Vector3(p[0], p[1], p[2]); }));
      k.g(i % 2 ? 'lila' : 'telaV', new T.TubeGeometry(cv, 16, 0.15, 6, false));
    }
    // jardín tropical en semicírculo
    var hojas = [], flores = [], semilla = 21;
    function r() { semilla = (semilla * 9301 + 49297) % 233280; return semilla / 233280; }
    for (i = 0; i < 70; i++) {
      var a = Math.PI * (1.05 + r() * 0.9), rad = 3.2 + r() * 2.8;
      hojas.push([Math.cos(a) * rad, 0.4 + r() * 0.9, -1 + Math.sin(a) * rad * 0.9, r() * 6, 0.5 + r() * 0.9, 0.6 + r() * 1.4, 0.5 + r() * 0.9]);
      if (i % 2 === 0) flores.push([Math.cos(a) * (rad - 0.3), 1 + r() * 1.4, -1 + Math.sin(a) * (rad - 0.3) * 0.9, 0, 0.14 + r() * 0.12]);
    }
    var hojasGeo = new T.IcosahedronGeometry(1, 0);
    inst(e, hojasGeo, lam(0xffffff, { flatShading: true }), hojas, [hexa(0x2E7A4C), hexa(0x1C5636), hexa(0x3E9A5C), hexa(0x24683F)]);
    inst(e, new T.IcosahedronGeometry(1, 0), bas(0xffffff), flores, [hexa(0xB066E0), hexa(0xE24B8C), hexa(0xD8433A), hexa(0x9B6AE0)]);
    var heli = [];
    for (i = 0; i < 9; i++) { var ha = Math.PI * (1.15 + i * 0.09); heli.push([Math.cos(ha) * 3.8, 1.2, -1 + Math.sin(ha) * 3.4, 0, 0.12, 2.4, 0.12]); }
    inst(e, new T.ConeGeometry(1, 1, 5), M.rojo, heli);
    // reflectores al piso
    var refl = [[-2.4, 1.2], [2.4, 1.2], [-3.4, -1.5], [3.4, -1.5]];
    var conosFoto = [];
    for (i = 0; i < refl.length; i++) {
      k.g('negro', CIL(0.12, 0.15, 0.25, 8, refl[i][0], 0.13, refl[i][1]));
      var cf = cono(e, refl[i][0], 0.25, refl[i][1], 4, 0.8, 0xA855F7, 0.06, true);
      cf.userData.baseX = Math.PI;
      conosFoto.push(cf);
    }
    barrer(conosFoto, 0.18, 0.5);
    // letras LABS SUMMIT con volumen
    for (i = 0; i < 7; i++) {
      var capa = cartel(e, TEX.letras, 10.6, 1.9, 0, 0.95, 3.6 - i * 0.05, 0, { alphaTest: 0.5, color: i === 0 ? 0xffffff : 0x3A3047 });
      capa.renderOrder = 0;
    }
    k.box('negro', -6.9, -5.6, 0, 1.3, 2.9, 4.2); k.box('negro', 5.6, 6.9, 0, 1.3, 2.9, 4.2);
    cartel(e, TEX.cuboLabs, 1.2, 1.2, -6.25, 0.65, 4.21, 0); cartel(e, TEX.cuboTulua, 1.2, 1.2, 6.25, 0.65, 4.21, 0);
    for (i = -5; i <= 5; i++) k.g('hojaOscura', BOLA(0.45, i * 1.0, 0.25, 4.6, 1.2, 0.6, 1));
    charco(e, 0, -1, 4.5, 4.5, 0xA855F7, 0.45);
    // terraza del restaurante al fondo a la derecha
    k.box('maderaOscura', 8, 14, 3, 3.3, -9, -3); for (i = 0; i < 3; i++) k.box('madera', 8.2 + i * 2.6, 8.5 + i * 2.6, 0, 3, -8.8, -8.5);
    var gl = []; guirnalda(gl, [8, 3, -3], [14, 3, -3], 0.4, 20); luces(e, gl, 0xFFD39A, 0.2);
    k.armar(e);
    gente(e, [[0.4, -1.2, Math.PI], [-0.5, -0.8, Math.PI + 0.3], [-1.2, 6.8, Math.PI], [1.8, 7.2, Math.PI + 0.4]]);
    return { escena: e, pos: [0, 4.4, 17], obj: [0, 2.6, -1.5], dist: [5, 32] };
  }

  /* ======================================================================
     CAFÉ Y RESTAURANTE (terraza)
     ====================================================================== */
  function cafe() {
    var e = escenaBase(25, 80), k = new Kit(), i, x;
    suelo(e, '#0D0915', 140);
    k.box('concreto', -10, 10, 0, 0.1, -7, 7);
    // muros amarillos con apliques
    k.box('amarillo', -10, 10, 0.1, 1.05, -7, -6.75); k.box('amarillo', 9.75, 10, 0.1, 1.05, -7, 4);
    k.box('blanco', -10, 10, 1.05, 1.12, -7.02, -6.72); k.box('blanco', 9.72, 10.02, 1.05, 1.12, -7, 4);
    for (x = -8; x <= 8; x += 3.2) { k.box('calido', x - 0.08, x + 0.08, 0.55, 0.75, -6.74, -6.7); charco(e, x, -6.2, 0.9, 0.7, 0xFFB347, 0.35); }
    // techo con vigas y columnas
    k.box('techoCafe', -10.3, 10.3, 3.6, 3.75, -7.3, 7.3);
    for (x = -10; x <= 10; x += 4) k.box('blanco', x - 0.1, x + 0.1, 3.35, 3.6, -7.2, 7.2);
    k.box('blanco', -10.3, 10.3, 3.1, 3.6, 6.9, 7.3);
    var cols = [[-10, 7], [10, 7], [-10, -7], [10, -7], [0, 7]];
    for (i = 0; i < cols.length; i++) k.box('blanco', cols[i][0] - 0.25, cols[i][0] + 0.25, 0.1, 3.6, cols[i][1] - 0.25, cols[i][1] + 0.25);
    // barra de madera con luz cálida
    for (var z = -4.4; z <= 3.4; z += 0.16) k.box('madera', 6.55, 6.65, 0.1, 1.05, z - 0.05, z + 0.05);
    k.box('negro', 6.5, 7.6, 1.05, 1.12, -4.5, 3.5);
    k.box('calido', 6.48, 6.52, 0.12, 0.18, -4.4, 3.4);
    charco(e, 6.2, -0.5, 1.4, 4.6, 0xFFB347, 0.35);
    k.box('vidrio', 6.65, 7.5, 1.12, 1.6, -3.8, -2.2);
    for (i = 0; i < 6; i++) k.g(i % 2 ? 'mimbre' : 'rosa', BOLA(0.1, 6.85 + (i % 3) * 0.25, 1.22, -3.5 + Math.floor(i / 3) * 0.6, 1, 0.6, 1, 0));
    k.box('acero', 6.8, 7.4, 1.12, 1.75, 0.4, 1.3); k.box('negro', 6.85, 7.35, 1.12, 1.55, 1.6, 2.1);
    k.box('negro', 9.6, 9.75, 0.1, 3.35, -5, 4);
    cartel(e, TEX.cafe, 2.4, 1.1, 9.55, 2.5, -2.2, -Math.PI / 2, { transp: true });
    cartel(e, TEX.menu, 1.0, 1.4, 9.55, 2.1, 0.2, -Math.PI / 2); cartel(e, TEX.menu, 1.0, 1.4, 9.55, 2.1, 1.4, -Math.PI / 2);
    var bombillas = [];
    for (i = 0; i < 3; i++) { k.g('mimbre', CIL(0.28, 0.42, 0.45, 12, 6.9, 2.75, -3 + i * 2.2)); bombillas.push(6.9, 2.45, -3 + i * 2.2); }
    titilar(luces(e, bombillas, 0xFFC46B, 1.0), 1.1, 0.12);
    // mesas y sillas de ratán
    var mesas = [[-5, -3.5], [-2, -2.8], [1, -3.8], [-3.6, 0.6], [0.6, 0.2], [3.4, -1.5]], sillas = [];
    for (i = 0; i < mesas.length; i++) {
      for (var a = 0; a < 4; a++) { var an = a * Math.PI / 2 + 0.4; sillas.push([mesas[i][0] + Math.cos(an) * 0.85, 0.1, mesas[i][1] + Math.sin(an) * 0.85, -an - Math.PI / 2]); }
      planta(k, mesas[i][0], mesas[i][1], 1.4, 0.12, false);
    }
    inst(e, geoMesaRedonda(0.5), M.maderaClara, mesas.map(function (m) { return [m[0], 0.1, m[1], 0]; }));
    inst(e, geoSilla(true), M.mimbre, sillas);
    // rincón de sillón sobre tapete
    var tap = new T.CircleGeometry(1.6, 32); tap.rotateX(-Math.PI / 2); tap.translate(-6.5, 0.12, 3.6); k.g('mimbre', tap);
    inst(e, geoSillon(), M.tela, [[-7.4, 0.1, 3.4, 1.2]]);
    k.g('maderaClara', CIL(0.55, 0.55, 0.42, 20, -6.2, 0.33, 3.8));
    k.box('maderaClara', -9.5, -6.5, 0.1, 0.78, 5.4, 6.4);
    planta(k, -9.2, -6.1, 2.6, 0.8); planta(k, 9.1, 5.6, 2.8, 0.8); planta(k, -9.2, 6.3, 1.6, 0.5);
    // guirnaldas
    var gl = [];
    for (x = -10; x < 10; x += 4) guirnalda(gl, [x, 3.3, 7.1], [x + 4, 3.3, 7.1], 0.35, 14);
    guirnalda(gl, [-10, 3.2, -6.8], [10, 3.2, -6.8], 0.5, 50);
    titilar(luces(e, gl, 0xFFD39A, 0.2), 2.8, 0.5);
    // entorno: árboles y kioscos de la feria
    arbol(k, -7, -17, 9, 4.5); arbol(k, 4, -18, 10, 5); arbol(k, 18, -9, 8, 4); arbol(k, 18, 8, 9, 4.5);
    var kio = [[-14, -16, 'rojo'], [-9, -18, 'lila'], [9, -18, 'rojo']];
    for (i = 0; i < kio.length; i++) { k.box('blanco', kio[i][0] - 1.5, kio[i][0] + 1.5, 0, 2.2, kio[i][1] - 1.2, kio[i][1] + 1.2); k.box(kio[i][2], kio[i][0] - 1.8, kio[i][0] + 1.8, 2.2, 2.6, kio[i][1] - 1.5, kio[i][1] + 1.5); }
    k.armar(e);
    gente(e, [[7.6, -1, -Math.PI / 2], [7.6, 1.6, -Math.PI / 2], [-5, -2.7, 0, true], [-2.8, -2.2, 1.5, true], [0.6, -0.6, 3, true], [3.4, -0.6, 3, true], [5.6, 0.4, Math.PI / 2], [5.4, -1.4, Math.PI / 2], [-7.2, 3.4, 1.2, true]]);
    return { escena: e, pos: [-6.5, 2.9, 8.5], obj: [1.5, 1.3, -1.5], dist: [4, 22] };
  }

  /* ======================================================================
     TAQUILLAS Y ALAMEDA DE INGRESO
     ====================================================================== */
  function taquillas() {
    var e = escenaBase(40, 120), k = new Kit(), i, z;
    suelo(e, '#0C0814', 220);
    var tA = texRejilla('rgba(30,18,22,0.55)', '#5C4140', 32); tA.repeat.set(7, 40);
    var camino = new T.Mesh(new T.PlaneGeometry(14, 80), new T.MeshLambertMaterial({ map: tA }));
    camino.rotation.x = -Math.PI / 2; camino.position.set(0, 0.02, -10); e.add(camino);
    k.box('cesped', -30, -7, 0, 0.03, -50, 30); k.box('cesped', 7, 30, 0, 0.03, -50, 30);
    // árboles de la alameda
    for (z = 26; z >= -48; z -= 5.5) { arbol(k, -9, z, 8.5, 2.2); arbol(k, 9, z + 2.5, 8.5, 2.2); }
    // reja negra a la izquierda
    k.box('negro', -12.2, -12, 0, 2.6, -48, 22);
    for (z = -48; z <= 22; z += 3) k.box('negro', -12.25, -11.95, 0, 2.9, z - 0.06, z + 0.06);
    k.box('gris', -22, -12.5, 2.6, 3.1, -46, 18);
    // pórtico de taquillas
    k.box('blanco', -7, -5.7, 0, 4.6, 8.6, 11.4); k.box('blanco', 5.7, 7, 0, 4.6, 8.6, 11.4);
    k.box('blanco', -7, 7, 3.4, 4.6, 8.6, 11.4);
    cartel(e, TEX.taquillas, 9.5, 0.9, 0, 4.0, 11.42, 0);
    cartel(e, TEX.taquillas, 9.5, 0.9, 0, 4.0, 8.58, Math.PI);
    var molinetes = [];
    for (i = 0; i < 8; i++) {
      var mx = -5 + i * (10 / 7);
      k.box('acero', mx - 0.18, mx + 0.18, 0, 1.0, 9.6, 10.5);
      k.box('verdeLed', mx - 0.1, mx + 0.1, 0.8, 0.95, 10.51, 10.53);
      if (i < 7) { k.g('acero', BARRA([mx + 0.18, 0.85, 10.05], [mx + 0.75, 0.85, 10.05], 0.04)); molinetes.push([mx + 0.7, 9.2, Math.PI]); }
    }
    // arco LABS SUMMIT con patrocinadores
    k.box('negro', -6.6, -5.4, 0, 5.2, -6.6, -5.4); k.box('negro', 5.4, 6.6, 0, 5.2, -6.6, -5.4);
    k.box('negro', -6.6, 6.6, 4.1, 5.3, -6.5, -5.5);
    cartel(e, TEX.arcoLabs, 9.8, 1.1, 0, 4.7, -5.48, 0);
    cartel(e, TEX.columna, 1.1, 3.6, -6, 2.1, -5.38, 0); cartel(e, TEX.columna, 1.1, 3.6, 6, 2.1, -5.38, 0);
    // zona de conectividad
    k.box('negro', -5.4, -4.6, 0, 4.4, -24.4, -23.6); k.box('negro', 4.6, 5.4, 0, 4.4, -24.4, -23.6);
    k.box('negro', -5.4, 5.4, 3.6, 4.5, -24.3, -23.7);
    cartel(e, TEX.conectividad, 9, 0.8, 0, 4.05, -23.68, 0);
    for (i = 0; i < 4; i++) k.box('maderaClara', -3.5 + (i % 2) * 5, -1.5 + (i % 2) * 5, 0, 0.78, -29 - Math.floor(i / 2) * 3, -28 - Math.floor(i / 2) * 3);
    // banderas
    var flags = [[-8, 14], [8, 14]];
    for (i = 0; i < flags.length; i++) { k.g('acero', CIL(0.05, 0.05, 4.4, 6, flags[i][0], 2.2, flags[i][1])); cartel(e, TEX.bandera, 1.6, 1.2, flags[i][0] + (i ? -0.8 : 0.8), 3.6, flags[i][1], 0, { doble: true }); }
    // robot y perro robot
    k.box('blanco', -1.6, -0.9, 0.9, 1.75, 4.2, 4.6); k.g('blanco', BOLA(0.27, -1.25, 2.0, 4.4, 1, 1, 1));
    k.box('negro', -1.42, -1.08, 1.98, 2.08, 4.62, 4.68);
    k.box('blanco', -1.55, -1.32, 0, 0.9, 4.25, 4.55); k.box('blanco', -1.18, -0.95, 0, 0.9, 4.25, 4.55);
    k.box('blanco', -1.85, -1.65, 1.0, 1.7, 4.3, 4.5); k.box('blanco', -0.85, -0.65, 1.0, 1.7, 4.3, 4.5);
    k.box('blanco', 0.8, 1.7, 0.45, 0.7, 4.0, 4.4); k.box('blanco', 1.65, 1.95, 0.55, 0.8, 4.05, 4.35);
    k.box('acero', 0.85, 0.95, 0, 0.45, 4.05, 4.15); k.box('acero', 1.55, 1.65, 0, 0.45, 4.05, 4.15); k.box('acero', 0.85, 0.95, 0, 0.45, 4.25, 4.35); k.box('acero', 1.55, 1.65, 0, 0.45, 4.25, 4.35);
    charco(e, 0, 10, 8, 3, 0xFFFFFF, 0.12);
    charco(e, 0, -6, 7, 3, 0xA855F7, 0.3);
    k.armar(e);
    var g = molinetes.slice();
    genteAleatoria(g, 18, -5, 5, 12.5, 22, 4);
    genteAleatoria(g, 14, -5, 5, -20, -2, 8);
    gente(e, g);
    return { escena: e, pos: [2, 5.8, 31], obj: [0, 2.2, 2], dist: [8, 60] };
  }

  /* ======================================================================
     PUNTO DE INFORMACIÓN
     ====================================================================== */
  function info() {
    var e = escenaBase(18, 60), k = new Kit(), i;
    suelo(e, '#0E0919', 100);
    k.box('pisoClaro', -8, 8, 0, 0.05, -6, 6);
    k.box('blanco', -2.6, 2.6, 0.05, 1.1, -0.5, 0.5);
    k.box('neonV', -2.6, 2.6, 1.0, 1.06, 0.5, 0.53);
    k.box('negro', -2.8, 2.8, 1.1, 1.16, -0.6, 0.6);
    k.box('negro', -3, 3, 0.05, 3.6, -2.2, -2);
    cartel(e, TEX.informacion, 5.6, 1.3, 0, 2.7, -1.98, 0, { transp: true });
    cartel(e, TEX.mapaTV, 1.6, 0.9, -1.6, 1.45, -1.97, 0);
    k.box('negro', 3.6, 4.4, 0.05, 1.5, -0.4, 0.4); k.box('blanco', 3.65, 4.35, 0.6, 1.4, 0.4, 0.42);
    planta(k, -4.2, -1.2, 1.8, 0.6); planta(k, 4.6, -1.6, 1.4, 0.5);
    saman(k, -3, -9, 0.75);
    charco(e, 0, 0.5, 5, 3, 0xC9AEFF, 0.3);
    k.armar(e);
    gente(e, [[-1, -1.2, 0], [1.1, -1.2, 0], [0, 1.6, Math.PI], [0.5, 2.6, Math.PI], [0.1, 3.5, Math.PI]]);
    return { escena: e, pos: [5.5, 4.2, 9.5], obj: [0, 1.5, -0.5], dist: [4, 26] };
  }

  /* ---------------- texturas compartidas ---------------- */
  function prepararTexturas() {
    TEX = {};
    TEX.pantalla = texPantalla('LABS', 'SUMMIT 2026');
    TEX.tv = lienzo(256, 128, function (x) {
      var g = x.createLinearGradient(0, 0, 256, 128); g.addColorStop(0, '#1C0B3A'); g.addColorStop(1, '#5A1FA8');
      x.fillStyle = g; x.fillRect(0, 0, 256, 128);
      x.strokeStyle = 'rgba(232,121,249,.5)'; x.lineWidth = 3;
      for (var i = 0; i < 6; i++) { x.beginPath(); x.arc(200, 100, 20 + i * 18, Math.PI, Math.PI * 1.5); x.stroke(); }
      x.fillStyle = '#EDE3FF'; x.font = 'bold 30px Arial'; x.fillText('LABS', 22, 56);
    });
    TEX.labs = texTexto([{ t: 'LABS', f: 'bold 150px Arial', c: '#2A1F38', y: 0.55 }], { fondo: '#F4F0FA', w: 512, h: 128 });
    TEX.networking = texTexto([{ t: 'ZONA DE NETWORKING', f: 'bold 88px Arial', c: '#F0EAFF', y: 0.5, g: '#22D3EE' }], { w: 1024, h: 256 });
    TEX.logo = texTexto([{ t: 'TULUÁ', f: 'bold 54px Arial', c: '#C9AEFF', y: 0.2 }, { t: 'LABS', f: '900 210px Arial', c: '#F4EEFF', y: 0.52, g: '#A855F7', b: 40 }, { t: 'SUMMIT 2026', f: 'bold 70px Arial', c: '#E9DDFF', y: 0.85, g: '#A855F7' }], { w: 1024, h: 512, marco: 'rgba(168,85,247,.9)', grosor: 12 });
    TEX.marcas = {};
    var nm = { tech: 'TECH SOLUTIONS', innovate: 'INNOVATE', data: 'DATA DRIVEN', future: 'FUTURE LABS', ecom: 'ECOMMERCE', ia: 'IA STUDIO', mkt: 'MARKETING', log: 'LOGÍSTICA' };
    for (var k in nm) if (nm.hasOwnProperty(k)) TEX.marcas[k] = texTexto([{ t: nm[k], f: 'bold 74px Arial', c: '#F4EEFF', y: 0.54 }], { fondo: '#0E0A14', w: 1024, h: 128 });
    TEX.conecta = lienzo(1024, 128, function (x) {
      x.fillStyle = 'rgba(0,0,0,0)'; x.fillRect(0, 0, 1024, 128);
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 54px Arial'; x.fillStyle = '#F4EEFF';
      x.shadowColor = '#A855F7'; x.shadowBlur = 16;
      x.fillText('CONECTA  ·  CREA  ·  ESCALA', 256, 64); x.fillText('CONECTA  ·  CREA  ·  ESCALA', 768, 64);
    });
    TEX.podcastLetrero = texTexto([{ t: 'PODCAST STUDIO', f: 'bold 70px Arial', c: '#F4EEFF', y: 0.55 }], { fondo: '#0E0A14', w: 1024, h: 128 });
    TEX.podcastLogo = lienzo(512, 512, function (x) {
      x.fillStyle = '#0B0812'; x.beginPath(); x.arc(256, 256, 256, 0, Math.PI * 2); x.fill();
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = '#A855F7';
      x.beginPath(); x.moveTo(92, 230); x.lineTo(138, 178); x.lineTo(166, 178); x.lineTo(120, 230); x.closePath(); x.fill();
      x.beginPath(); x.moveTo(110, 268); x.lineTo(156, 216); x.lineTo(184, 216); x.lineTo(138, 268); x.closePath(); x.fill();
      x.fillStyle = '#F4EEFF'; x.font = 'bold 104px Arial'; x.fillText('LABS', 290, 222);
      x.fillStyle = '#B57BFF'; x.font = 'bold 40px Arial'; x.fillText('S U M M I T', 300, 290);
      x.fillStyle = '#EDE3FF'; x.font = 'bold 50px Arial'; x.fillText('PODCAST', 256, 372);
    });
    TEX.iconos = lienzo(1024, 256, function (x) {
      x.strokeStyle = '#FFF4E0'; x.lineWidth = 7; x.lineJoin = 'round'; x.lineCap = 'round'; x.shadowColor = '#FFC46B'; x.shadowBlur = 20;
      x.beginPath(); x.moveTo(70, 70); x.lineTo(105, 70); x.lineTo(130, 160); x.lineTo(220, 160); x.lineTo(240, 95); x.lineTo(115, 95); x.stroke();
      x.beginPath(); x.arc(145, 190, 12, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.arc(205, 190, 12, 0, Math.PI * 2); x.stroke();
      x.beginPath(); x.moveTo(140, 118); x.lineTo(225, 118); x.moveTo(135, 140); x.lineTo(220, 140); x.stroke();
      x.beginPath(); x.roundRect ? x.roundRect(860, 50, 60, 110, 30) : x.rect(860, 50, 60, 110); x.stroke();
      x.beginPath(); x.arc(890, 120, 55, 0, Math.PI); x.moveTo(890, 175); x.lineTo(890, 215); x.moveTo(855, 215); x.lineTo(925, 215); x.stroke();
      x.beginPath(); x.moveTo(860, 85); x.lineTo(880, 85); x.moveTo(860, 110); x.lineTo(880, 110); x.moveTo(900, 85); x.lineTo(920, 85); x.moveTo(900, 110); x.lineTo(920, 110); x.stroke();
    });
    TEX.ideas = texTexto([{ t: 'Ideas que venden.', f: 'bold 70px Arial', c: '#F4EEFF', y: 0.5 }], { fondo: 'rgba(10,6,16,.85)', w: 1024, h: 128 });
    TEX.grabando = lienzo(256, 512, function (x) {
      var g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#0C0716'); g.addColorStop(1, '#1E0B3A');
      x.fillStyle = g; x.fillRect(0, 0, 256, 512);
      x.textAlign = 'center'; x.fillStyle = '#F4EEFF'; x.font = 'bold 34px Arial'; x.fillText('LABS', 128, 70);
      x.font = 'bold 28px Arial'; x.fillText('PODCAST', 128, 150); x.fillStyle = '#C084FC'; x.font = 'bold 22px Arial'; x.fillText('EN GRABACIÓN', 128, 182);
      x.strokeStyle = '#A855F7'; x.lineWidth = 4; x.beginPath();
      for (var i = 0; i < 40; i++) { var h = 10 + Math.abs(Math.sin(i * 1.7)) * 40; x.moveTo(28 + i * 5, 290 - h / 2); x.lineTo(28 + i * 5, 290 + h / 2); }
      x.stroke();
      x.fillStyle = '#F4EEFF'; for (var a = 0; a < 7; a++) for (var b = 0; b < 7; b++) if ((a * 3 + b * 5) % 4 < 2) x.fillRect(70 + a * 12, 380 + b * 12, 11, 11);
    });
    TEX.labsChico = texTexto([{ t: 'LABS SUMMIT', f: 'bold 80px Arial', c: '#F0EAFF', y: 0.5 }], { w: 1024, h: 256 });
    TEX.letras = lienzo(2048, 256, function (x) {
      x.textAlign = 'center'; x.textBaseline = 'middle';
      var tam = 200;
      x.font = '900 ' + tam + 'px "Arial Black", Arial, sans-serif';
      var ancho = x.measureText('LABS SUMMIT').width;
      if (ancho > 1960) { tam = Math.floor(tam * 1960 / ancho); x.font = '900 ' + tam + 'px "Arial Black", Arial, sans-serif'; }
      x.lineWidth = 12; x.strokeStyle = '#A855F7'; x.shadowColor = '#C084FC'; x.shadowBlur = 20;
      x.strokeText('LABS SUMMIT', 1024, 136);
      x.shadowBlur = 0; x.fillStyle = '#17101F'; x.fillText('LABS SUMMIT', 1024, 136);
    });
    TEX.cuboLabs = texTexto([{ t: 'LA', f: 'bold 120px Arial', c: '#F0EAFF', y: 0.36 }, { t: 'BS', f: 'bold 120px Arial', c: '#F0EAFF', y: 0.7 }], { fondo: '#0E0A14', marco: '#A855F7', grosor: 8, w: 256, h: 256 });
    TEX.cuboTulua = texTexto([{ t: 'TULUÁ', f: 'bold 54px Arial', c: '#F0EAFF', y: 0.4 }, { t: 'VALLE', f: 'bold 54px Arial', c: '#F0EAFF', y: 0.64 }], { fondo: '#0E0A14', marco: '#A855F7', grosor: 8, w: 256, h: 256 });
    TEX.cafe = lienzo(512, 256, function (x) {
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = '#FFB347'; x.shadowBlur = 24;
      x.fillStyle = '#FFE2A8'; x.font = 'bold 120px Arial'; x.fillText('CAFÉ', 256, 92); x.fillText('CAFÉ', 256, 92);
      x.strokeStyle = '#FFE2A8'; x.lineWidth = 8; x.beginPath(); x.moveTo(206, 160); x.lineTo(216, 228); x.lineTo(286, 228); x.lineTo(296, 160); x.closePath(); x.stroke();
      x.beginPath(); x.arc(306, 190, 18, -Math.PI / 2, Math.PI / 2); x.stroke();
    });
    TEX.menu = lienzo(256, 512, function (x) {
      x.fillStyle = '#16131A'; x.fillRect(0, 0, 256, 512);
      x.fillStyle = '#E8E2D6'; x.font = 'bold 30px Arial'; x.fillText('MENÚ', 80, 60);
      x.fillStyle = 'rgba(232,226,214,.7)';
      for (var i = 0; i < 12; i++) { x.fillRect(30, 100 + i * 32, 130 + (i * 37) % 60, 6); x.fillRect(200, 100 + i * 32, 26, 6); }
    });
    TEX.taquillas = texTexto([{ t: 'TAQUILLAS', f: 'bold 112px Arial', c: '#17121D', y: 0.55 }], { fondo: '#F6F3FA', w: 1024, h: 128 });
    TEX.arcoLabs = texTexto([{ t: 'LABS SUMMIT 2026', f: 'bold 96px Arial', c: '#E9D8FF', y: 0.55, g: '#A855F7' }], { fondo: '#0B0812', w: 1024, h: 128 });
    TEX.columna = lienzo(128, 512, function (x) {
      x.fillStyle = '#0B0812'; x.fillRect(0, 0, 128, 512);
      x.textAlign = 'center'; x.fillStyle = '#D9CCF2';
      var n = ['LABS', 'TECH', 'IA', 'SHOP', 'PADI', 'VALLE'];
      for (var i = 0; i < n.length; i++) { x.font = 'bold 24px Arial'; x.fillText(n[i], 64, 60 + i * 76); }
    });
    TEX.conectividad = texTexto([{ t: 'ZONA DE CONECTIVIDAD', f: 'bold 80px Arial', c: '#E9D8FF', y: 0.55 }], { fondo: '#0B0812', w: 1024, h: 128 });
    TEX.bandera = texTexto([{ t: 'LABS', f: 'bold 120px Arial', c: '#F0EAFF', y: 0.45, g: '#E879F9' }, { t: 'SUMMIT 2026', f: 'bold 40px Arial', c: '#E9D8FF', y: 0.78 }], { fondo: '#2A0F4A', w: 512, h: 256 });
    TEX.informacion = texTexto([{ t: 'i', f: 'bold 120px Georgia, serif', c: '#C9AEFF', y: 0.32, g: '#A855F7' }, { t: 'INFORMACIÓN', f: 'bold 92px Arial', c: '#F4EEFF', y: 0.74, g: '#A855F7' }], { w: 1024, h: 256 });
    TEX.mapaTV = texTexto([{ t: 'MAPA DEL EVENTO', f: 'bold 34px Arial', c: '#F4EEFF', y: 0.3 }, { t: 'labssummit.com/mapa', f: '26px Arial', c: '#C9AEFF', y: 0.65 }], { fondo: '#1E0B3A', w: 512, h: 256 });
    TEX.cortina = texCortina();
    TEX.haz = texHaz();
    TEX.lema = lienzo(512, 256, function (x, w, h) {
      var g = x.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#2A0750'); g.addColorStop(1, '#0F0420');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.shadowColor = '#E879F9'; x.shadowBlur = 16; x.fillStyle = '#F4EDFF';
      x.font = 'bold 54px Arial, Helvetica, sans-serif';
      x.fillText('CONECTA', w / 2, 70); x.fillText('CREA', w / 2, 128); x.fillText('ESCALA', w / 2, 186);
      x.shadowBlur = 0; x.fillStyle = '#C9AEFF'; x.font = '600 22px Arial, Helvetica, sans-serif';
      x.fillText('LABS SUMMIT · 29 OCT', w / 2, 232);
    });
    TEX.vivo = VIVO ? lienzo(512, 256, function (x, w, h) {
      var g = x.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#1A0533'); g.addColorStop(1, '#3F0D6E');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = '#FF3B6B'; x.beginPath(); x.arc(150, 46, 10, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#FFD1DC'; x.font = 'bold 28px Arial, Helvetica, sans-serif'; x.textBaseline = 'middle'; x.fillText('EN VIVO', 172, 47);
      x.textAlign = 'center'; x.fillStyle = '#F4EDFF'; x.shadowColor = '#E879F9'; x.shadowBlur = 12;
      var tam = 44, palabras = String(VIVO).split(' '), lineas = [], linea = '';
      x.font = 'bold ' + tam + 'px Arial, Helvetica, sans-serif';
      for (var i = 0; i < palabras.length; i++) {
        var prueba = linea ? linea + ' ' + palabras[i] : palabras[i];
        if (x.measureText(prueba).width > 450 && linea) { lineas.push(linea); linea = palabras[i]; } else linea = prueba;
      }
      if (linea) lineas.push(linea);
      if (lineas.length > 3) { lineas = lineas.slice(0, 3); lineas[2] += '…'; }
      var y0 = 140 - (lineas.length - 1) * 26;
      for (var j = 0; j < lineas.length; j++) x.fillText(lineas[j], w / 2, y0 + j * 52);
    }) : null;
    TEX.alAire = lienzo(256, 64, function (x) {
      x.fillStyle = 'rgba(40,4,14,.85)'; x.fillRect(0, 0, 256, 64);
      x.strokeStyle = '#FF3B6B'; x.lineWidth = 4; x.strokeRect(3, 3, 250, 58);
      x.fillStyle = '#FF3B6B'; x.beginPath(); x.arc(40, 32, 11, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#FFE4EA'; x.font = 'bold 30px Arial, Helvetica, sans-serif'; x.textBaseline = 'middle'; x.fillText('AL AIRE', 66, 33);
    });
  }

  /* ---------------- API ---------------- */
  var CONSTRUCTORES = {
    auditorio: auditorio, expositores: expositores, marcas: marcas, podcast: podcast,
    workshops: workshops, foto: foto, cafe: cafe, taquillas: taquillas, info: info
  };

  function crear(THREE, id, opciones) {
    T = THREE;
    LIGERO = !!(opciones && opciones.ligero);
    VIVO = (opciones && opciones.vivo) || null;
    ANIM = [];
    _o = new T.Object3D();
    texturas = [];
    materiales();
    BRILLO = texBrillo();
    M.copaT = lam(0x1F6B45, { flatShading: true, transparent: true, opacity: 0.7, depthWrite: false });
    ROPA = [0x2B2140, 0x3B2F5C, 0xE8E2F2, 0x2A3A5C, 0x6B2A7E, 0x1D1A26, 0x7B6B8B, 0xB08A5E, 0xC9B6E8, 0x2F5B73, 0xD9D2E8].map(hexa);
    PIEL = [0xC69C7A, 0x8D5E3C, 0xE0B897, 0xA8784F, 0x6E4A32].map(hexa);
    PANTALON = [0x1A1724, 0x23304A, 0x2B2235, 0x3A3448, 0x141018, 0x4A3F35].map(hexa);
    prepararTexturas();
    var r = CONSTRUCTORES[id]();
    if (id === 'taquillas') respirar(M.verdeLed, 0x22C55E, 0x0E4D27, 3.2);
    if (id === 'expositores' || id === 'info') respirar(M.neonV, 0xA855F7, 0xE879F9, 1.4);
    if (id === 'cafe') respirar(M.calido, 0xFFC46B, 0xFF9A3C, 1.0);
    var lista = ANIM.slice();
    r.animar = lista.length ? function (t) { for (var i = 0; i < lista.length; i++) lista[i](t); } : null;
    r.liberar = function () {
      r.escena.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { m.dispose(); });
      });
      texturas.forEach(function (t) { t.dispose(); });
      for (var k in M) if (M.hasOwnProperty(k) && M[k] && M[k].dispose) M[k].dispose();
    };
    return r;
  }

  window.LSInteriores = {
    tiene: function (id) { return CONSTRUCTORES.hasOwnProperty(id); },
    crear: crear,
    zonas: Object.keys(CONSTRUCTORES)
  };
})();
