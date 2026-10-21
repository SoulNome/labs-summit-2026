/* ==========================================================================
   Labs Summit 2026 · Modelo 3D del Coliseo de Ferias Manuel Victoria Rojas
   --------------------------------------------------------------------------
   Unidades ≈ metros. x crece hacia la derecha del plano, z hacia el frente.
   La distribución sigue el plano de ubicación del evento (Pabellón 1, Zona
   Expositores, Restaurante, Camerinos, Pabellón 2, Punto de información) y
   los renders oficiales del día 29. Las medidas son aproximadas: para mover
   algo basta con cambiar sus números aquí.
   ========================================================================== */
(function () {
  'use strict';
  var T;

  var LIMITES = { x0: -100, x1: 110, z0: -70, z1: 72 };   // terreno del recinto
  var SUELO = { x0: -125, x1: 125, z0: -85, z1: 85 };      // plano visible

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

  /* ---------- piso horneado en una textura ---------- */
  function texturaSuelo(ligero, extras) {
    extras = extras || { sombras: [], faroles: [] };
    var W = ligero ? 1024 : 2048, H = ligero ? 512 : 1024;
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d');
    var sx = W / (SUELO.x1 - SUELO.x0), sz = H / (SUELO.z1 - SUELO.z0);
    function X(v) { return (v - SUELO.x0) * sx; }
    function Z(v) { return (v - SUELO.z0) * sz; }
    function rect(x0, x1, z0, z1) { x.fillRect(X(x0), Z(z0), (x1 - x0) * sx, (z1 - z0) * sz); }
    function linea(a, b, c2, d) { x.beginPath(); x.moveTo(X(a), Z(b)); x.lineTo(X(c2), Z(d)); x.stroke(); }
    function redondo(x0, x1, z0, z1, r) {
      var ax = X(x0), bx = X(x1), az = Z(z0), bz = Z(z1), rx = r * sx, rz = r * sz;
      x.beginPath();
      x.moveTo(ax + rx, az); x.lineTo(bx - rx, az); x.quadraticCurveTo(bx, az, bx, az + rz);
      x.lineTo(bx, bz - rz); x.quadraticCurveTo(bx, bz, bx - rx, bz); x.lineTo(ax + rx, bz);
      x.quadraticCurveTo(ax, bz, ax, bz - rz); x.lineTo(ax, az + rz); x.quadraticCurveTo(ax, az, ax + rx, az);
      x.closePath();
    }

    // fondo y calles
    x.fillStyle = '#08030F'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#120A21';
    rect(SUELO.x0, SUELO.x1, -80, -73); rect(-112, -104, SUELO.z0, SUELO.z1); rect(SUELO.x0, SUELO.x1, 75, 82);
    x.strokeStyle = 'rgba(201,174,255,0.18)'; x.lineWidth = 2; x.setLineDash([10, 12]);
    linea(SUELO.x0, -76.5, SUELO.x1, -76.5); linea(-108, SUELO.z0, -108, SUELO.z1); linea(SUELO.x0, 78.5, SUELO.x1, 78.5);
    x.setLineDash([]);

    // terreno del recinto
    redondo(LIMITES.x0, LIMITES.x1, LIMITES.z0, LIMITES.z1, 8);
    x.fillStyle = '#0D061C'; x.fill();
    x.strokeStyle = 'rgba(201,174,255,0.22)'; x.lineWidth = 2; x.stroke();

    // cuadrícula de 5 m
    x.strokeStyle = 'rgba(201,174,255,0.045)'; x.lineWidth = 1;
    for (var gx = -100; gx <= 110; gx += 5) linea(gx, LIMITES.z0, gx, LIMITES.z1);
    for (var gz = -70; gz <= 72; gz += 5) linea(LIMITES.x0, gz, LIMITES.x1, gz);

    // caminos
    x.fillStyle = '#1A1030';
    rect(-78, -70, 8, 72);                  // alameda de ingreso
    rect(-8, 8, -24, -19);                  // plaza → auditorio
    rect(38, 106, 3, 9);                    // pérgola
    rect(18, 24, 8, 14);                    // plaza → restaurante
    rect(-70, -56, 2, 8);                   // alameda → punto de información
    rect(-72, -62, -28, 2);                 // hacia workshops
    rect(10, 22, 22, 34);                   // frente del restaurante
    x.strokeStyle = 'rgba(201,174,255,0.08)'; x.lineWidth = 1;
    for (var az = 10; az < 72; az += 2) linea(-78, az, -70, az);
    for (var px = 38; px <= 106; px += 6) { linea(px, 3, px, 9); }

    // plaza de los samanes
    redondo(-46, 38, -20, 8, 12);
    x.fillStyle = '#170C2E'; x.fill();
    x.strokeStyle = 'rgba(232,121,249,0.35)'; x.lineWidth = 2; x.stroke();
    x.strokeStyle = 'rgba(201,174,255,0.09)'; x.lineWidth = 1;
    linea(-40, -18, -10, 6); linea(-40, 6, -10, -18); linea(-12, -18, 18, 6); linea(-12, 6, 18, -18);
    linea(14, -18, 36, 6); linea(14, 6, 36, -18); linea(-46, -6, 38, -6);

    // rotonda
    x.strokeStyle = 'rgba(201,174,255,0.25)'; x.lineWidth = 2;
    x.beginPath(); x.ellipse(X(76), Z(-4), 7 * sx, 7 * sz, 0, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.ellipse(X(76), Z(-4), 1.6 * sx, 1.6 * sz, 0, 0, Math.PI * 2); x.stroke();
    for (var k = 0; k < 8; k++) {
      var an = k * Math.PI / 4;
      linea(76 + Math.cos(an) * 1.6, -4 + Math.sin(an) * 1.6, 76 + Math.cos(an) * 7, -4 + Math.sin(an) * 7);
    }

    // jardines del frente
    x.strokeStyle = 'rgba(201,174,255,0.12)'; x.lineWidth = 1.5;
    var jard = [[30, 44, 36, 50], [46, 60, 36, 50], [30, 44, 52, 66], [46, 60, 52, 66]];
    for (var j = 0; j < jard.length; j++) {
      var q = jard[j];
      x.strokeRect(X(q[0]), Z(q[2]), (q[1] - q[0]) * sx, (q[3] - q[2]) * sz);
      linea(q[0], q[2], q[1], q[3]); linea(q[0], q[3], q[1], q[2]);
    }
    x.strokeRect(X(-44), Z(28), 40 * sx, 18 * sz);
    x.strokeRect(X(-40), Z(52), 30 * sx, 12 * sz);
    x.strokeRect(X(70), Z(42), 30 * sx, 18 * sz);

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
      var g = x.createRadialGradient(0, 0, 0, 0, 0, 7.5 * sx);
      g.addColorStop(0, 'rgba(255,186,105,0.30)');
      g.addColorStop(0.45, 'rgba(255,170,90,0.11)');
      g.addColorStop(1, 'rgba(255,160,80,0)');
      x.fillStyle = g;
      x.beginPath(); x.arc(0, 0, 7.5 * sx, 0, Math.PI * 2); x.fill();
      x.restore();
    }
    x.restore();

    var t = new T.CanvasTexture(c);
    t.anisotropy = 4;
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
    var f = [], z;
    for (z = 66; z >= 12; z -= 9) f.push([-79.5, z], [-68.5, z - 4.5]);   // alameda, entre los árboles
    f.push([-66, 3.5], [-58.5, 9]);                                        // hacia el punto de información
    f.push([-44, 9.5], [-30, 10], [-14, 10], [2, 10], [18, 10], [34, 9.5]); // borde sur de la plaza
    f.push([-44, -21], [-24, -21.5], [24, -21.5], [38, -19.5]);            // borde norte de la plaza
    f.push([-9.5, -22.5], [9.5, -22.5]);                                   // acceso al auditorio
    f.push([17, 26.5], [24, 34], [32, 34]);                                // frente del restaurante
    f.push([-73.5, -12], [-60.5, -13]);                                    // camino a workshops
    f.push([58, 1.5], [108, 10]);                                          // pérgola
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
      calle: [-74, 73], taqF: [-74, 63.5], taqD: [-74, 52], arco: [-74, 40], conect: [-74, 26], aveA: [-74, 5],
      infoC: [-61, 5], infoD: [-55, -1.2], wkC: [-67, 4], wkD: [-67, -26.5],
      plO: [-44, 3.5], pl1: [-26, 5.5], plS1: [-6, 5.5], plW: [-6.5, -14], aud: [0, -22],
      expo: [10, 4], plS3: [21, 6.5], foto: [28, 0.5], rest1: [20.5, 11.5], rest2: [20.2, 23.5], rest3: [20.2, 30.5],
      cafe: [26, 30.5], banos: [15.5, 22.6], plE: [36.5, 5.5], perg1: [50, 6], perg2: [62, 6], pabW: [62, 22],
      pab: [64.5, 22], pod: [68, 19.2]
    },
    aristas: [
      ['calle', 'taqF'], ['taqF', 'taqD'], ['taqD', 'arco'], ['arco', 'conect'], ['conect', 'aveA'],
      ['aveA', 'infoC'], ['aveA', 'wkC'], ['wkC', 'infoC'], ['wkC', 'wkD'], ['infoC', 'infoD'], ['infoC', 'plO'], ['infoD', 'plO'],
      ['plO', 'pl1'], ['pl1', 'plS1'], ['plS1', 'plW'], ['plW', 'aud'], ['plS1', 'expo'], ['expo', 'plS3'],
      ['plS3', 'foto'], ['plS3', 'rest1'], ['rest1', 'rest2'], ['rest2', 'banos'], ['rest2', 'rest3'], ['rest3', 'cafe'],
      ['plS3', 'plE'], ['plE', 'perg1'], ['perg1', 'perg2'], ['perg2', 'pabW'], ['pabW', 'pab'], ['pab', 'pod']
    ],
    destino: {
      auditorio: 'aud', expositores: 'expo', marcas: 'pab', podcast: 'pod', workshops: 'wkD', foto: 'foto',
      cafe: 'cafe', info: 'infoD', taquillas: 'taqF', banos: 'banos'
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
    var colores = (opciones && opciones.colores) || {};
    function col(tipo, def) { return colores[tipo] || def; }
    var C = {
      charlas: col('charlas', '#A855F7'), marcas: col('marcas', '#E879F9'), experiencias: col('experiencias', '#22D3EE'),
      comida: col('comida', '#F59E0B'), servicios: col('servicios', '#C9AEFF')
    };

    var escena = new T.Scene();
    escena.background = new T.Color(0x07020F);
    escena.add(new T.HemisphereLight(0xB9A6FF, 0x120624, 0.95));
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
    var deco = [];  // líneas decorativas (pérgola, arcos)
    var z, i, x;

    /* ---- Pabellón 1 · Auditorio principal ---- */
    z = zonas.auditorio = new Zona('auditorio', C.charlas, 2);
    z.caja('base', -24, 24, 0, 0.4, -58, -24, 'tenue');
    for (i = 0; i < 5; i++) z.caja('alto', 24 + i * 1.6, 32, 0.4, 1.3 + i * 0.9, -54, -28, 'tenue');  // gradería
    z.caja('oscuro', -24, 24, 0.4, 5, -58, -57.5);          // cortina norte
    z.caja('oscuro', -24, -23.5, 0.4, 5, -58, -24);         // cortina occidental
    z.caja('oscuro', -24, -8, 0.4, 3.2, -24.5, -24);        // cortina sur (con acceso al centro)
    z.caja('oscuro', 8, 24, 0.4, 3.2, -24.5, -24);
    var cols = [-24, -12, 0, 12, 24, 32];
    for (i = 0; i < cols.length; i++) {
      z.caja('acero', cols[i] - 0.3, cols[i] + 0.3, 0, 10, -58.3, -57.7, 'no');
      z.caja('acero', cols[i] - 0.3, cols[i] + 0.3, 0, 10, -24.3, -23.7, 'no');
      z.trazo(true, [cols[i], 10, -58, cols[i], 13.5, -41, cols[i], 13.5, -41, cols[i], 10, -24,
                     cols[i], 0, -58, cols[i], 10, -58, cols[i], 0, -24, cols[i], 10, -24]);
      if (i < cols.length - 1) {
        var a1 = cols[i], a2 = cols[i + 1];
        z.trazo(true, [a1, 10, -58, a2, 13.5, -41, a2, 10, -58, a1, 13.5, -41,
                       a1, 10, -24, a2, 13.5, -41, a2, 10, -24, a1, 13.5, -41]);
      }
    }
    z.trazo(false, [-24, 10, -58, 32, 10, -58, -24, 13.5, -41, 32, 13.5, -41, -24, 10, -24, 32, 10, -24]);
    z.forma('vidrio', cuadro([-24, 10, -58], [32, 10, -58], [32, 13.5, -41], [-24, 13.5, -41]));
    z.forma('vidrio', cuadro([-24, 13.5, -41], [32, 13.5, -41], [32, 10, -24], [-24, 10, -24]));
    // escenario central con cuatro pantallas
    z.caja('alto', -5, 5, 0.4, 1.8, -46, -36);
    z.caja('neon', -5.05, 5.05, 1.8, 1.95, -46.05, -35.95, 'no');
    var torres = [[-5, -46], [5, -46], [5, -36], [-5, -36]];
    for (i = 0; i < 4; i++) z.caja('acero', torres[i][0] - 0.35, torres[i][0] + 0.35, 0.4, 10, torres[i][1] - 0.35, torres[i][1] + 0.35, 'no');
    z.trazo(false, [-5, 10, -46, 5, 10, -46, 5, 10, -46, 5, 10, -36, 5, 10, -36, -5, 10, -36, -5, 10, -36, -5, 10, -46]);
    var pan = new T.Group();
    var geoPan = new T.PlaneGeometry(7.4, 3.6);
    var lados = [[0, -35.7, 0], [0, -46.3, Math.PI], [5.3, -41, Math.PI / 2], [-5.3, -41, -Math.PI / 2]];
    for (i = 0; i < 4; i++) {
      var p = new T.Mesh(geoPan, matPantalla);
      p.position.set(lados[i][0], 7.6, lados[i][1]);
      p.rotation.y = lados[i][2];
      pan.add(p);
    }
    z.grupo.add(pan);
    // mesas largas alrededor del escenario
    z.caja('blanco', -11, 11, 0.4, 1.2, -52.5, -51.5, 'no');
    z.caja('blanco', -12.5, -11.5, 0.4, 1.2, -51, -31, 'no');
    z.caja('blanco', 11.5, 12.5, 0.4, 1.2, -51, -31, 'no');
    z.caja('blanco', -11, -2.5, 0.4, 1.2, -30.5, -29.5, 'no');
    z.caja('blanco', 2.5, 11, 0.4, 1.2, -30.5, -29.5, 'no');
    sillas(z, [
      [-16, -3, -28.2, -25.6], [3, 16, -28.2, -25.6],
      [-22, -14.5, -50, -31.5], [14.5, 22, -50, -31.5],
      [-10, 10, -56.4, -54.2]
    ]);
    z.area(-24, 32, 13.5, -58, -24, 4, 17, -41);

    /* ---- Zona Expositores (pabellón de vidrio en la plaza) ---- */
    z = zonas.expositores = new Zona('expositores', C.marcas, 2);
    z.bajoSamanes = true;
    z.caja('base', -2, 22, 0, 0.3, -10, 2, 'tenue');
    z.forma('vidrio', caja(-2, 22, 0.3, 5.5, -10, -9.9));
    z.forma('vidrio', caja(-2, 22, 0.3, 5.5, 1.9, 2));
    z.forma('vidrio', caja(-2, -1.9, 0.3, 5.5, -10, 2));
    z.forma('vidrio', caja(21.9, 22, 0.3, 5.5, -10, 2));
    z.forma('vidrio', cuadro([-2, 5.5, -10], [22, 5.5, -10], [22, 7.6, -4], [-2, 7.6, -4]));
    z.forma('vidrio', cuadro([-2, 7.6, -4], [22, 7.6, -4], [22, 5.5, 2], [-2, 5.5, 2]));
    aristasCaja(z.lin, -2, 22, 0.3, 5.5, -10, 2);
    for (x = -2; x <= 22; x += 4) {
      z.trazo(x === -2 || x === 22 ? false : true, [x, 5.5, -10, x, 7.6, -4, x, 7.6, -4, x, 5.5, 2, x, 0.3, -10, x, 5.5, -10, x, 0.3, 2, x, 5.5, 2]);
    }
    z.trazo(false, [-2, 7.6, -4, 22, 7.6, -4]);
    for (x = -0.6; x < 20; x += 3.6) {
      z.caja('blanco', x, x + 3.2, 0.3, 2.6, -9.6, -7.4, 'tenue');
      z.caja('neon', x, x + 3.2, 2.6, 2.8, -7.5, -7.35, 'no');
      z.caja('blanco', x, x + 3.2, 0.3, 2.6, -0.6, 1.6, 'tenue');
      z.caja('neon', x, x + 3.2, 2.6, 2.8, -0.75, -0.6, 'no');
    }
    var anillo = new T.TorusGeometry(2.6, 0.45, 6, 24);
    anillo.rotateX(Math.PI / 2); anillo.translate(10, 0.75, -4);
    z.forma('alto', anillo);
    var mesa = new T.CylinderGeometry(0.9, 0.9, 1, 12); mesa.translate(10, 0.8, -4);
    z.forma('neon', mesa);
    z.area(-2, 22, 7.6, -10, 2, 10, 10.5, -4);

    /* ---- Zona fotográfica (bajo el samán, junto al restaurante) ---- */
    z = zonas.foto = new Zona('foto', C.experiencias, 3);
    z.bajoSamanes = true;
    var tarima = new T.CylinderGeometry(3, 3.2, 0.6, 24); tarima.translate(28, 0.3, -7);
    z.forma('alto', tarima);
    var aro = new T.TorusGeometry(3.05, 0.08, 4, 32); aro.rotateX(Math.PI / 2); aro.translate(28, 0.62, -7);
    z.forma('neon', aro);
    z.caja('oscuro', 23, 33, 0, 1.5, -2.6, -2);
    z.caja('neon', 23, 33, 1.5, 1.62, -2.6, -2, 'no');
    z.caja('oscuro', 21.6, 22.8, 0, 1.2, -2.9, -1.7);
    z.caja('oscuro', 33.2, 34.4, 0, 1.2, -2.9, -1.7);
    for (i = 0; i < 6; i++) {
      var an = Math.PI * (0.9 + i * 0.24);
      var flor = new T.IcosahedronGeometry(1.1, 0);
      flor.scale(1, 0.8, 1); flor.translate(28 + Math.cos(an) * 4, 0.8, -7 + Math.sin(an) * 4);
      z.forma('cesped', flor);
    }
    z.area(21.5, 34.5, 3, -11, -1.5, 28, 5.5, -6);

    /* ---- Café y restaurante (edificio amarillo) ---- */
    z = zonas.cafe = new Zona('cafe', C.comida, 2);
    z.caja('alto', 22, 46, 0, 3.6, 14, 22);
    z.caja('alto', 30, 38, 0, 6.2, 12, 22);
    z.caja('base', 21.6, 30.4, 3.2, 3.45, 22, 28.4);            // cubierta de la terraza
    var postes = [[22, 28], [26, 28], [30, 28]];
    for (i = 0; i < postes.length; i++) z.caja('acero', postes[i][0] - 0.2, postes[i][0] + 0.2, 0, 3.2, postes[i][1] - 0.2, postes[i][1] + 0.2, 'no');
    z.caja('neon', 22, 30, 0, 1, 27.9, 28.1, 'tenue');
    for (i = 0; i < 6; i++) {
      var m2 = new T.CylinderGeometry(0.6, 0.6, 0.8, 10);
      m2.translate(23.6 + (i % 3) * 2.6, 0.4, 23.8 + Math.floor(i / 3) * 2.4);
      z.forma('blanco', m2);
    }
    z.caja('neon', 30.2, 37.8, 4.2, 4.6, 21.9, 22.05, 'no');  // aviso CAFÉ
    for (x = 31; x <= 43; x += 3) if (x > 38.5) z.caja('neon', x, x + 1.6, 1.4, 2.5, 21.99, 22.07, 'no');   // ventanas encendidas
    z.caja('neon', 31, 37, 5.0, 5.7, 21.99, 22.07, 'no');
    z.area(22, 46, 6.2, 12, 28.4, 34, 9.5, 19);

    /* ---- Camerinos (solo speakers y staff) ---- */
    z = zonas.camerinos = new Zona('camerinos', C.servicios, 1);
    z.caja('base', 46, 58, 0, 3.6, 14, 22);
    for (x = 47.5; x < 57; x += 3) z.caja('neon', x, x + 1.2, 1.7, 2.5, 21.99, 22.06, 'no');
    z.area(46, 58, 3.6, 14, 22, 52, 6.4, 18);

    /* ---- Baños ---- */
    z = zonas.banos = new Zona('banos', C.servicios, 2);
    z.caja('base', 12, 19, 0, 3, 15, 21);
    z.caja('neon', 12.8, 18.2, 2.2, 2.4, 20.95, 21.05, 'no');
    z.area(12, 19, 3, 15, 21, 15.5, 5.6, 18);

    /* ---- Pabellón 2 · marcas, lounge y DJ ---- */
    z = zonas.marcas = new Zona('marcas', C.marcas, 1);
    z.caja('base', 64, 106, 0, 0.25, 12, 32, 'tenue');
    var carpa = new T.CylinderGeometry(10, 10, 42, 20, 1, true, 0, Math.PI);
    carpa.rotateZ(Math.PI / 2); carpa.scale(1, 0.9, 1); carpa.translate(85, 0, 22);
    z.forma('lona', carpa);
    for (x = 64; x <= 106; x += 6) {
      var arco = [];
      for (i = 0; i < 12; i++) {
        var f1 = Math.PI * i / 12, f2 = Math.PI * (i + 1) / 12;
        arco.push(x, Math.sin(f1) * 9, 22 + Math.cos(f1) * 10, x, Math.sin(f2) * 9, 22 + Math.cos(f2) * 10);
      }
      z.trazo(x !== 64 && x !== 106, arco);
    }
    var cumbres = [Math.PI / 2, Math.PI / 4, 3 * Math.PI / 4];
    for (i = 0; i < cumbres.length; i++) {
      var yy = Math.sin(cumbres[i]) * 9, zz = 22 + Math.cos(cumbres[i]) * 10;
      z.trazo(true, [64, yy, zz, 106, yy, zz]);
    }
    for (x = 72.5; x < 104; x += 4) z.caja('blanco', x, x + 3.6, 0.25, 2.6, 12.6, 15, 'tenue');
    for (x = 65.5; x < 104; x += 4) z.caja('blanco', x, x + 3.6, 0.25, 2.6, 29, 31.4, 'tenue');
    var cesped = new T.CylinderGeometry(6, 6, 0.2, 28); cesped.translate(88, 0.35, 22);
    z.forma('cesped', cesped);
    var cabina = new T.CylinderGeometry(1.8, 1.8, 1.3, 16); cabina.translate(88, 1.1, 22);
    z.forma('oscuro', cabina);
    var anilloDj = new T.TorusGeometry(1.85, 0.08, 4, 24); anilloDj.rotateX(Math.PI / 2); anilloDj.translate(88, 1.2, 22);
    z.forma('neon', anilloDj);
    var sofas = [[83, 18.5], [93, 18.5], [83, 25.5], [93, 25.5]];
    for (i = 0; i < sofas.length; i++) z.caja('blanco', sofas[i][0] - 1.6, sofas[i][0] + 1.6, 0.45, 1.2, sofas[i][1] - 0.6, sofas[i][1] + 0.6, 'no');
    z.area(64, 106, 9, 12, 32, 85, 12.5, 22);

    /* ---- Podcast Studio (dentro del Pabellón 2) ---- */
    z = zonas.podcast = new Zona('podcast', C.experiencias, 3);
    z.caja('oscuro', 65, 71, 0.25, 3.6, 13, 13.35);
    z.caja('oscuro', 65, 65.35, 0.25, 3.6, 13, 17.5);
    z.caja('oscuro', 70.65, 71, 0.25, 3.6, 13, 17.5);
    z.caja('base', 65, 71, 3.2, 3.6, 13, 17.5);
    var aroPod = new T.TorusGeometry(1.2, 0.07, 4, 24); aroPod.translate(68, 2.1, 13.4);
    z.forma('neon', aroPod);
    z.caja('blanco', 66.2, 67.3, 0.25, 0.95, 15.2, 16.3, 'no');
    z.caja('blanco', 68.7, 69.8, 0.25, 0.95, 15.2, 16.3, 'no');
    z.area(65, 71, 3.6, 13, 17.5, 68, 6.8, 15);

    /* ---- Zona de workshops (cubierta norte) ---- */
    z = zonas.workshops = new Zona('workshops', C.charlas, 2);
    z.caja('base', -80, -54, 0, 0.25, -48, -28, 'tenue');
    z.caja('acero', -80.6, -53.4, 6, 6.35, -48.6, -27.4);
    var pw = [-80, -71, -62, -54];
    for (i = 0; i < pw.length; i++) {
      z.caja('acero', pw[i] - 0.25, pw[i] + 0.25, 0, 6, -48.25, -47.75, 'no');
      z.caja('acero', pw[i] - 0.25, pw[i] + 0.25, 0, 6, -28.25, -27.75, 'no');
      z.trazo(true, [pw[i], 0, -48, pw[i], 6, -48, pw[i], 0, -28, pw[i], 6, -28]);
    }
    z.caja('oscuro', -80, -54, 0.25, 5, -48, -47.6, 'tenue');
    z.caja('alto', -72, -62, 0.25, 1.1, -47.4, -43.5);
    var pantW = new T.Mesh(new T.PlaneGeometry(7, 3.4), matPantalla);
    pantW.position.set(-67, 3.6, -47.5);
    z.grupo.add(pantW);
    sillas(z, [[-77, -68.5, -40.5, -30.5, 1.2], [-65.5, -57, -40.5, -30.5, 1.2]]);
    z.area(-80.6, -53.4, 6.35, -48.6, -27.4, -67, 9.5, -38);

    /* ---- Punto de información ---- */
    z = zonas.info = new Zona('info', C.servicios, 2);
    z.caja('base', -60, -50, 0, 3.5, -9, -3);
    z.caja('alto', -59, -51, 0, 1.1, -2.6, -1.6);
    z.caja('neon', -59, -51, 1.1, 1.2, -2.6, -1.6, 'no');
    z.caja('neon', -58.5, -51.5, 1.6, 2.9, -3.03, -2.96, 'no');   // vitrina iluminada
    z.area(-60, -50, 3.5, -9, -1.5, -55, 6.5, -5.5);

    /* ---- Taquillas y alameda de ingreso ---- */
    z = zonas.taquillas = new Zona('taquillas', C.servicios, 2);
    z.caja('blanco', -82, -80, 0, 5, 56.5, 59);
    z.caja('blanco', -68, -66, 0, 5, 56.5, 59);
    z.caja('blanco', -82, -66, 4, 5.4, 56.5, 59);
    for (x = -79; x <= -69; x += 1.65) z.caja('acero', x - 0.25, x + 0.25, 0, 1.1, 57.3, 58.3, 'no');
    z.caja('neon', -79.5, -68.5, 4.6, 4.9, 59, 59.1, 'no');
    // arco LABS SUMMIT y arco «Zona de conectividad»
    var arcos = [44, 30];
    for (i = 0; i < arcos.length; i++) {
      var az2 = arcos[i];
      z.caja('oscuro', -80.5, -79.3, 0, 4.6, az2 - 0.6, az2 + 0.6, 'tenue');
      z.caja('oscuro', -68.7, -67.5, 0, 4.6, az2 - 0.6, az2 + 0.6, 'tenue');
      z.caja('oscuro', -80.5, -67.5, 4.6, 5.8, az2 - 0.5, az2 + 0.5, 'tenue');
      z.caja('neon', -79.3, -68.7, 4.5, 4.62, az2 + 0.5, az2 + 0.56, 'no');
    }
    z.area(-84, -64, 5.4, 54, 62, -74, 8.5, 57.5);

    /* ---- terminar zonas ---- */
    for (var id in zonas) if (zonas.hasOwnProperty(id)) zonas[id].terminar(escena, texBrillo, texHaz);

    /* ---- piso con sombras suaves y luz de faroles (todo horneado: no cuesta nada al dibujar) ---- */
    var sombras = ['auditorio', 'expositores', 'cafe', 'camerinos', 'banos', 'info', 'workshops', 'marcas'].map(function (k) { return zonas[k].huella; });
    var suelo = new T.Mesh(
      new T.PlaneGeometry(SUELO.x1 - SUELO.x0, SUELO.z1 - SUELO.z0),
      new T.MeshBasicMaterial({ map: texturaSuelo(ligero, { sombras: sombras, faroles: FAROLES }) })
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

    /* ---- luz cálida dentro de la carpa del Pabellón 2 ---- */
    var lamp = [];
    for (x = 67; x <= 103; x += 4.5) { lamp.push(x, 6.4, 18.5, x, 6.4, 25.5); }
    puntosLuz(zonas.marcas.grupo, lamp, 0xFFC46B, 1.6, texBrillo);
    var calida = new T.Mesh(new T.PlaneGeometry(40, 18), new T.MeshBasicMaterial({ map: texBrillo, color: 0xFFA347, transparent: true, opacity: 0.28, blending: T.AdditiveBlending, depthWrite: false }));
    calida.rotation.x = -Math.PI / 2; calida.position.set(85, 0.3, 22); calida.renderOrder = 1;
    zonas.marcas.grupo.add(calida);

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
    var fueraPlaza = function (px, pz) { return (px > -3 && px < 23 && pz > -11 && pz < 3) || (px > 21 && px < 35 && pz > -11 && pz < -1); };
    gentecita(escena, [].concat(
      regadas(22, -76.5, -71.5, 60.5, 71),
      regadas(26, -77, -71, 12, 54),
      regadas(56, -42, 36, -17, 6.5, 0, 1, fueraPlaza),
      regadas(6, 25, 31, -1.2, 1.5),
      regadas(12, 40, 100, 4, 8),
      regadas(4, -57, -53, -1.4, 1.2),
      regadas(8, -6, 6, -23, -19.5)
    ));
    gentecita(zonas.expositores.grupo, regadas(16, 0, 20, -6.6, -1.4, 0.3));
    gentecita(zonas.auditorio.grupo, [].concat(
      regadas(48, -16, 16, -28, -25.8, 0.35, 0.78, function (px) { return Math.abs(px) < 3; }),
      regadas(30, -22, -14.5, -50, -31.5, 0.35, 0.78),
      regadas(30, 14.5, 22, -50, -31.5, 0.35, 0.78),
      regadas(10, -12, 12, -34, -31, 0.4)
    ));
    gentecita(zonas.cafe.grupo, regadas(9, 22.6, 29.6, 22.8, 27.6, 0, 0.85));
    gentecita(zonas.marcas.grupo, regadas(40, 66, 104, 16, 28, 0.25, 1, function (px, pz) { return Math.hypot(px - 88, pz - 22) < 2.2; }));
    gentecita(zonas.workshops.grupo, regadas(52, -77, -57, -40.5, -30.5, 0.25, 0.78, function (px) { return px > -68.5 && px < -65.5; }));

    /* ---- pérgola, rotonda y árboles (decoración sin interacción) ---- */
    var matDeco = new T.LineBasicMaterial({ color: 0xC9AEFF, transparent: true, opacity: 0.28 });
    var postesP = [];
    for (x = 40; x <= 104; x += 6) {
      deco.push(x, 0, 3, x, 3.2, 3, x, 0, 9, x, 3.2, 9, x, 3.2, 3, x, 3.2, 9);
      postesP.push(x);
    }
    deco.push(40, 3.2, 3, 104, 3.2, 3, 40, 3.2, 9, 104, 3.2, 9);
    var gd = new T.BufferGeometry();
    gd.setAttribute('position', new T.Float32BufferAttribute(deco, 3));
    escena.add(new T.LineSegments(gd, matDeco));
    var fuente = new T.Mesh(new T.CylinderGeometry(1.4, 1.6, 0.8, 16), new T.MeshLambertMaterial({ color: 0x2A1E46 }));
    fuente.position.set(76, 0.4, -4);
    escena.add(fuente);

    bosque.saman(-36, -6);
    bosque.saman(-17, -1);
    bosque.saman(5, -16);
    bosque.saman(29, -9);
    var zs = [68, 50, 43, 36, 29, 22, 15];
    for (i = 0; i < zs.length; i++) { bosque.arbol(-84, zs[i], 3, 7); bosque.arbol(-64, zs[i], 3, 7); }
    var sueltos = [[-92, -55, 5], [-90, -20, 4.5], [-90, 12, 4], [-94, 42, 5], [-48, 30, 4], [-36, 48, 5], [-18, 60, 4.5],
                   [-40, -45, 5], [-40, -62, 4.5], [40, -50, 5], [56, -36, 4.5], [50, -62, 4], [88, -30, 5],
                   [100, -10, 4], [98, 46, 5], [82, 54, 4], [64, 62, 4.5], [10, 52, 4], [-6, 40, 4.5], [-88, -66, 4]];
    for (i = 0; i < sueltos.length; i++) bosque.arbol(sueltos[i][0], sueltos[i][1], sueltos[i][2], sueltos[i][2] * 2.2);
    bosque.terminar(escena, ligero);

    return {
      escena: escena,
      red: RED,
      brillo: texBrillo,
      zonas: zonas,
      limites: LIMITES,
      samanes: bosque.matSaman
    };
  }

  window.LSEscena = { construir: construir };
})();
