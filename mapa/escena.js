/* ==========================================================================
   Labs Summit 2026 · Modelo 3D del recorrido del evento (29 de octubre)
   Coliseo de Ferias Manuel Victoria Rojas · Tuluá
   --------------------------------------------------------------------------
   La distribución sigue el «Mapa recorrido evento» oficial de Labs Summit:
   Taquilla e ingreso (occidente) → filtros → Zona Cowork → Labs Session,
   P1/P2, Zona de stands con Entrega de kits (norte), Zona Gastrolabs (plaza
   central) y Caja de Arena (sur), Baños 1 y 2, Zona de parqueo e ingreso
   vehicular.

   Unidades ≈ metros. x crece hacia el oriente, z hacia el sur (igual que el
   plano impreso: arriba = norte). Conversión usada desde el plano oficial
   (imagen de 2000 px de ancho): x = (px − 700) · 0,13 ; z = (py − 680) · 0,13.
   Para mover algo basta con cambiar sus números aquí.
   ========================================================================== */
(function () {
  'use strict';
  var T;

  // Zona del recorrido (lo que la cámara encuadra) y plano visible completo.
  var LIMITES = { x0: -64, x1: 78, z0: -60, z1: 46 };
  var SUELO = { x0: -92, x1: 172, z0: -92, z1: 70 };
  var VISTA = { centro: [6, -6], encuadre: [-62, 76, -57, 44] };

  // Contorno del recinto (muro perimetral) tomado del plano oficial.
  var CONTORNO = [[-78.7, -28.3], [45.5, -80.9], [164.8, -79], [102.7, 33.2], [104, 57.2],
                  [-47, 45.5], [-51.5, 61], [-56, 61], [-74, 2]];

  /* ---------- utilidades ---------- */
  function caja(x0, x1, y0, y1, z0, z1) {
    var g = new T.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return g;
  }

  function aristasCaja(a, x0, x1, y0, y1, z0, z1) {
    a.push(
      x0, y0, z0, x1, y0, z0,  x1, y0, z0, x1, y0, z1,  x1, y0, z1, x0, y0, z1,  x0, y0, z1, x0, y0, z0,
      x0, y1, z0, x1, y1, z0,  x1, y1, z0, x1, y1, z1,  x1, y1, z1, x0, y1, z1,  x0, y1, z1, x0, y1, z0,
      x0, y0, z0, x0, y1, z0,  x1, y0, z0, x1, y1, z0,  x1, y0, z1, x1, y1, z1,  x0, y0, z1, x0, y1, z1
    );
  }

  function fusionar(lista) {
    var partes = [], n = 0, i;
    for (i = 0; i < lista.length; i++) {
      var g = lista[i].index ? lista[i].toNonIndexed() : lista[i];
      if (!g.attributes.normal) g.computeVertexNormals();
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

  function cuadro(a, b, c, d) {
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute([].concat(a, b, c, a, c, d), 3));
    g.computeVertexNormals();
    return g;
  }

  function texturaBrillo() {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var x = c.getContext('2d');
    var g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return new T.CanvasTexture(c);
  }

  function texturaPantalla() {
    var c = document.createElement('canvas'); c.width = 512; c.height = 256;
    var x = c.getContext('2d');
    var g = x.createLinearGradient(0, 0, 512, 256);
    g.addColorStop(0, '#1A0533'); g.addColorStop(1, '#43107A');
    x.fillStyle = g; x.fillRect(0, 0, 512, 256);
    x.strokeStyle = 'rgba(232,121,249,0.55)'; x.lineWidth = 4;
    x.beginPath(); x.moveTo(70, 20); x.lineTo(120, 110); x.lineTo(92, 118); x.lineTo(150, 236); x.stroke();
    x.beginPath(); x.moveTo(440, 30); x.lineTo(400, 120); x.lineTo(428, 126); x.lineTo(380, 230); x.stroke();
    x.fillStyle = '#F0EAFF'; x.textAlign = 'center';
    x.font = 'bold 96px Arial, Helvetica, sans-serif'; x.fillText('LABS', 256, 140);
    x.fillStyle = '#C9AEFF'; x.font = '600 34px Arial, Helvetica, sans-serif'; x.fillText('SUMMIT 2026', 256, 192);
    return new T.CanvasTexture(c);
  }

  /* ---------- piso horneado en una textura (estilo del plano oficial) ---------- */
  function texturaSuelo(calidad, extras) {
    extras = extras || { sombras: [], faroles: [] };
    // resolución del piso según el equipo: en «alta» las líneas y textos del plano se ven nítidos de cerca
    var W = calidad === 'alta' ? 3584 : calidad === 'media' ? 2048 : 1024, H = Math.round(W * (SUELO.z1 - SUELO.z0) / (SUELO.x1 - SUELO.x0));
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d');
    var sx = W / (SUELO.x1 - SUELO.x0), sz = H / (SUELO.z1 - SUELO.z0);
    function X(v) { return (v - SUELO.x0) * sx; }
    function Z(v) { return (v - SUELO.z0) * sz; }
    function rect(x0, x1, z0, z1) { x.fillRect(X(x0), Z(z0), (x1 - x0) * sx, (z1 - z0) * sz); }
    function marco(x0, x1, z0, z1) { x.strokeRect(X(x0), Z(z0), (x1 - x0) * sx, (z1 - z0) * sz); }
    function linea(a, b, c2, d) { x.beginPath(); x.moveTo(X(a), Z(b)); x.lineTo(X(c2), Z(d)); x.stroke(); }
    function trazo(pts) { x.beginPath(); x.moveTo(X(pts[0][0]), Z(pts[0][1])); for (var i = 1; i < pts.length; i++) x.lineTo(X(pts[i][0]), Z(pts[i][1])); }
    function via(pts, ancho, color) {
      x.save(); x.strokeStyle = color; x.lineWidth = ancho * sx; x.lineCap = 'round'; x.lineJoin = 'round';
      trazo(pts); x.stroke(); x.restore();
    }
    function redondo(x0, x1, z0, z1, r) {
      var ax = X(x0), bx = X(x1), az = Z(z0), bz = Z(z1), rx = r * sx, rz = r * sz;
      x.beginPath();
      x.moveTo(ax + rx, az); x.lineTo(bx - rx, az); x.quadraticCurveTo(bx, az, bx, az + rz);
      x.lineTo(bx, bz - rz); x.quadraticCurveTo(bx, bz, bx - rx, bz); x.lineTo(ax + rx, bz);
      x.quadraticCurveTo(ax, bz, ax, bz - rz); x.lineTo(ax, az + rz); x.quadraticCurveTo(ax, az, ax + rx, az);
      x.closePath();
    }

    // fondo exterior
    x.fillStyle = '#05070F'; x.fillRect(0, 0, W, H);
    // cuadrícula técnica, como en el plano
    x.strokeStyle = 'rgba(90,120,255,0.05)'; x.lineWidth = 1;
    for (var gx = SUELO.x0; gx <= SUELO.x1; gx += 10) linea(gx, SUELO.z0, gx, SUELO.z1);
    for (var gz = SUELO.z0; gz <= SUELO.z1; gz += 10) linea(SUELO.x0, gz, SUELO.x1, gz);

    // terreno del recinto
    trazo(CONTORNO); x.closePath();
    x.fillStyle = '#0B1029'; x.fill();
    // muro perimetral con brillo azul
    x.save();
    trazo(CONTORNO); x.closePath();
    x.shadowColor = 'rgba(80,110,255,0.8)'; x.shadowBlur = 2.2 * sx;
    x.strokeStyle = '#2C3C93'; x.lineWidth = 2.4 * sx; x.lineJoin = 'round'; x.stroke();
    x.restore();
    trazo(CONTORNO); x.closePath();
    x.strokeStyle = 'rgba(150,170,255,0.55)'; x.lineWidth = Math.max(1, 0.35 * sx); x.stroke();

    // calles internas (gris azulado)
    var gris = '#171E3D';
    via([[-70, -27], [44, -74], [160, -73]], 5, gris);                 // vía norte, junto al muro
    via([[-67, -26], [-61, -8], [-55, 16], [-50, 42]], 5, gris);         // vía occidental (taquilla)
    via([[-50, 42], [101, 53.5]], 6, gris);                              // vía sur
    via([[75.5, -64], [75.5, 52]], 4.5, gris);                           // vía oriental de la plaza
    via([[20.8, -33], [20.8, 9]], 4, gris);                              // vía entre P2 y Gastrolabs
    via([[20.8, -33], [118, -33]], 4, gris);                             // vía norte de la plaza
    via([[21, 9], [14, 7], [9, 16], [6, 30], [4, 42]], 5, gris);         // curva hacia el sur
    via([[118, -66], [118, 30]], 3.5, gris);
    via([[-30, -27.6], [20, -27.6]], 3.2, gris);                         // paso frente a P1/P2
    via([[-30, -27.6], [-29, -44]], 3, gris);                            // hacia Baños 1
    via([[-5, -48], [-5, -28]], 2.6, gris);

    // lotes del costado oriental (fuera del evento)
    x.strokeStyle = 'rgba(95,120,230,0.22)'; x.lineWidth = Math.max(1, 0.3 * sx);
    marco(37, 72.5, -64, -35); marco(78, 115, -64, -35.5); marco(78, 115, -30, 30);
    marco(121, 160, -70, -10);
    x.beginPath(); x.moveTo(X(121), Z(-5)); x.lineTo(X(150), Z(-5)); x.lineTo(X(108), Z(30)); x.lineTo(X(121), Z(30)); x.closePath(); x.stroke();

    // zona de parqueo (azul) con demarcación
    x.fillStyle = '#10204A'; rect(-54.6, -25.4, -4.6, 38.4);
    x.strokeStyle = 'rgba(120,160,255,0.35)'; x.lineWidth = Math.max(1, 0.25 * sx);
    marco(-54.6, -25.4, -4.6, 38.4);
    x.strokeStyle = 'rgba(200,215,255,0.16)';
    for (var pz = -2; pz <= 36; pz += 2.6) { linea(-53, pz, -47.5, pz); linea(-43, pz, -36.5, pz); linea(-32.5, pz, -27, pz); }
    linea(-40, -3, -40, 37);

    // recorrido peatonal principal (taquilla → filtros → Cowork → plaza)
    via([[-62, -7], [-17, -7]], 4.2, '#222B55');
    via([[-2, -7], [22, -7]], 4.2, '#222B55');
    via([[-13.5, -12.5], [-4, -20]], 2.6, '#1E264D');
    via([[-5.5, -12.5], [5.3, -20]], 2.6, '#1E264D');
    // huellas que marcan el sentido del recorrido
    x.fillStyle = 'rgba(200,190,255,0.28)';
    function huellas(x0, z0, x1, z1, paso) {
      var dx = x1 - x0, dz = z1 - z0, L = Math.sqrt(dx * dx + dz * dz), n = Math.floor(L / paso);
      for (var i = 0; i <= n; i++) {
        var t = i / Math.max(1, n), lado = (i % 2 ? 0.45 : -0.45);
        var px = x0 + dx * t - dz / L * lado, pz2 = z0 + dz * t + dx / L * lado;
        x.beginPath(); x.ellipse(X(px), Z(pz2), 0.32 * sx, 0.2 * sz, Math.atan2(dz, dx), 0, Math.PI * 2); x.fill();
      }
    }
    huellas(-60, -7, -18, -7, 3.2); huellas(-1, -7, 21, -7, 3.2);
    huellas(-12.5, -13, -4.5, -19.5, 2.6); huellas(-4.5, -13, 4.5, -19.5, 2.6);
    huellas(20.8, -5, 20.8, 6, 2.6); huellas(5.3, -21, 5.3, -27, 2.4);

    // plaza Gastrolabs: piso propio con borde de neón
    redondo(22.8, 73.5, -31.9, 7.2, 4);
    x.fillStyle = '#120E33'; x.fill();
    x.save(); x.shadowColor = 'rgba(232,121,249,0.9)'; x.shadowBlur = 1.6 * sx;
    x.strokeStyle = 'rgba(232,121,249,0.6)'; x.lineWidth = Math.max(1.5, 0.35 * sx); x.stroke(); x.restore();
    // franja de ingresos a la Caja de Arena
    x.fillStyle = '#151A3E'; rect(21.5, 56, 7.2, 13);

    // sombras suaves bajo cada edificio (le dan peso a la maqueta)
    x.save();
    x.fillStyle = 'rgba(0,0,0,0.5)';
    x.shadowColor = 'rgba(0,0,0,0.9)';
    x.shadowBlur = 2.6 * sx;
    for (var s = 0; s < extras.sombras.length; s++) {
      var r = extras.sombras[s];
      x.fillRect(X(r[0]), Z(r[2]), (r[1] - r[0]) * sx, (r[3] - r[2]) * sz);
    }
    x.restore();

    // charcos de luz cálida de los faroles
    x.save();
    x.globalCompositeOperation = 'lighter';
    for (var f = 0; f < extras.faroles.length; f++) {
      var p = extras.faroles[f];
      x.save();
      x.translate(X(p[0]), Z(p[1]));
      x.scale(1, sz / sx);
      var g = x.createRadialGradient(0, 0, 0, 0, 0, 6.5 * sx);
      g.addColorStop(0, 'rgba(255,186,105,0.26)');
      g.addColorStop(0.45, 'rgba(255,170,90,0.09)');
      g.addColorStop(1, 'rgba(255,160,80,0)');
      x.fillStyle = g;
      x.beginPath(); x.arc(0, 0, 6.5 * sx, 0, Math.PI * 2); x.fill();
      x.restore();
    }
    x.restore();

    var t = new T.CanvasTexture(c);
    t.anisotropy = extras.aniso || 4;
    t.generateMipmaps = true;
    t.minFilter = T.LinearMipmapLinearFilter;
    return t;
  }

  /* ---------- zona ---------- */
  var BLANCO;

  function Zona(id, color, prioridad) {
    this.id = id;
    this.color = new T.Color(color);
    this.prioridad = prioridad || 1;
    this.grupo = new T.Group();
    this.grupo.name = id;
    this.geo = {};
    this.lin = [];
    this.linTenue = [];
    this.toques = [];
    this.centro = new T.Vector3();
    this.etiqueta = new T.Vector3();
    this.tam = 10;
    this.alto = 4;
    this.bajoSamanes = false;
    var c = this.color;
    this.mats = {
      base: new T.MeshLambertMaterial({ color: new T.Color(0x150B2A).lerp(c, 0.12) }),
      alto: new T.MeshLambertMaterial({ color: new T.Color(0x24163F).lerp(c, 0.34) }),
      blanco: new T.MeshLambertMaterial({ color: 0xCFC6E6 }),
      oscuro: new T.MeshLambertMaterial({ color: 0x0B0616 }),
      acero: new T.MeshLambertMaterial({ color: 0x3A2F55 }),
      vidrio: new T.MeshLambertMaterial({ color: c, transparent: true, opacity: 0.1, depthWrite: false, side: T.DoubleSide }),
      lona: new T.MeshLambertMaterial({ color: 0xEDE6FA, transparent: true, opacity: 0.16, depthWrite: false, side: T.DoubleSide }),
      neon: new T.MeshBasicMaterial({ color: c }),
      cesped: new T.MeshLambertMaterial({ color: 0x0F4A35 }),
      pantalla: null
    };
    this.matLinea = new T.LineBasicMaterial({ color: c.clone(), transparent: true, opacity: 0.9 });
    this.matLineaTenue = new T.LineBasicMaterial({ color: c.clone(), transparent: true, opacity: 0.35 });
    this.matBrillo = null;
  }

  Zona.prototype.caja = function (mat, x0, x1, y0, y1, z0, z1, borde) {
    (this.geo[mat] || (this.geo[mat] = [])).push(caja(x0, x1, y0, y1, z0, z1));
    if (borde === 'no') return;
    aristasCaja(borde === 'tenue' ? this.linTenue : this.lin, x0, x1, y0, y1, z0, z1);
  };

  Zona.prototype.forma = function (mat, g) {
    (this.geo[mat] || (this.geo[mat] = [])).push(g);
  };

  Zona.prototype.trazo = function (tenue, puntos) {
    var a = tenue ? this.linTenue : this.lin;
    for (var i = 0; i < puntos.length; i++) a.push(puntos[i]);
  };

  Zona.prototype.area = function (x0, x1, y1, z0, z1, ex, ey, ez) {
    var m = new T.Mesh(caja(x0, x1, 0, y1, z0, z1), Zona.matToque);
    m.visible = false;
    m.userData.zona = this;
    this.toques.push(m);
    this.grupo.add(m);
    if (this.toques.length === 1) {
      this.centro.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
      this.tam = Math.max(x1 - x0, z1 - z0);
      this.alto = y1;
      this.huella = [x0, x1, z0, z1];
      this.etiqueta.set(ex !== undefined ? ex : this.centro.x, ey !== undefined ? ey : y1 + 3, ez !== undefined ? ez : this.centro.z);
    }
  };

  Zona.prototype.terminar = function (escena, texBrillo, texHaz) {
    for (var k in this.geo) {
      if (!this.geo.hasOwnProperty(k)) continue;
      var malla = new T.Mesh(fusionar(this.geo[k]), this.mats[k]);
      if (k === 'vidrio' || k === 'lona') malla.renderOrder = 2;
      this.grupo.add(malla);
    }
    if (this.lin.length) {
      var g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(this.lin, 3));
      this.grupo.add(new T.LineSegments(g, this.matLinea));
    }
    if (this.linTenue.length) {
      var g2 = new T.BufferGeometry();
      g2.setAttribute('position', new T.Float32BufferAttribute(this.linTenue, 3));
      this.grupo.add(new T.LineSegments(g2, this.matLineaTenue));
    }
    var h = this.huella;
    this.matBrillo = new T.MeshBasicMaterial({
      map: texBrillo, color: this.color, transparent: true, opacity: 0.3,
      blending: T.AdditiveBlending, depthWrite: false
    });
    var placa = new T.Mesh(new T.PlaneGeometry((h[1] - h[0]) * 1.5 + 12, (h[3] - h[2]) * 1.5 + 12), this.matBrillo);
    placa.rotation.x = -Math.PI / 2;
    placa.position.set(this.centro.x, 0.06, this.centro.z);
    placa.renderOrder = 1;
    escena.add(placa);
    // haz de luz que se enciende cuando hay algo en vivo en la zona
    if (texHaz) {
      var gh = new T.CylinderGeometry(0.9, 2.4, 34, 18, 1, true);
      gh.translate(0, 17, 0);
      this.haz = new T.Mesh(gh, new T.MeshBasicMaterial({
        map: texHaz, color: this.color, transparent: true, opacity: 0.5,
        blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
      }));
      this.haz.position.set(this.centro.x, this.alto * 0.5, this.centro.z);
      this.haz.renderOrder = 5;
      this.haz.visible = false;
      escena.add(this.haz);
    }
    escena.add(this.grupo);
  };

  var ESTADOS = {
    normal: [0.9, 0.35, 0.3, 0.1],
    activo: [1, 0.65, 0.8, 0.2],
    tenue:  [0.22, 0.1, 0.06, 0.05],
    fuera:  [0.1, 0.04, 0, 0.03]
  };

  Zona.prototype.estado = function (e) {
    var v = ESTADOS[e] || ESTADOS.normal;
    this.matLinea.opacity = v[0];
    this.matLineaTenue.opacity = v[1];
    this.matBrillo.opacity = v[2];
    this.mats.vidrio.opacity = v[3];
    this.matLinea.color.copy(this.color);
    if (e === 'activo') this.matLinea.color.lerp(BLANCO, 0.4);
    this.estadoActual = e;
  };

  /* ---------- arboles ---------- */
  function Bosque() { this.copas = []; this.troncos = []; this.samanes = []; }
  Bosque.prototype.arbol = function (x, z, r, h) {
    this.troncos.push({ p: [x, h * 0.3, z], s: [0.35 + r * 0.06, h * 0.6, 0.35 + r * 0.06] });
    this.copas.push({ p: [x, h * 0.68, z], s: [r, r * 0.9, r] });
  };
  Bosque.prototype.saman = function (x, z) {
    this.troncos.push({ p: [x, 3.5, z], s: [1.1, 7, 1.1] });
    for (var i = 0; i < 4; i++) {
      var a = i * Math.PI / 2 + 0.6;
      this.troncos.push({ p: [x + Math.cos(a) * 2.3, 7.6, z + Math.sin(a) * 2.3], s: [0.55, 5, 0.55], giro: a });
    }
    this.samanes.push({ p: [x, 10.6, z], s: [12.5, 2.6, 12.5] });
    this.samanes.push({ p: [x + 5.5, 10, z + 3], s: [7.5, 2.2, 7] });
    this.samanes.push({ p: [x - 5, 10.2, z - 2.5], s: [7.5, 2.4, 7.5] });
  };
  Bosque.prototype.terminar = function (escena, ligero) {
    var d = new T.Object3D(), i;
    function llenar(malla, lista) {
      for (i = 0; i < lista.length; i++) {
        var it = lista[i];
        d.position.set(it.p[0], it.p[1], it.p[2]);
        d.rotation.set(0, 0, 0);
        if (it.giro !== undefined) { d.rotateY(-it.giro); d.rotateZ(-0.62); }
        d.scale.set(it.s[0], it.s[1], it.s[2]);
        d.updateMatrix();
        malla.setMatrixAt(i, d.matrix);
      }
      malla.instanceMatrix.needsUpdate = true;
      escena.add(malla);
    }
    var detalle = ligero ? 0 : 1;
    var troncos = new T.InstancedMesh(new T.CylinderGeometry(0.7, 1, 1, 6), new T.MeshLambertMaterial({ color: 0x2A1D2E }), this.troncos.length);
    llenar(troncos, this.troncos);
    var copas = new T.InstancedMesh(new T.IcosahedronGeometry(1, detalle), new T.MeshLambertMaterial({ color: 0x12402F, emissive: 0x03140D, flatShading: true }), this.copas.length);
    llenar(copas, this.copas);
    this.matSaman = new T.MeshLambertMaterial({ color: 0x15503A, emissive: 0x04170F, flatShading: true, transparent: true, opacity: 0.62, depthWrite: false });
    var samanes = new T.InstancedMesh(new T.IcosahedronGeometry(1, detalle), this.matSaman, this.samanes.length);
    samanes.renderOrder = 3;
    llenar(samanes, this.samanes);
  };

  /* ---------- sillas ---------- */
  function sillas(zona, filas) {
    var lista = [], i, f, cx, cz;
    for (f = 0; f < filas.length; f++) {
      var b = filas[f];  // [x0, x1, z0, z1, paso]
      var paso = b[4] || 1.15;
      for (cx = b[0]; cx <= b[1] + 0.01; cx += paso) {
        for (cz = b[2]; cz <= b[3] + 0.01; cz += paso) lista.push([cx, cz]);
      }
    }
    var malla = new T.InstancedMesh(new T.BoxGeometry(0.55, 0.5, 0.55), new T.MeshLambertMaterial({ color: 0xD8D0EC }), lista.length);
    var d = new T.Object3D();
    for (i = 0; i < lista.length; i++) {
      d.position.set(lista[i][0], 0.65, lista[i][1]);
      d.updateMatrix();
      malla.setMatrixAt(i, d.matrix);
    }
    malla.instanceMatrix.needsUpdate = true;
    zona.grupo.add(malla);
  }

  /* ---------- faroles a lo largo de los caminos (x, z) ---------- */
  var FAROLES = (function () {
    var f = [], v;
    for (v = -50; v <= -20; v += 7.5) f.push([v, -10], [v + 3.7, -4]);    // recorrido de ingreso
    for (v = 0; v <= 18; v += 6) f.push([v, -10], [v + 3, -4]);           // hacia la plaza
    for (v = -26; v <= 6; v += 8) f.push([18.6, v]);                      // vía entre P2 y Gastrolabs
    for (v = 26; v <= 70; v += 8.8) f.push([v, -34.5], [v + 4.4, 9.5]);   // bordes de la plaza
    for (v = -28; v <= 4; v += 8) f.push([77.5, v]);                      // vía oriental
    f.push([-26, -30], [-12, -30], [10, -30], [-31.5, -38]);             // paso norte y Baños 1
    f.push([-57, 2], [-57, 14], [-53, 28], [-49.5, 40]);                  // vía occidental / parqueo
    f.push([10, 14], [7, 26], [5.5, 38]);                                 // curva sur
    return f;
  })();

  function puntosLuz(destino, arr, color, tam, mapa) {
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(arr, 3));
    var p = new T.Points(g, new T.PointsMaterial({ color: color, size: tam, map: mapa, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    p.renderOrder = 6;
    destino.add(p);
    return p;
  }

  function azar(semilla) {
    var s = semilla;
    return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }

  var PALETA_GENTE = null;
  function gentecita(destino, lista) {
    if (!lista.length) return;
    if (!PALETA_GENTE) PALETA_GENTE = [0xE8E2F2, 0xC9B6E8, 0x9B87C4, 0x6B5A96, 0xE7C98A, 0x7FB3D1, 0xE3A6C2, 0x9AD3C4, 0xF2EEE6].map(function (c) { return new T.Color(c); });
    var cuerpo = new T.CylinderGeometry(0.2, 0.25, 1.15, 6); cuerpo.translate(0, 0.575, 0);
    var cabeza = new T.SphereGeometry(0.16, 6, 5); cabeza.translate(0, 1.33, 0);
    var m = new T.InstancedMesh(fusionar([cuerpo, cabeza]), new T.MeshLambertMaterial({ color: 0xffffff }), lista.length);
    var d = new T.Object3D();
    for (var i = 0; i < lista.length; i++) {
      d.position.set(lista[i][0], lista[i][2] || 0, lista[i][1]);
      d.scale.set(1, lista[i][3] || 1, 1);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
      m.setColorAt(i, PALETA_GENTE[i % PALETA_GENTE.length]);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    destino.add(m);
  }

  /* ---------- red de caminos para «Cómo llegar» ----------
     Nodos (x, z) sobre los caminos y uniones entre ellos. Cada zona tiene un nodo de llegada. */
  var RED = {
    nodos: {
      calle: [-63, -7], taq: [-50, -7], c1: [-45, -7], c23: [-28, -7], c3: [-22, -7],
      cowO: [-16.6, -7], cow: [-9.4, -7], cowE: [-2.2, -7], cowN: [-9.4, -14], e1: [8, -7], e2: [20.8, -7],
      labs: [-28, -15.4], p1: [-0.5, -19.6], pp: [5.3, -19.6], p2: [11, -19.6], n5: [20.8, -19.6],
      st: [5.3, -27.8], kits: [5.3, -48.6], w0: [-5, -27.6], w1: [-29.5, -27.6], b1: [-28.4, -42],
      gasW: [24, -7], gas: [44, -12], r1: [20.8, 5], vip: [23.4, 6.6], caja: [30, 6.6], dia: [40, 6.6],
      bs: [56, 9.5], b2: [62.5, 10], pq1: [-58.5, 4], pq: [-40, 12], veh: [-46, 40]
    },
    aristas: [
      ['calle', 'taq'], ['taq', 'c1'], ['c1', 'c23'], ['c23', 'c3'], ['c23', 'labs'], ['c3', 'cowO'], ['cowO', 'cow'],
      ['cow', 'cowE'], ['cowE', 'e1'], ['e1', 'e2'], ['cow', 'cowN'], ['cowN', 'p1'], ['p1', 'pp'], ['pp', 'p2'],
      ['p2', 'n5'], ['n5', 'e2'], ['pp', 'st'], ['st', 'kits'], ['st', 'w0'], ['w0', 'w1'], ['w1', 'b1'],
      ['e2', 'gasW'], ['gasW', 'gas'], ['e2', 'r1'], ['r1', 'vip'], ['vip', 'caja'], ['caja', 'dia'], ['gas', 'dia'],
      ['dia', 'bs'], ['bs', 'b2'], ['calle', 'pq1'], ['pq1', 'pq'], ['pq', 'veh']
    ],
    destino: {
      taquillas: 'taq', workshops: 'labs', cowork: 'cow', speakers: 'p1', bebidas: 'p2', expositores: 'st',
      kits: 'kits', gastrolabs: 'gas', auditorio: 'caja', banos: 'b1', banos2: 'b2', parqueo: 'pq'
    },
    inicio: 'calle'
  };

  /* ======================================================================
     CONSTRUCCIÓN
     ====================================================================== */
  function construir(THREE, opciones) {
    T = THREE;
    BLANCO = new T.Color(0xffffff);
    Zona.matToque = new T.MeshBasicMaterial();
    var ligero = !!(opciones && opciones.ligero);
    var calidad = (opciones && opciones.calidad) || (ligero ? 'baja' : 'media');
    var colores = (opciones && opciones.colores) || {};
    function col(tipo, def) { return colores[tipo] || def; }
    var C = {
      charlas: col('charlas', '#A855F7'), marcas: col('marcas', '#E879F9'), experiencias: col('experiencias', '#22D3EE'),
      comida: col('comida', '#F59E0B'), servicios: col('servicios', '#C9AEFF')
    };

    var escena = new T.Scene();
    escena.background = new T.Color(0x05070F);
    escena.add(new T.HemisphereLight(0xB9B6FF, 0x0C0A26, 0.95));
    var sol = new T.DirectionalLight(0xFFFFFF, 0.55);
    sol.position.set(60, 120, 40);
    escena.add(sol);

    var texBrillo = texturaBrillo();
    var texHaz = (function () {
      var c = document.createElement('canvas'); c.width = 4; c.height = 128;
      var x = c.getContext('2d');
      var g = x.createLinearGradient(0, 128, 0, 0);
      g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.35, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 4, 128);
      return new T.CanvasTexture(c);
    })();
    var matPantalla = new T.MeshBasicMaterial({ map: texturaPantalla() });
    var zonas = {};
    var bosque = new Bosque();
    var z, i, x, v;

    function postes(zona, lista, alto) {
      for (var k = 0; k < lista.length; k++) zona.caja('acero', lista[k][0] - 0.18, lista[k][0] + 0.18, 0, alto, lista[k][1] - 0.18, lista[k][1] + 0.18, 'no');
    }
    function mesaRedonda(zona, cx, cz, r, sillasN) {
      var m = new T.CylinderGeometry(r, r, 0.12, 14); m.translate(cx, 0.85, cz); zona.forma('blanco', m);
      var pata = new T.CylinderGeometry(0.08, 0.08, 0.8, 6); pata.translate(cx, 0.42, cz); zona.forma('acero', pata);
      for (var k = 0; k < sillasN; k++) {
        var a = k / sillasN * Math.PI * 2;
        zona.caja('alto', cx + Math.cos(a) * (r + 0.55) - 0.25, cx + Math.cos(a) * (r + 0.55) + 0.25, 0, 0.55, cz + Math.sin(a) * (r + 0.55) - 0.25, cz + Math.sin(a) * (r + 0.55) + 0.25, 'no');
      }
    }

    /* ---- Caja de Arena · escenario principal ---- */
    z = zonas.auditorio = new Zona('auditorio', C.charlas, 2);
    var cx0 = 21.8, cx1 = 55.3, cz0 = 13, cz1 = 42.9, hM = 9.5, hC = 15;
    z.caja('base', cx0, cx1, 0, 0.4, cz0, cz1, 'tenue');
    z.caja('alto', cx0, cx1, 0.4, 2.2, cz0, cz0 + 0.5, 'tenue');          // zócalo norte (con accesos)
    z.caja('alto', cx0, cx1, 0.4, 2.2, cz1 - 0.5, cz1, 'tenue');
    z.caja('alto', cx0, cx0 + 0.5, 0.4, 2.2, cz0, cz1, 'tenue');
    z.caja('alto', cx1 - 0.5, cx1, 0.4, 2.2, cz0, cz1, 'tenue');
    z.forma('vidrio', caja(cx0, cx1, 2.2, hM, cz0, cz0 + 0.1));
    z.forma('vidrio', caja(cx0, cx1, 2.2, hM, cz1 - 0.1, cz1));
    z.forma('vidrio', caja(cx0, cx0 + 0.1, 2.2, hM, cz0, cz1));
    z.forma('vidrio', caja(cx1 - 0.1, cx1, 2.2, hM, cz0, cz1));
    aristasCaja(z.lin, cx0, cx1, 0.4, hM, cz0, cz1);
    // techo a cuatro aguas (la «X» del plano)
    var r0 = [31, hC, 27.95], r1 = [46.1, hC, 27.95];
    var e00 = [cx0, hM, cz0], e10 = [cx1, hM, cz0], e11 = [cx1, hM, cz1], e01 = [cx0, hM, cz1];
    z.forma('vidrio', cuadro(e00, e10, r1, r0));
    z.forma('vidrio', cuadro(e01, r0, r1, e11));
    z.forma('vidrio', cuadro(e00, r0, r0, e01));
    z.forma('vidrio', cuadro(e10, e11, r1, r1));
    z.trazo(false, [].concat(e00, r0, e10, r1, e11, r1, e01, r0, r0, r1));
    for (v = cx0 + 4.2; v < cx1 - 1; v += 4.2) z.trazo(true, [v, hM, cz0, v, 0.4, cz0, v, hM, cz1, v, 0.4, cz1]);
    // escenario al sur con pantalla gigante y pantallas laterales
    z.caja('alto', 30, 47, 0.4, 1.8, 36.5, 41.6);
    z.caja('neon', 29.95, 47.05, 1.8, 1.95, 36.45, 36.6, 'no');
    var pg = new T.Mesh(new T.PlaneGeometry(13, 5.4), matPantalla); pg.position.set(38.5, 5.6, 41.7); pg.rotation.y = Math.PI; z.grupo.add(pg);
    var pl = new T.Mesh(new T.PlaneGeometry(4.6, 2.6), matPantalla); pl.position.set(26.5, 4.8, 40.5); pl.rotation.y = Math.PI * 0.86; z.grupo.add(pl);
    var pr = new T.Mesh(new T.PlaneGeometry(4.6, 2.6), matPantalla); pr.position.set(50.5, 4.8, 40.5); pr.rotation.y = -Math.PI * 0.86; z.grupo.add(pr);
    postes(z, [[29.6, 36.5], [47.4, 36.5], [29.6, 41.6], [47.4, 41.6]], 9);
    z.trazo(false, [29.6, 9, 36.5, 47.4, 9, 36.5, 29.6, 9, 41.6, 47.4, 9, 41.6]);
    sillas(z, [[25, 52, 16.5, 33, 1.3]]);
    // hall de Ingreso VIP y General + portal Diamante y Black
    z.caja('alto', 23.4, 36.4, 0, 3.2, 7.8, 12.4);
    z.caja('neon', 23.4, 36.4, 3.2, 3.36, 7.75, 7.9, 'no');
    for (v = 24.6; v < 35.5; v += 2.2) z.caja('neon', v, v + 1.1, 1, 2.3, 7.72, 7.8, 'no');
    z.caja('oscuro', 38, 38.7, 0, 4.2, 8, 12.6, 'tenue');
    z.caja('oscuro', 41.3, 42, 0, 4.2, 8, 12.6, 'tenue');
    z.caja('oscuro', 38, 42, 4.2, 5, 8, 12.6, 'tenue');
    z.caja('neon', 38.7, 41.3, 4.05, 4.2, 7.95, 8.05, 'no');
    z.area(cx0, cx1, hC, 7.6, cz1, 38.5, 17, 30);

    /* ---- Zona Gastrolabs · plaza de comida ---- */
    z = zonas.gastrolabs = new Zona('gastrolabs', C.comida, 1);
    z.caja('base', 22.8, 73.5, 0, 0.15, -31.9, 7.2, 'tenue');
    var puestos = [[33, 37, -29, -26.6], [35.4, 39.6, -25.6, -23.4], [25.8, 28.4, -21.5, -17], [29, 31.8, -19.2, -15],
                   [54, 56.6, -24.2, -21], [57.2, 60, -26.6, -22.6], [65, 67.6, -19.2, -15], [68.1, 70.6, -21.6, -17],
                   [47.4, 50, -11, -6.6], [50.3, 52.8, -13, -9]];
    for (i = 0; i < puestos.length; i++) {
      var q = puestos[i];
      z.caja('alto', q[0], q[1], 0.15, 2.7, q[2], q[3], 'tenue');
      z.caja('neon', q[0] - 0.15, q[1] + 0.15, 2.7, 2.95, q[2] - 0.15, q[3] + 0.15, 'no');
      z.caja('blanco', q[0], q[1], 0.15, 1.1, q[3], q[3] + 0.5, 'no');   // mostrador
    }
    var mesas = [[34, -6], [39, -2], [44, 2], [36, 2.5], [56, -3], [61, 1.5], [66, -4], [60, -12], [40, -14], [62, -28], [46, -27], [70, 3]];
    for (i = 0; i < mesas.length; i++) {
      mesaRedonda(z, mesas[i][0], mesas[i][1], 0.75, 4);
      var som = new T.ConeGeometry(1.8, 0.7, 8); som.translate(mesas[i][0], 2.6, mesas[i][1]); z.forma('lona', som);
      var palo = new T.CylinderGeometry(0.05, 0.05, 2.4, 5); palo.translate(mesas[i][0], 1.3, mesas[i][1]); z.forma('acero', palo);
    }
    // portal de ingreso a la plaza (barra rosada del plano)
    z.caja('oscuro', 22.6, 23.4, 0, 3.6, -10.2, -9.4, 'tenue');
    z.caja('oscuro', 22.6, 23.4, 0, 3.6, -4.6, -3.8, 'tenue');
    z.caja('neon', 22.6, 23.4, 3.6, 3.9, -10.2, -3.8, 'no');
    z.area(22.8, 73.5, 4, -31.9, 7.2, 47, 7, -21);

    /* ---- Zona de stands (pabellón norte) ---- */
    z = zonas.expositores = new Zona('expositores', C.marcas, 2);
    var sx0 = -1.3, sx1 = 12, sz0 = -49.7, sz1 = -28, hs = 5, cum = 7.2, mx = (sx0 + sx1) / 2;
    z.caja('base', sx0, sx1, 0, 0.3, sz0, sz1, 'tenue');
    z.forma('vidrio', caja(sx0, sx0 + 0.1, 0.3, hs, sz0, sz1));
    z.forma('vidrio', caja(sx1 - 0.1, sx1, 0.3, hs, sz0, sz1));
    z.forma('vidrio', caja(sx0, sx1, 0.3, hs, sz1 - 0.1, sz1));
    z.forma('vidrio', cuadro([sx0, hs, sz0], [mx, cum, sz0], [mx, cum, sz1], [sx0, hs, sz1]));
    z.forma('vidrio', cuadro([mx, cum, sz0], [sx1, hs, sz0], [sx1, hs, sz1], [mx, cum, sz1]));
    aristasCaja(z.lin, sx0, sx1, 0.3, hs, sz0, sz1);
    for (v = sz0; v <= sz1 + 0.01; v += 3.6) z.trazo(Math.abs(v - sz0) > 0.1 && Math.abs(v - sz1) > 0.1, [sx0, hs, v, mx, cum, v, mx, cum, v, sx1, hs, v]);
    z.trazo(false, [mx, cum, sz0, mx, cum, sz1]);
    for (v = sz0 + 0.6; v < sz1 - 3; v += 3.5) {
      z.caja('blanco', sx0 + 0.4, sx0 + 2.8, 0.3, 2.6, v, v + 3, 'tenue');
      z.caja('neon', sx0 + 2.75, sx0 + 2.9, 2.5, 2.7, v, v + 3, 'no');
      z.caja('blanco', sx1 - 2.8, sx1 - 0.4, 0.3, 2.6, v, v + 3, 'tenue');
      z.caja('neon', sx1 - 2.9, sx1 - 2.75, 2.5, 2.7, v, v + 3, 'no');
    }
    z.caja('neon', sx0 + 2, sx1 - 2, hs - 0.6, hs - 0.3, sz1 - 0.05, sz1 + 0.05, 'no');   // letrero de entrada
    z.area(sx0, sx1, cum, sz0, sz1, mx, 10.5, -38);

    /* ---- Entrega de kits (cabecera norte del pabellón) ---- */
    z = zonas.kits = new Zona('kits', C.servicios, 3);
    z.caja('base', -1.3, 12, 0, 0.3, -56.2, -49.7, 'tenue');
    z.caja('alto', -1.3, 12, 0.3, 4.2, -56.2, -55.6, 'tenue');
    z.caja('alto', -1.3, -0.8, 0.3, 4.2, -56.2, -49.7, 'tenue');
    z.caja('alto', 11.5, 12, 0.3, 4.2, -56.2, -49.7, 'tenue');
    z.caja('base', -1.3, 12, 4.2, 4.6, -56.2, -49.7);
    z.caja('neon', -1.3, 12, 4.6, 4.75, -49.75, -49.6, 'no');
    z.caja('blanco', 0.6, 10.2, 0.3, 1.15, -52.4, -51.6);               // mostrador
    for (v = 0.4; v < 10.4; v += 1.15) {
      for (var nivel = 0; nivel < 3; nivel++) z.caja(nivel === 1 ? 'neon' : 'blanco', v, v + 0.9, 0.5 + nivel * 0.8, 1.15 + nivel * 0.8, -55.4, -54.5, 'no');
    }
    z.area(-1.3, 12, 4.75, -56.2, -49.7, 5.3, 8.2, -53);

    /* ---- Labs Session ---- */
    z = zonas.workshops = new Zona('workshops', C.charlas, 2);
    var lx0 = -42.6, lx1 = -14.3, lz0 = -25.1, lz1 = -16.3, hl = 4.6;
    z.caja('base', lx0, lx1, 0, 0.3, lz0, lz1, 'tenue');
    z.forma('vidrio', caja(lx0, lx1, 0.3, hl, lz0, lz0 + 0.1));
    z.forma('vidrio', caja(lx0, lx0 + 0.1, 0.3, hl, lz0, lz1));
    z.forma('vidrio', caja(lx1 - 0.1, lx1, 0.3, hl, lz0, lz1));
    z.forma('vidrio', caja(lx0, -31, 0.3, hl, lz1 - 0.1, lz1));
    z.forma('vidrio', caja(-25, lx1, 0.3, hl, lz1 - 0.1, lz1));
    z.caja('base', lx0 - 0.4, lx1 + 0.4, hl, hl + 0.35, lz0 - 0.4, lz1 + 0.4);
    z.caja('neon', lx0 - 0.4, lx1 + 0.4, hl + 0.35, hl + 0.5, lz1 + 0.35, lz1 + 0.45, 'no');
    aristasCaja(z.lin, lx0, lx1, 0.3, hl, lz0, lz1);
    z.caja('alto', lx0 + 0.3, lx0 + 4, 0.3, 1, lz0 + 1, lz1 - 1);         // tarima
    var pw = new T.Mesh(new T.PlaneGeometry(6.4, 3.2), matPantalla); pw.position.set(lx0 + 0.25, 2.9, (lz0 + lz1) / 2); pw.rotation.y = Math.PI / 2; z.grupo.add(pw);
    sillas(z, [[-36, -17.2, -23.6, -17.6, 1.2]]);
    z.area(lx0 - 0.4, lx1 + 0.4, hl + 0.5, lz0 - 0.4, lz1 + 0.4, -28.5, 8.5, -20.7);

    /* ---- Zona Cowork (círculo central del recorrido) ---- */
    z = zonas.cowork = new Zona('cowork', C.experiencias, 3);
    var ccx = -9.4, ccz = -7, cr = 7.2;
    var disco = new T.CylinderGeometry(cr, cr, 0.3, 40); disco.translate(ccx, 0.15, ccz); z.forma('base', disco);
    var aro = new T.TorusGeometry(cr, 0.12, 4, 48); aro.rotateX(Math.PI / 2); aro.translate(ccx, 0.32, ccz); z.forma('neon', aro);
    var muro = new T.CylinderGeometry(cr - 0.2, cr - 0.2, 2.6, 40, 1, true); muro.translate(ccx, 1.6, ccz); z.forma('vidrio', muro);
    var anilloT = new T.TorusGeometry(cr - 0.2, 0.08, 4, 48); anilloT.rotateX(Math.PI / 2); anilloT.translate(ccx, 2.9, ccz); z.forma('neon', anilloT);
    for (i = 0; i < 12; i++) {
      var an = i / 12 * Math.PI * 2;
      z.trazo(true, [ccx + Math.cos(an) * (cr - 0.2), 2.9, ccz + Math.sin(an) * (cr - 0.2), ccx, 5.2, ccz]);
    }
    var jard = new T.CylinderGeometry(1.4, 1.5, 0.6, 18); jard.translate(ccx, 0.6, ccz); z.forma('cesped', jard);
    var tablas = [[-3.6, -2.4], [3.6, -2.4], [-3.6, 2.6], [3.6, 2.6]];
    for (i = 0; i < tablas.length; i++) mesaRedonda(z, ccx + tablas[i][0], ccz + tablas[i][1], 0.8, 4);
    z.area(ccx - cr, ccx + cr, 5.2, ccz - cr, ccz + cr, ccx, 8.4, ccz);

    /* ---- P1 · Zona speakers ---- */
    z = zonas.speakers = new Zona('speakers', C.experiencias, 3);
    z.caja('base', -5.9, 5.2, 0, 0.3, -25.1, -20.5, 'tenue');
    z.caja('lona', -6.1, 5.2, 3.1, 3.25, -25.3, -20.3, 'tenue');
    postes(z, [[-5.7, -24.9], [5, -24.9], [-5.7, -20.7], [5, -20.7]], 3.1);
    z.caja('oscuro', -5.9, 5.2, 0.3, 3.1, -25.1, -24.8, 'tenue');       // fondo con nombre
    z.caja('neon', -4, 3.3, 2.2, 2.5, -24.8, -24.72, 'no');
    var sofaP = [[-3.6, -22.8], [0.4, -22.8], [3.2, -21.5]];
    for (i = 0; i < sofaP.length; i++) z.caja('blanco', sofaP[i][0] - 1.2, sofaP[i][0] + 1.2, 0.3, 1, sofaP[i][1] - 0.5, sofaP[i][1] + 0.5, 'no');
    z.area(-6.1, 5.2, 3.3, -25.3, -20.3, -0.4, 6.2, -22.8);

    /* ---- P2 · Zona de bebidas ---- */
    z = zonas.bebidas = new Zona('bebidas', C.comida, 3);
    z.caja('base', 5.2, 17.6, 0, 0.3, -25.1, -20.5, 'tenue');
    z.caja('lona', 5.2, 17.8, 3.1, 3.25, -25.3, -20.3, 'tenue');
    postes(z, [[5.4, -24.9], [17.4, -24.9], [5.4, -20.7], [17.4, -20.7]], 3.1);
    z.caja('alto', 7, 16, 0.3, 1.15, -22.6, -21.9);                    // barra
    z.caja('neon', 7, 16, 1.15, 1.25, -22.6, -21.9, 'no');
    z.caja('oscuro', 7, 16, 0.3, 2.4, -24.9, -24.4, 'tenue');            // contrabarra
    for (v = 7.4; v < 15.8; v += 1.05) z.caja('neon', v, v + 0.5, 1.6, 2.1, -24.42, -24.36, 'no');
    for (v = 7.6; v < 15.8; v += 1.6) { var bt = new T.CylinderGeometry(0.25, 0.25, 0.75, 8); bt.translate(v, 0.68, -21.2); z.forma('blanco', bt); }
    z.area(5.2, 17.8, 3.3, -25.3, -20.3, 11.4, 6.2, -22.8);

    /* ---- Taquilla e ingreso + filtros del recorrido ---- */
    z = zonas.taquillas = new Zona('taquillas', C.servicios, 2);
    z.caja('alto', -58.5, -51, 0, 3.2, -11.5, -2.5);
    z.caja('base', -59.2, -50.3, 3.2, 3.6, -12.2, -1.8);
    z.caja('neon', -50.4, -50.25, 2.6, 3.0, -11, -3, 'no');
    for (v = -10.6; v < -3; v += 1.9) z.caja('neon', -50.98, -50.92, 1.1, 2.3, v, v + 1.2, 'no');   // ventanillas
    z.caja('blanco', -50.9, -50.1, 0, 1.1, -11, -3, 'no');
    var filtros = [-45.2, -34.2, -23.7];
    for (i = 0; i < filtros.length; i++) {
      var fx = filtros[i];
      z.caja('oscuro', fx - 0.4, fx + 0.4, 0, 3.4, -9.8, -9.1, 'tenue');
      z.caja('oscuro', fx - 0.4, fx + 0.4, 0, 3.4, -4.9, -4.2, 'tenue');
      z.caja('oscuro', fx - 0.4, fx + 0.4, 3.4, 4.1, -9.8, -4.2, 'tenue');
      z.caja('neon', fx + 0.4, fx + 0.48, 3.45, 4.05, -9.1, -4.9, 'no');
      z.caja('acero', fx - 0.15, fx + 0.15, 0, 1, -8.6, -5.4, 'no');     // torniquete
    }
    z.area(-59.2, -50.3, 3.6, -12.2, -1.8, -54.8, 7, -7);
    // los filtros también responden al toque
    z.area(-46, -23, 4.1, -10, -4);

    /* ---- Baños ---- */
    z = zonas.banos = new Zona('banos', C.servicios, 2);
    z.caja('base', -31, -24.4, 0, 3, -47.2, -42.8);
    z.caja('neon', -30.4, -25, 2.2, 2.4, -42.85, -42.75, 'no');
    z.area(-31, -24.4, 3, -47.2, -42.8, -27.7, 5.6, -45);

    z = zonas.banos2 = new Zona('banos2', C.servicios, 2);
    z.caja('base', 57.9, 70.6, 0, 3, 11, 17.6);
    z.caja('neon', 58.5, 70, 2.2, 2.4, 10.9, 11, 'no');
    z.area(57.9, 70.6, 3, 11, 17.6, 64.2, 5.6, 14.3);

    /* ---- Zona de parqueo + ingreso vehicular ---- */
    z = zonas.parqueo = new Zona('parqueo', C.servicios, 1);
    z.caja('base', -54.6, -25.4, 0, 0.08, -4.6, 38.4, 'tenue');
    var carros = [], rr = azar(5);
    var filasC = [[-52.2, -49.4], [-45, -42.2], [-38.4, -35.6], [-30.8, -28]];
    for (var fc = 0; fc < filasC.length; fc++) {
      for (v = -1; v < 36; v += 2.6) if (rr() < 0.62) carros.push([(filasC[fc][0] + filasC[fc][1]) / 2, v + 1.3]);
    }
    var mCarro = new T.InstancedMesh(fusionar([caja(-1.1, 1.1, 0, 0.75, -0.95, 0.95), caja(-0.75, 0.75, 0.75, 1.3, -0.8, 0.8)]), new T.MeshLambertMaterial({ color: 0xffffff }), carros.length);
    var dC = new T.Object3D(), tonos = [0x9AA4C8, 0x2B3352, 0xD8DCEB, 0x6B2A7E, 0x3A4F8C, 0x8C2F3A].map(function (h) { return new T.Color(h); });
    for (i = 0; i < carros.length; i++) {
      dC.position.set(carros[i][0], 0.08, carros[i][1]); dC.rotation.y = Math.PI / 2; dC.updateMatrix();
      mCarro.setMatrixAt(i, dC.matrix); mCarro.setColorAt(i, tonos[i % tonos.length]);
    }
    mCarro.instanceMatrix.needsUpdate = true; if (mCarro.instanceColor) mCarro.instanceColor.needsUpdate = true;
    z.grupo.add(mCarro);
    z.caja('acero', -47.6, -47.2, 0, 1.4, 40.6, 41, 'no');               // talanquera del ingreso vehicular
    z.caja('neon', -47.2, -42.4, 1.05, 1.2, 40.72, 40.88, 'no');
    z.caja('alto', -50.5, -48.4, 0, 2.6, 39.4, 42, 'tenue');             // caseta
    z.area(-54.6, -25.4, 1.5, -4.6, 38.4, -40, 4.5, 15);

    /* ---- terminar zonas ---- */
    for (var id in zonas) if (zonas.hasOwnProperty(id)) zonas[id].terminar(escena, texBrillo, texHaz);

    /* ---- edificios existentes del recinto (sin interacción, como en el plano) ---- */
    var matEd = new T.MeshLambertMaterial({ color: 0x141A3A });
    var matEdAlto = new T.MeshLambertMaterial({ color: 0x1B2350 });
    var edGeo = [], edGeo2 = [], edLin = [];
    function edificio(x0, x1, z0, z1, h, destacado) {
      (destacado ? edGeo2 : edGeo).push(caja(x0, x1, 0, h, z0, z1));
      aristasCaja(edLin, x0, x1, 0, h, z0, z1);
    }
    edificio(-27.7, -9.1, -37.7, -29.2, 3.4);              // pabellón de puestos (al norte de Labs Session)
    edificio(13.6, 18.9, -42.9, -35.8, 4);
    edificio(-25.4, -18.5, 4, 38.4, 5);                    // edificio en L
    edificio(-18.5, -8, 28.2, 38.4, 5);
    edificio(-15.5, -11, 12, 21, 3);
    edificio(-6, 0.5, 1.5, 6, 3, false);
    edificio(-1, 5.5, 8.5, 13, 3);
    edificio(-5.9, 2, 22.8, 27.3, 3.5);
    edificio(54, 69, 35.8, 42.3, 4);
    edificio(-5.9, -2.4, -47, -41, 3);
    // tribuna junto a la Caja de Arena (escalonada)
    for (i = 0; i < 5; i++) edificio(10.4 + i * 1.9, 21.4, 14 + i * 0.6, 36 - i * 0.6, 1.2 + i * 1.2, true);
    var mEd = new T.Mesh(fusionar(edGeo), matEd); escena.add(mEd);
    var mEd2 = new T.Mesh(fusionar(edGeo2), matEdAlto); escena.add(mEd2);
    var gEd = new T.BufferGeometry(); gEd.setAttribute('position', new T.Float32BufferAttribute(edLin, 3));
    escena.add(new T.LineSegments(gEd, new T.LineBasicMaterial({ color: 0x4D63C9, transparent: true, opacity: 0.45 })));

    /* ---- piso con sombras suaves y luz de faroles (todo horneado) ---- */
    var sombras = ['auditorio', 'expositores', 'kits', 'workshops', 'banos', 'banos2', 'taquillas', 'speakers', 'bebidas'].map(function (k) { return zonas[k].huella; });
    var suelo = new T.Mesh(
      new T.PlaneGeometry(SUELO.x1 - SUELO.x0, SUELO.z1 - SUELO.z0),
      new T.MeshBasicMaterial({ map: texturaSuelo(calidad, { sombras: sombras, faroles: FAROLES, aniso: opciones && opciones.aniso }) })
    );
    suelo.rotation.x = -Math.PI / 2;
    suelo.position.set((SUELO.x0 + SUELO.x1) / 2, 0, (SUELO.z0 + SUELO.z1) / 2);
    escena.add(suelo);

    /* ---- faroles ---- */
    var dF = new T.Object3D(), postesF = new T.InstancedMesh(new T.CylinderGeometry(0.08, 0.13, 4.4, 6), new T.MeshLambertMaterial({ color: 0x2C2440 }), FAROLES.length);
    var cabezas = [];
    for (i = 0; i < FAROLES.length; i++) {
      dF.position.set(FAROLES[i][0], 2.2, FAROLES[i][1]); dF.updateMatrix(); postesF.setMatrixAt(i, dF.matrix);
      cabezas.push(FAROLES[i][0], 4.5, FAROLES[i][1]);
    }
    postesF.instanceMatrix.needsUpdate = true;
    escena.add(postesF);
    puntosLuz(escena, cabezas, 0xFFD08A, 2.2, texBrillo);
    puntosLuz(escena, cabezas, 0xFFF1D6, 0.55, texBrillo);

    /* ---- guirnaldas de luces sobre la plaza Gastrolabs ---- */
    var guir = [];
    for (v = 0; v < 6; v++) {
      var za = -29 + v * 6.4;
      for (x = 25; x <= 71; x += 1.6) guir.push(x, 5.2 - Math.sin((x - 25) / 46 * Math.PI) * 0.9, za + Math.sin(x * 0.4) * 0.3);
    }
    puntosLuz(zonas.gastrolabs.grupo, guir, 0xFFC46B, 1.1, texBrillo);
    var calida = new T.Mesh(new T.PlaneGeometry(52, 40), new T.MeshBasicMaterial({ map: texBrillo, color: 0xFFA347, transparent: true, opacity: 0.22, blending: T.AdditiveBlending, depthWrite: false }));
    calida.rotation.x = -Math.PI / 2; calida.position.set(48, 0.3, -12); calida.renderOrder = 1;
    zonas.gastrolabs.grupo.add(calida);

    /* ---- gente en miniatura: da escala y vida a la maqueta ---- */
    var r = azar(17);
    function regadas(n, x0, x1, z0, z1, y, sy, evitar) {
      var l = [], intentos = 0;
      while (l.length < n && intentos < n * 20) {
        intentos++;
        var px = x0 + (x1 - x0) * r(), pz = z0 + (z1 - z0) * r();
        if (evitar && evitar(px, pz)) continue;
        l.push([px, pz, y || 0, sy || 1]);
      }
      return l;
    }
    var enPuesto = function (px, pz) {
      for (var k = 0; k < puestos.length; k++) { var q = puestos[k]; if (px > q[0] - 0.6 && px < q[1] + 0.6 && pz > q[2] - 0.6 && pz < q[3] + 1.1) return true; }
      return false;
    };
    gentecita(escena, [].concat(
      regadas(18, -66, -59, -10, -4),            // fila de llegada
      regadas(30, -49, -18, -8.8, -5.2),         // recorrido de ingreso
      regadas(16, -1, 20, -8.8, -5.2),
      regadas(10, -12, 5, -19.5, -12.5),
      regadas(14, 21.5, 55, 7.6, 12.6, 0, 1, function (px) { return px > 23 && px < 36.6; }),
      regadas(6, -2, 12, -27.6, -26.2),
      regadas(4, -47, -41, 38, 41)
    ));
    gentecita(zonas.gastrolabs.grupo, regadas(70, 24, 72, -30.5, 6, 0.15, 1, enPuesto));
    gentecita(zonas.expositores.grupo, regadas(26, 2.2, 8.6, -48.5, -29, 0.3));
    gentecita(zonas.kits.grupo, regadas(10, 1, 10, -51, -50.2, 0.3));
    gentecita(zonas.cowork.grupo, regadas(12, ccx - 5.5, ccx + 5.5, ccz - 5.5, ccz + 5.5, 0.3, 1, function (px, pz) { return Math.hypot(px - ccx, pz - ccz) > 6 || Math.hypot(px - ccx, pz - ccz) < 2; }));
    gentecita(zonas.auditorio.grupo, [].concat(
      regadas(140, 25, 52, 16.5, 33, 0.4, 0.78),
      regadas(12, 24, 52, 34, 36, 0.4)
    ));
    gentecita(zonas.workshops.grupo, regadas(46, -36, -17.2, -23.6, -17.6, 0.3, 0.78));
    gentecita(zonas.bebidas.grupo, regadas(8, 7, 16, -21.4, -20.6, 0.3));
    gentecita(zonas.speakers.grupo, regadas(4, -4.5, 3.5, -23.6, -21.2, 0.3));

    /* ---- árboles: sombra en la plaza y verde en los bordes ---- */
    var sueltos = [[-64, -20, 3.5], [-62, 10, 3.5], [-58, 26, 3.5], [-60, 36, 3], [-20, 44, 3.5], [10, 47, 3.5], [40, 49, 3.5],
                   [72, 52, 3], [80, 20, 3.5], [80, -12, 3.5], [80, -50, 3], [30, -62, 3.5], [10, -58, 3], [-20, -50, 3.5],
                   [-40, -36, 3], [-12, -56, 3], [96, 40, 3.5], [120, -40, 4], [140, -55, 3.5], [100, 10, 3.5]];
    for (i = 0; i < sueltos.length; i++) bosque.arbol(sueltos[i][0], sueltos[i][1], sueltos[i][2], sueltos[i][2] * 2.2);
    bosque.terminar(escena, ligero);

    /* ---- sombras reales del sol (se calculan una vez; ver app.js) ---- */
    if (opciones && opciones.sombras) {
      var cx = VISTA.centro[0], cz = VISTA.centro[1];
      sol.position.set(cx + 55, 130, cz + 70);
      sol.target.position.set(cx, 0, cz);
      escena.add(sol.target);
      sol.castShadow = true;
      sol.shadow.mapSize.set(calidad === 'alta' ? 3072 : 2048, calidad === 'alta' ? 3072 : 2048);
      var sc = sol.shadow.camera;
      sc.left = -100; sc.right = 100; sc.top = 85; sc.bottom = -85; sc.near = 20; sc.far = 400;
      sol.shadow.bias = -0.0008;
      sol.shadow.normalBias = 0.05;
      sol.shadow.radius = 2.5;
      sol.intensity = 0.75;
      var receptor = new T.Mesh(new T.PlaneGeometry(SUELO.x1 - SUELO.x0, SUELO.z1 - SUELO.z0), new T.ShadowMaterial({ opacity: 0.45, color: 0x02010A }));
      receptor.rotation.x = -Math.PI / 2;
      receptor.position.set((SUELO.x0 + SUELO.x1) / 2, 0.035, (SUELO.z0 + SUELO.z1) / 2);
      receptor.receiveShadow = true;
      receptor.renderOrder = 1;
      escena.add(receptor);
      escena.traverse(function (o) {
        if (!o.isMesh || o === receptor || !o.material || o.material.transparent || o.material.isMeshBasicMaterial) return;
        o.castShadow = true;
      });
    }

    return {
      escena: escena,
      red: RED,
      brillo: texBrillo,
      zonas: zonas,
      limites: LIMITES,
      vista: VISTA,
      samanes: bosque.matSaman
    };
  }

  window.LSEscena = { construir: construir };
})();
