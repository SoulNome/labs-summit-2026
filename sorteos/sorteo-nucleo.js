/* ==========================================================================
   Labs Summit 2026 · Sorteos verificables — núcleo (sin interfaz)
   --------------------------------------------------------------------------
   Lo usan la página pública (/sorteos/), la herramienta del organizador y las
   pruebas automáticas (repo labs-summit-tests). Cómo funciona, en corto:

   1. Se cierra la lista de participantes y se publica su «huella»: el SHA-256
      del acta (texto con los datos del sorteo y una línea por participante).
      Si alguien cambia un solo participante, la huella cambia.
   2. El azar no lo pone nadie del evento: sale de drand, la red pública de
      aleatoriedad de la League of Entropy, en una ronda FUTURA que queda
      escrita en el acta. Cada ronda viene firmada (BLS) y se comprueba aquí.
   3. Ganadores = función pública de (huella, número aleatorio de la ronda).
      Cualquiera puede recalcularlos (ver /sorteos/verificar.py).

   Privacidad: en el acta solo va una etiqueta corta («María J. · …0153») y un
   compromiso por participante: sha256('LS-SORTEO|entrada|' + sal + '|' + id).
   La sal es secreta (archivo privado del organizador), así que el documento o
   el código de la boleta no se pueden adivinar a partir de lo publicado.
   ========================================================================== */
(function (raiz) {
  'use strict';

  var FORMATO = 'labs-summit-sorteo/v1';

  // drand «quicknet» (una ronda cada 3 s). Datos de la cadena tal como los publica drand
  // y los traen drand-client y tlock-js. La clave pública NUNCA se toma del archivo del sorteo.
  var QUICKNET = {
    nombre: 'quicknet',
    hash: '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971',
    clavePublica: '83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a',
    genesis: 1692803367,
    periodo: 3,
    esquema: 'bls-unchained-g1-rfc9380',
    relevos: ['https://api.drand.sh', 'https://api2.drand.sh', 'https://api3.drand.sh', 'https://drand.cloudflare.com']
  };
  // __LS_SORTEO_PRUEBA solo lo usan las pruebas automáticas (como __LS_AHORA en main.js).
  var PRUEBA = raiz.__LS_SORTEO_PRUEBA || {};
  var RED = PRUEBA.red || QUICKNET;

  var RE_ID = /^[a-z0-9][a-z0-9-]{2,79}$/;
  var RE_HEX64 = /^[0-9a-f]{64}$/;
  var RE_FECHA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})$/;
  var PARTICULAS = ['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'das', 'do', 'dos', 'van', 'von', 'di'];

  /* ---------------- utilidades ---------------- */
  function utf8(s) { return new TextEncoder().encode(s); }
  function aHex(buf) { return Array.from(new Uint8Array(buf), function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join(''); }
  function sha256Hex(texto) { return raiz.crypto.subtle.digest('SHA-256', utf8(texto)).then(aHex); }
  function salAleatoria() { var b = new Uint8Array(16); raiz.crypto.getRandomValues(b); return aHex(b); }
  function bls() {
    var b = raiz.LSDrandBLS;
    if (!b || typeof b.verificarFirma !== 'function') throw new Error('Falta el verificador de firmas (vendor/drand-bls.min.js).');
    return b;
  }

  // Deja un texto en una sola línea, sin «|» ni caracteres de control: así el acta no se puede ambiguar.
  function limpiar(s) {
    return String(s == null ? '' : s).normalize('NFC')
      .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029|]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  function esLimpio(s) { return typeof s === 'string' && s.length > 0 && limpiar(s) === s; }

  // Identificador para detectar duplicados: «LS-20669-0153», «ls 20669 0153» y «LS206690153» son la misma boleta.
  // En los correos los puntos y guiones sí cuentan, así que solo se quitan los espacios.
  function normalizarId(s) {
    var t = limpiar(s);
    if (t.indexOf('@') > 0) return t.replace(/\s+/g, '').toUpperCase();
    t = t.replace(/[\s.\-_\/()]/g, '').toUpperCase();
    var cel = /^\+?57(3\d{9})$/.exec(t);   // «+57 300 123 4567» y «3001234567» son el mismo celular
    return cel ? cel[1] : t;
  }

  function capital(p) {
    var c = Array.from(p.toLocaleLowerCase('es'));
    return c.length ? c[0].toLocaleUpperCase('es') + c.slice(1).join('') : '';
  }
  // «MARÍA JOSÉ DE LA CRUZ» → «María J. C.»
  function nombreCorto(nombre) {
    var partes = limpiar(nombre).split(' ').map(function (p) { return p.replace(/[^\p{L}\p{N}'-]/gu, ''); })
      .filter(function (p) { return /[\p{L}\p{N}]/u.test(p); });
    if (!partes.length) return '';
    var iniciales = partes.slice(1).filter(function (p) { return PARTICULAS.indexOf(p.toLowerCase()) < 0; }).slice(0, 2)
      .map(function (p) { return Array.from(p.replace(/[^\p{L}\p{N}]/gu, ''))[0].toLocaleUpperCase('es') + '.'; });
    return [Array.from(capital(partes[0])).slice(0, 18).join('')].concat(iniciales).join(' ');
  }
  // «1.116.234.567» → «…4567» · «maria@gmail.com» → «ma…@gm…»
  function idCorto(id) {
    var t = limpiar(id), arroba = t.indexOf('@');
    if (arroba > 0) {
      return Array.from(t.slice(0, arroba)).slice(0, 2).join('') + '…@' + Array.from(t.slice(arroba + 1).toLowerCase()).slice(0, 2).join('') + '…';
    }
    var alnum = Array.from(t.replace(/[^\p{L}\p{N}]/gu, ''));
    return alnum.length ? '…' + alnum.slice(-4).join('').toUpperCase() : '';
  }
  function etiquetaDe(nombre, id, extra) {
    return [nombreCorto(nombre), idCorto(id), extra || ''].filter(Boolean).join(' · ') || 'Participante';
  }

  // «Gran sorteo de cierre», 29 oct a las 5:00 p. m. → «2026-10-29-1700-gran-sorteo-de-cierre»
  function idSorteo(titulo, fechaMs) {
    var t = new Date(fechaMs - 5 * 3600e3).toISOString();
    var slug = limpiar(titulo).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 55).replace(/-+$/, '');
    return t.slice(0, 10) + '-' + t.slice(11, 13) + t.slice(14, 16) + '-' + (slug || 'sorteo');
  }

  /* ---------------- tablas (CSV, TSV, pegado desde Excel) ---------------- */
  // Bytes del archivo → texto. Excel en Windows suele guardar el CSV en Windows-1252, no en UTF-8.
  function decodificar(buffer) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^﻿/, ''); }
    catch (e) { return new TextDecoder('windows-1252').decode(buffer); }
  }
  function separadorProbable(texto) {
    var linea = texto.split(/\r?\n/).find(function (l) { return l.trim(); }) || '';
    var mejor = '\t', cuenta = -1;
    ['\t', ';', ','].forEach(function (sep) {
      var n = 0, comillas = false;
      for (var i = 0; i < linea.length; i++) { var c = linea[i]; if (c === '"') comillas = !comillas; else if (c === sep && !comillas) n++; }
      if (n > cuenta) { cuenta = n; mejor = sep; }
    });
    return mejor;
  }
  /** Texto → filas (arreglos de celdas). Respeta comillas, comillas dobles ("") y saltos de línea dentro de comillas. */
  function leerTabla(texto, sep) {
    texto = String(texto).replace(/^﻿/, '');
    sep = sep || separadorProbable(texto);
    var filas = [], fila = [], celda = '', comillas = false;
    for (var i = 0; i < texto.length; i++) {
      var c = texto[i];
      if (comillas) {
        if (c === '"') { if (texto[i + 1] === '"') { celda += '"'; i++; } else comillas = false; }
        else celda += c;
      } else if (c === '"' && celda === '') comillas = true;
      else if (c === sep) { fila.push(celda); celda = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && texto[i + 1] === '\n') i++;
        fila.push(celda); celda = '';
        if (fila.some(function (x) { return x.trim() !== ''; })) filas.push(fila);
        fila = [];
      } else celda += c;
    }
    fila.push(celda);
    if (fila.some(function (x) { return x.trim() !== ''; })) filas.push(fila);
    return filas;
  }

  /* ---------------- Excel (.xlsx) sin librerías ---------------- */
  // Un .xlsx es un ZIP con XML adentro. Se lee la primera hoja: textos, números, resultados de fórmulas
  // y enlaces. Coccoa pone el código de cada boleta solo en el enlace «Ver código», así que por cada
  // columna con enlaces se agrega otra, «Código del enlace (…)», con el final de cada enlace.
  // El XML se recorre con expresiones regulares: DOMParser está bloqueado por Trusted Types.
  var LIMITE_XLSX = 60e6;   // bytes descomprimidos; un Excel de boletas pesa mucho menos

  function esZip(buffer) {
    var b = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
    return b.length === 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 3 && b[3] === 4;
  }
  function inflar(datos, esperado) {
    if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('Este navegador no puede abrir archivos de Excel: guárdalo como CSV.'));
    var lector = new Blob([datos]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    var partes = [], total = 0;
    function leer() {
      return lector.read().then(function (r) {
        if (r.done) {
          var out = new Uint8Array(total), o = 0;
          partes.forEach(function (p) { out.set(p, o); o += p.length; });
          return out;
        }
        total += r.value.length;
        // un ZIP que se infla más de lo que declara está dañado o es una «bomba»
        if (total > esperado + 1024 || total > LIMITE_XLSX) { lector.cancel(); throw new Error('El archivo de Excel está dañado.'); }
        partes.push(r.value);
        return leer();
      });
    }
    return leer();
  }
  /** Bytes de un ZIP → { nombre: texto } con los .xml y .rels de dentro. */
  function leerZip(buffer) {
    var b = new Uint8Array(buffer), v = new DataView(buffer), fin = -1, malo = new Error('El archivo de Excel está dañado.');
    for (var i = b.length - 22; i >= 0 && i >= b.length - 22 - 65535; i--) { if (v.getUint32(i, true) === 0x06054b50) { fin = i; break; } }
    if (fin < 0) return Promise.reject(new Error('El archivo no es un Excel (.xlsx) válido.'));
    var n = v.getUint16(fin + 10, true), p = v.getUint32(fin + 16, true), total = 0, entradas = {}, trabajos = [];
    for (var k = 0; k < n; k++) {
      if (p + 46 > b.length || v.getUint32(p, true) !== 0x02014b50) return Promise.reject(malo);
      var metodo = v.getUint16(p + 10, true), comprimido = v.getUint32(p + 20, true), tam = v.getUint32(p + 24, true);
      var ln = v.getUint16(p + 28, true), local = v.getUint32(p + 42, true);
      var nombre = new TextDecoder().decode(b.subarray(p + 46, p + 46 + ln));
      p += 46 + ln + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
      if (!/\.(xml|rels)$/.test(nombre)) continue;
      if ((total += tam) > LIMITE_XLSX) return Promise.reject(new Error('El archivo de Excel es demasiado grande.'));
      if (local + 30 > b.length || v.getUint32(local, true) !== 0x04034b50) return Promise.reject(malo);
      var ini = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
      if (ini + comprimido > b.length) return Promise.reject(malo);
      trabajos.push((function (nombre, metodo, datos, tam) {
        var bytes = metodo === 0 ? Promise.resolve(datos) : metodo === 8 ? inflar(datos, tam) : Promise.reject(new Error('El archivo de Excel usa una compresión desconocida.'));
        return bytes.then(function (d) { entradas[nombre] = new TextDecoder('utf-8').decode(d); });
      })(nombre, metodo, b.subarray(ini, ini + comprimido), tam));
    }
    return Promise.all(trabajos).then(function () { return entradas; });
  }

  function textoXml(s) {
    return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, function (m, e) {
      var t = e.toLowerCase();
      if (t[0] !== '#') return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[t];
      var cp = t[1] === 'x' ? parseInt(t.slice(2), 16) : parseInt(t.slice(1), 10);
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : '';
    }).replace(/_x([0-9a-f]{4})_/gi, function (m, x) { return String.fromCharCode(parseInt(x, 16)); });   // así guarda Excel los caracteres de control
  }
  function atributo(etiqueta, nombre) {
    var m = new RegExp('\\s' + nombre + '="([^"]*)"').exec(etiqueta);
    return m ? textoXml(m[1]) : null;
  }
  // Todo el texto de los <t> de un fragmento (también el texto con formato), sin la guía fonética <rPh>
  function textosT(xml) {
    var out = '', re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g, m;
    xml = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
    while ((m = re.exec(xml))) out += textoXml(m[1]);
    return out;
  }
  function columnaDe(ref) {
    var m = /^([A-Z]+)/.exec(ref || ''), n = 0;
    if (!m) return -1;
    for (var i = 0; i < m[1].length; i++) n = n * 26 + m[1].charCodeAt(i) - 64;
    return n - 1;
  }
  function filaDe(ref) { return parseInt(String(ref).replace(/^[A-Z]+/, ''), 10); }
  // «worksheets/sheet1.xml» desde «xl/workbook.xml» → «xl/worksheets/sheet1.xml»
  function rutaRelativa(desde, destino) {
    if (destino[0] === '/') return destino.slice(1);
    var partes = desde.split('/').slice(0, -1);
    destino.split('/').forEach(function (p) { if (p === '..') partes.pop(); else if (p && p !== '.') partes.push(p); });
    return partes.join('/');
  }
  function relaciones(xml) {
    var r = Object.create(null), re = /<Relationship\b[^>]*>/g, m;
    while ((m = re.exec(xml || ''))) { var id = atributo(m[0], 'Id'), t = atributo(m[0], 'Target'); if (id && t !== null) r[id] = t; }
    return r;
  }
  function codigoDeEnlace(url) {
    var limpio = String(url).split(/[?#]/)[0].replace(/\/+$/, '');
    return limpio.split('/').pop() || limpio;
  }

  /** Bytes de un .xlsx → filas (arreglos de textos) de su primera hoja, como leerTabla(). */
  function leerXlsx(buffer) {
    return leerZip(buffer).then(function (e) {
      var libro = e['xl/workbook.xml'];
      if (!libro) throw new Error('El archivo no es un Excel (.xlsx) válido.');
      var rutaHoja = 'xl/worksheets/sheet1.xml', hoja = /<sheet\b[^>]*>/.exec(libro);
      if (hoja) {
        var rid = atributo(hoja[0], 'r:id'), rel = relaciones(e['xl/_rels/workbook.xml.rels']);
        if (rid && rel[rid]) rutaHoja = rutaRelativa('xl/workbook.xml', rel[rid]);
      }
      var xml = e[rutaHoja];
      if (!xml) throw new Error('No encontramos la hoja de cálculo dentro del archivo.');

      var compartidos = [], reSi = /<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g, ms;
      while ((ms = reSi.exec(e['xl/sharedStrings.xml'] || ''))) compartidos.push(textosT(ms[1] || ''));

      var filas = [], reFila = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g, mf, siguiente = 1;
      while ((mf = reFila.exec(xml))) {
        var num = parseInt(atributo(mf[1], 'r'), 10) || siguiente, celdas = [], reC = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, mc, col = 0;
        siguiente = num + 1;
        while ((mc = reC.exec(mf[2] || ''))) {
          var ref = atributo(mc[1], 'r'), tipo = atributo(mc[1], 't') || 'n', cuerpo = mc[2] || '';
          var c = ref ? columnaDe(ref) : col, v = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(cuerpo), valor = '';
          if (c < 0 || c > 16383) continue;
          if (tipo === 's') valor = v ? compartidos[parseInt(v[1], 10)] || '' : '';
          else if (tipo === 'inlineStr') valor = textosT(cuerpo);
          else if (tipo === 'b') valor = v ? (v[1] === '1' ? 'VERDADERO' : 'FALSO') : '';
          else valor = v ? textoXml(v[1]) : '';
          while (celdas.length < c) celdas.push('');
          celdas[c] = valor;
          col = c + 1;
        }
        filas.push({ num: num, celdas: celdas });
      }

      // enlaces de la hoja: <hyperlink ref="P2" r:id="rId3"/> + sheet1.xml.rels
      var enlaces = Object.create(null), porColumna = {}, reH = /<hyperlink\b[^>]*>/g, mh;
      var relHoja = relaciones(e[rutaRelativa(rutaHoja, '_rels/' + rutaHoja.split('/').pop() + '.rels')]);
      while ((mh = reH.exec(xml))) {
        var rango = atributo(mh[0], 'ref'), idEnlace = atributo(mh[0], 'r:id'), destino = idEnlace ? relHoja[idEnlace] : null;
        if (!rango || !destino) continue;
        var partes = rango.split(':'), a = partes[0], z = partes[1] || partes[0];
        for (var f = filaDe(a); f <= Math.min(filaDe(z), filaDe(a) + 100000); f++) {
          for (var cc = columnaDe(a); cc <= columnaDe(z); cc++) {
            if (!(f + ':' + cc in enlaces)) porColumna[cc] = (porColumna[cc] || 0) + 1;
            enlaces[f + ':' + cc] = destino;
          }
        }
      }
      var conEnlace = Object.keys(porColumna).map(Number)
        .filter(function (c) { return porColumna[c] >= Math.max(1, (filas.length - 1) / 2); }).sort(function (x, y) { return x - y; });
      var ancho = filas.reduce(function (m, f) { return Math.max(m, f.celdas.length); }, 0);
      return filas.map(function (f, i) {
        var celdas = f.celdas.slice();
        while (celdas.length < ancho) celdas.push('');
        conEnlace.forEach(function (c) {
          var d = enlaces[f.num + ':' + c];
          // la primera fila sin enlace es la de títulos
          celdas.push(d ? codigoDeEnlace(d) : i === 0 ? 'Código del enlace (' + (limpiar(f.celdas[c]) || 'columna ' + (c + 1)) + ')' : '');
        });
        return celdas;
      }).filter(function (fila) { return fila.some(function (x) { return String(x).trim() !== ''; }); });
    });
  }

  /** «46324.7083» (número de serie de fecha de Excel) → «2026-10-29 17:00». Otros textos quedan igual. */
  function fechaDeExcel(valor) {
    var t = String(valor).trim();
    if (!/^\d{5}(\.\d+)?$/.test(t)) return valor;
    var n = parseFloat(t);
    if (n < 30000 || n > 80000) return valor;   // fuera de 1982–2119: no es una fecha
    return new Date(Math.round((n - 25569) * 864e5)).toISOString().slice(0, 16).replace('T', ' ');
  }

  /* ---------------- lista de participantes ---------------- */
  /**
   * registros: [{ id, nombre, visible, cantidad, fila }] (ya filtrados por el organizador).
   * «visible» es el dato del que se muestran los últimos 4 caracteres (por defecto, el id; null = ninguno).
   * Cada boleta es una participación; «cantidad» > 1 crea una participación por boleta.
   * Devuelve { participantes: [...], sinId, duplicados } — participantes con sal y compromiso.
   */
  function prepararParticipantes(registros) {
    var vistos = Object.create(null), lista = [], sinId = 0, duplicados = 0;
    registros.forEach(function (r) {
      var base = normalizarId(r.id);
      if (!base) { sinId++; return; }
      var n = parseInt(r.cantidad, 10);
      n = isFinite(n) && n > 1 ? Math.min(n, 100) : 1;
      for (var k = 1; k <= n; k++) {
        var id = n > 1 ? base + '#' + k : base;
        if (vistos[id]) { duplicados++; continue; }
        vistos[id] = true;
        var visible = r.visible === null ? '' : r.visible !== undefined && limpiar(r.visible) ? r.visible : r.id;
        lista.push({ id: id, idOriginal: limpiar(r.id), nombre: limpiar(r.nombre), etiqueta: etiquetaDe(r.nombre, visible, n > 1 ? k + '/' + n : ''), fila: r.fila || null, sal: salAleatoria() });
      }
    });
    return Promise.all(lista.map(function (p) { return compromisoDe(p.sal, p.id); })).then(function (cs) {
      cs.forEach(function (c, i) { lista[i].compromiso = c; lista[i].posicion = i + 1; });
      return { participantes: lista, sinId: sinId, duplicados: duplicados };
    });
  }
  function compromisoDe(sal, id) { return sha256Hex('LS-SORTEO|entrada|' + sal + '|' + id); }

  /* ---------------- acta y huella ---------------- */
  /** Texto exacto del acta. La huella del sorteo es sha256 de este texto (UTF-8). */
  function textoActa(s) {
    var l = [
      'LABS SUMMIT 2026 · ACTA DE SORTEO',
      'formato: ' + FORMATO,
      'id: ' + s.id,
      'titulo: ' + s.titulo,
      'ensayo: ' + (s.ensayo ? 'si' : 'no'),
      'cierre de lista: ' + s.cierre,
      'premios: ' + s.premios.length
    ];
    s.premios.forEach(function (p, i) { l.push('premio ' + (i + 1) + ': ' + p); });
    l.push('azar: drand ' + s.azar.red + ' ' + s.azar.hash);
    l.push('ronda: ' + s.azar.ronda);
    l.push('participantes: ' + s.participantes.length);
    l.push('---');
    s.participantes.forEach(function (p, i) { l.push((i + 1) + '|' + p[0] + '|' + p[1]); });
    return l.join('\n') + '\n';
  }
  function huellaDe(s) { return sha256Hex(textoActa(s)); }

  /** Problemas de forma del archivo público (lista vacía = todo bien). No comprueba la huella: eso es verificar(). */
  function validar(s) {
    var p = [];
    if (!s || typeof s !== 'object') return ['El archivo no es un sorteo.'];
    if (s.formato !== FORMATO) p.push('Formato desconocido.');
    if (!RE_ID.test(s.id || '')) p.push('El id del sorteo no es válido.');
    if (!esLimpio(s.titulo)) p.push('El título no es válido.');
    if (typeof s.ensayo !== 'boolean') p.push('Falta indicar si es ensayo.');
    if (!RE_FECHA.test(s.cierre || '') || isNaN(Date.parse(s.cierre))) p.push('La hora de cierre no es válida.');
    if (!Array.isArray(s.premios) || !s.premios.length || s.premios.length > 50 || !s.premios.every(esLimpio)) p.push('La lista de premios no es válida.');
    var a = s.azar || {};
    if (a.red !== RED.nombre || a.hash !== RED.hash) p.push('El azar no viene de drand ' + RED.nombre + '.');
    if (!Number.isSafeInteger(a.ronda) || a.ronda < 1) p.push('La ronda de drand no es válida.');
    if (!Array.isArray(s.participantes) || !s.participantes.length) p.push('No hay participantes.');
    else {
      var malos = s.participantes.filter(function (x) { return !Array.isArray(x) || x.length !== 2 || !esLimpio(x[0]) || !RE_HEX64.test(x[1]); }).length;
      if (malos) p.push(malos + ' participantes tienen datos con formato inválido.');
      var unicos = Object.create(null), rep = 0;
      s.participantes.forEach(function (x) { if (Array.isArray(x)) { if (unicos[x[1]]) rep++; unicos[x[1]] = true; } });
      if (rep) p.push(rep + ' compromisos repetidos: la lista no es válida.');
      if (Array.isArray(s.premios) && s.premios.length > s.participantes.length) p.push('Hay más premios que participantes.');
    }
    if (s.huella !== undefined && !RE_HEX64.test(s.huella)) p.push('La huella publicada no es válida.');
    return p;
  }

  /* ---------------- tiempo de drand ---------------- */
  /** Primera ronda que sale en el instante ms o después. */
  function rondaEn(ms) { return Math.max(1, Math.ceil((ms / 1000 - RED.genesis) / RED.periodo) + 1); }
  /** Instante (ms) en que sale la ronda r. */
  function horaDeRonda(r) { return (RED.genesis + (r - 1) * RED.periodo) * 1000; }

  /* ---------------- azar: pedir y comprobar la ronda ---------------- */
  /** Comprueba una respuesta de drand: ronda correcta, aleatorio = sha256(firma) y firma BLS válida. */
  function comprobarRonda(datos, ronda) {
    if (!datos || datos.round !== ronda || typeof datos.signature !== 'string' || typeof datos.randomness !== 'string') return null;
    var firma = datos.signature.toLowerCase(), b = bls();
    var aleatorio = b.aleatorioDeFirma(firma);
    if (!aleatorio || aleatorio !== datos.randomness.toLowerCase()) return null;
    if (!b.verificarFirma(firma, ronda, RED.clavePublica)) return null;
    return { ronda: ronda, firma: firma, aleatorio: aleatorio };
  }

  function pedirConTiempo(url, ms) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var t = setTimeout(function () { if (ctl) ctl.abort(); }, ms);
    return fetch(url, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctl ? ctl.signal : undefined })
      .finally(function () { clearTimeout(t); });
  }

  /**
   * Trae la ronda de drand desde el primer relevo que responda con una firma válida.
   * Resuelve { ronda, firma, aleatorio, relevo, url }. Rechaza con error.tipo:
   *  'pendiente' (la ronda aún no sale), 'invalida' (alguien respondió algo falso), 'red' (sin conexión).
   */
  function pedirRonda(ronda) {
    var relevos = (PRUEBA.relevos || RED.relevos).slice(), pendiente = false, invalida = false;
    function siguiente() {
      if (!relevos.length) {
        var e = new Error(pendiente ? 'La ronda aún no está disponible.' : invalida ? 'Ningún relevo dio una firma válida.' : 'No hay conexión con drand.');
        e.tipo = pendiente ? 'pendiente' : invalida ? 'invalida' : 'red';
        return Promise.reject(e);
      }
      var relevo = relevos.shift(), url = relevo + '/' + RED.hash + '/public/' + ronda;
      return pedirConTiempo(url, 8000).then(function (r) {
        if (r.status === 404 || r.status === 425) { pendiente = true; return siguiente(); }
        if (!r.ok) return siguiente();
        return r.json().then(function (datos) {
          var ok = comprobarRonda(datos, ronda);
          if (!ok) { invalida = true; return siguiente(); }
          ok.relevo = relevo; ok.url = url;
          return ok;
        }, siguiente);
      }, siguiente);
    }
    return siguiente();
  }

  /* ---------------- ganadores ---------------- */
  /**
   * Elige `cantidad` posiciones distintas (0..total-1) a partir de la huella y el aleatorio de drand.
   * Para el premio j se prueba c = 0, 1, …: x = sha256('labs-summit-sorteo/v1|huella|aleatorio|j|c') como entero
   * de 256 bits; se acepta si x < límite (múltiplo exacto de los que quedan) para no favorecer a nadie, y gana
   * el que está en la posición x mod (quedan) entre los que aún no han ganado.
   */
  function elegirGanadores(huella, aleatorio, total, cantidad) {
    if (typeof BigInt === 'undefined') return Promise.reject(new Error('Este navegador es muy antiguo para verificar el sorteo.'));
    var quedan = [], ganadores = [], DOS256 = BigInt(2) ** BigInt(256);
    for (var i = 0; i < total; i++) quedan.push(i);
    function premio(j, c) {
      if (j >= cantidad) return Promise.resolve(ganadores);
      return sha256Hex(FORMATO + '|' + huella + '|' + aleatorio + '|' + j + '|' + c).then(function (semilla) {
        var x = BigInt('0x' + semilla), m = BigInt(quedan.length), limite = (DOS256 / m) * m;
        if (x >= limite) return premio(j, c + 1);
        var k = Number(x % m);
        ganadores.push({ premio: j, indice: quedan[k], semilla: semilla, intentos: c + 1 });
        quedan.splice(k, 1);
        return premio(j + 1, 0);
      });
    }
    return premio(0, 0);
  }

  /**
   * Verificación completa de un sorteo publicado. `ronda` (opcional) es el resultado de pedirRonda().
   * Resuelve { problemas, huella, huellaOk, ronda, ganadores } sin lanzar errores por datos malos.
   */
  function verificar(s, ronda) {
    var problemas = validar(s);
    if (problemas.length) return Promise.resolve({ problemas: problemas, huellaOk: false, ganadores: [] });
    return huellaDe(s).then(function (h) {
      var res = { problemas: [], huella: h, huellaOk: s.huella === undefined || s.huella === h, ronda: ronda || null, ganadores: [] };
      if (!res.huellaOk) res.problemas.push('La huella no coincide: la lista o los datos del sorteo cambiaron después de publicarse.');
      if (!ronda || !res.huellaOk) return res;
      if (ronda.ronda !== s.azar.ronda) { res.problemas.push('La ronda de drand no es la del acta.'); return res; }
      return elegirGanadores(h, ronda.aleatorio, s.participantes.length, s.premios.length).then(function (g) {
        res.ganadores = g.map(function (x) {
          var p = s.participantes[x.indice];
          return { premio: s.premios[x.premio], numeroPremio: x.premio + 1, posicion: x.indice + 1, etiqueta: p[0], compromiso: p[1], semilla: x.semilla, intentos: x.intentos };
        });
        return res;
      });
    });
  }

  /** Comprueba que (sal, id) revelados por el organizador corresponden al compromiso de esa posición. */
  function comprobarRevelacion(s, rev) {
    if (!rev || !Number.isSafeInteger(rev.posicion) || !/^[0-9a-f]{32}$/.test(rev.sal || '') || typeof rev.id !== 'string') return Promise.resolve(false);
    var p = s.participantes[rev.posicion - 1];
    if (!p) return Promise.resolve(false);
    return compromisoDe(rev.sal, rev.id).then(function (c) { return c === p[1]; });
  }

  /** Arma el archivo público a partir de la lista preparada. */
  function armarPublico(datos, participantes) {
    var s = {
      formato: FORMATO,
      id: datos.id,
      titulo: limpiar(datos.titulo),
      ensayo: !!datos.ensayo,
      cierre: datos.cierre,
      premios: datos.premios.map(limpiar).filter(Boolean),
      azar: { red: RED.nombre, hash: RED.hash, ronda: datos.ronda },
      participantes: participantes.map(function (p) { return [p.etiqueta, p.compromiso]; })
    };
    return huellaDe(s).then(function (h) { s.huella = h; return s; });
  }

  var api = {
    FORMATO: FORMATO,
    RED: RED,
    QUICKNET: QUICKNET,
    limpiar: limpiar,
    normalizarId: normalizarId,
    nombreCorto: nombreCorto,
    idCorto: idCorto,
    etiquetaDe: etiquetaDe,
    idSorteo: idSorteo,
    decodificar: decodificar,
    leerTabla: leerTabla,
    esZip: esZip,
    leerXlsx: leerXlsx,
    fechaDeExcel: fechaDeExcel,
    prepararParticipantes: prepararParticipantes,
    compromisoDe: compromisoDe,
    textoActa: textoActa,
    huellaDe: huellaDe,
    validar: validar,
    rondaEn: rondaEn,
    horaDeRonda: horaDeRonda,
    comprobarRonda: comprobarRonda,
    pedirRonda: pedirRonda,
    elegirGanadores: elegirGanadores,
    verificar: verificar,
    comprobarRevelacion: comprobarRevelacion,
    armarPublico: armarPublico,
    sha256Hex: sha256Hex,
    RE_ID: RE_ID
  };
  raiz.LSSorteo = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
