/* Registro del sorteo en vivo y publicación de sorteos · Cloudflare Pages Function

   GET  /api/participa      → { abierto, total }                         público, caché de 15 s
   POST /api/participa      → inscribe { nombre, celular, autoriza }     público, con límites
   GET  /api/registros      → { abierto, total, registros: [...] }       solo con la clave del sorteo
   POST /api/registros      → { accion: 'abrir' | 'cerrar' | 'quitar' | 'vaciar' }   solo con la clave
   GET  /api/sorteos        → { sorteos: [...] }                         público, caché de 15 s
   GET  /api/sorteos?id=…   → el archivo público de ese sorteo           público, caché de 15 s
   POST /api/sorteos        → publica un archivo de sorteo, o { accion: 'borrar', id }   solo con la clave

   En Cloudflare necesita la base D1 enlazada como SORTEO_DB y el secreto SORTEO_CLAVE.
   Mientras no estén, responde 503 y el resto del sitio sigue igual: los archivos
   estáticos no pasan por aquí (ver _routes.json). */
import N from '../../sorteos/sorteo-nucleo.js';

const CABECERAS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'"
};
const json = (datos, status = 200, extra = {}) => new Response(typeof datos === 'string' ? datos : JSON.stringify(datos), { status, headers: { ...CABECERAS, ...extra } });
const PUBLICO_15S = { 'Cache-Control': 'public, max-age=15' };
const MAX_SORTEO = 1900000;   // D1 guarda filas de hasta 2 MB: alcanza para unas 20.000 participaciones

// Las tablas se crean solas la primera vez (no hay que correr nada en la consola de D1)
const ESQUEMA = [
  'CREATE TABLE IF NOT EXISTS registros (celular TEXT PRIMARY KEY, nombre TEXT NOT NULL, creado TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS ajustes (clave TEXT PRIMARY KEY, valor TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS limites (clave TEXT PRIMARY KEY, n INTEGER NOT NULL, hasta INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS sorteos (id TEXT PRIMARY KEY, huella TEXT NOT NULL, titulo TEXT NOT NULL, ensayo INTEGER NOT NULL, ronda INTEGER NOT NULL, participantes INTEGER NOT NULL, publicado TEXT NOT NULL, datos TEXT NOT NULL)',
  "INSERT OR IGNORE INTO ajustes (clave, valor) VALUES ('abierto', '1'), ('total', '0')",
  "CREATE TRIGGER IF NOT EXISTS contar_registro AFTER INSERT ON registros BEGIN UPDATE ajustes SET valor = CAST(valor AS INTEGER) + 1 WHERE clave = 'total'; END"
];
let esquemaListo = null;
function preparar(db) {
  if (!esquemaListo) esquemaListo = db.batch(ESQUEMA.map((q) => db.prepare(q))).catch((e) => { esquemaListo = null; throw e; });
  return esquemaListo;
}
async function valor(db, clave) {
  const f = await db.prepare('SELECT valor FROM ajustes WHERE clave = ?1').bind(clave).first();
  return f ? f.valor : null;
}
const recontar = (db) => db.prepare("UPDATE ajustes SET valor = CAST((SELECT COUNT(*) FROM registros) AS TEXT) WHERE clave = 'total'");

async function sha256(texto) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
// Lee el cuerpo sin pasar de `max` bytes (null si es más largo)
async function leerTexto(request, max) {
  if (Number(request.headers.get('Content-Length') || 0) > max) return null;
  if (!request.body) return '';
  const lector = request.body.getReader(), partes = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) { lector.cancel().catch(() => {}); return null; }
    partes.push(value);
  }
  const todo = new Uint8Array(total);
  let o = 0;
  for (const p of partes) { todo.set(p, o); o += p.byteLength; }
  return new TextDecoder().decode(todo);
}
function leerJSON(texto) {
  try { const d = JSON.parse(texto); return d && typeof d === 'object' && !Array.isArray(d) ? d : null; } catch (e) { return null; }
}

// Cuenta pedidos por conexión en ventanas de tiempo; la IP se guarda solo como hash y se borra en una hora
async function dentroDelLimite(db, clave, maximo, ventana) {
  const ahora = Math.floor(Date.now() / 1000), cubeta = Math.floor(ahora / ventana);
  const fila = await db.prepare('INSERT INTO limites (clave, n, hasta) VALUES (?1, 1, ?2) ON CONFLICT(clave) DO UPDATE SET n = n + 1 RETURNING n')
    .bind(clave + ':' + cubeta, (cubeta + 1) * ventana).first();
  if (Math.random() < 0.02) await db.prepare('DELETE FROM limites WHERE hasta < ?1').bind(ahora - 3600).run();
  return !fila || fila.n <= maximo;
}
async function quien(request, env) {
  return (await sha256((env.SORTEO_CLAVE || '-') + '|' + (request.headers.get('CF-Connecting-IP') || 'local'))).slice(0, 24);
}
function mismoOrigen(request) {
  const o = request.headers.get('Origin');
  return !o || o === new URL(request.url).origin;
}

// Respuestas públicas guardadas 15 s en la caché de Cloudflare (se borran al cambiar algo)
const cache = () => (typeof caches !== 'undefined' ? caches.default : null);
const claveCache = (request, ruta) => new Request(new URL(ruta, request.url).toString());
async function conCache(request, context, ruta, crear) {
  const c = cache(), k = claveCache(request, ruta);
  const guardada = c ? await c.match(k).catch(() => null) : null;
  if (guardada) return guardada;
  const r = await crear();
  if (c && r.status === 200) context.waitUntil(c.put(k, r.clone()).catch(() => {}));
  return r;
}
async function olvidar(request, rutas) {
  const c = cache();
  if (c) await Promise.all(rutas.map((ruta) => c.delete(claveCache(request, ruta)).catch(() => {})));
}

/* ---------------- registro público ---------------- */
// Sin caracteres invisibles ni de control; solo letras, espacios, apóstrofos, puntos y guiones
function limpiarNombre(v) {
  const t = N.limpiar(String(v ?? '').slice(0, 200).replace(/[​-‏‪-‮⁠-⁯﻿]/g, '').replace(/[^\p{L}\p{M}\s'’.-]/gu, ' ')).slice(0, 80).trim();
  return t.length >= 3 && /\p{L}.*\p{L}/u.test(t) ? t : null;
}
// Celular de Colombia (3xx…) o internacional con +; «+57 300 123 4567» y «3001234567» son el mismo
function limpiarCelular(v) {
  const c = N.normalizarId(String(v ?? '').slice(0, 40));
  return /^(3\d{9}|\+\d{10,15})$/.test(c) ? c : null;
}

function estado(request, db, context) {
  return conCache(request, context, '/api/participa?estado', async () => {
    await preparar(db);
    const [a, t] = await Promise.all([valor(db, 'abierto'), valor(db, 'total')]);
    return json({ abierto: a === '1', total: Number(t) || 0 }, 200, PUBLICO_15S);
  });
}

async function inscribir(request, env, db) {
  if (!mismoOrigen(request)) return json({ error: 'Origen no permitido.' }, 403);
  if (!/application\/json/i.test(request.headers.get('Content-Type') || '')) return json({ error: 'Formato no válido.' }, 415);
  const texto = await leerTexto(request, 2000);
  if (texto === null) return json({ error: 'Los datos son demasiado largos.' }, 413);
  const d = leerJSON(texto);
  if (!d) return json({ error: 'Datos no válidos.' }, 400);
  const nombre = limpiarNombre(d.nombre), celular = limpiarCelular(d.celular), errores = {};
  if (!nombre) errores.nombre = 'Escribe tu nombre completo.';
  if (!celular) errores.celular = 'Escribe tu celular de 10 dígitos (empieza por 3).';
  if (d.autoriza !== true) errores.autoriza = 'Para participar debes autorizar el uso de tus datos en el sorteo.';
  if (Object.keys(errores).length) return json({ error: 'Revisa los datos marcados.', errores }, 400);

  await preparar(db);
  // Generoso: en el evento muchos celulares salen a internet por la misma IP (el wifi del lugar)
  const limite = parseInt(env.SORTEO_LIMITE_IP, 10) || 1500;
  if (!(await dentroDelLimite(db, 'r:' + (await quien(request, env)), limite, 300))) {
    return json({ error: 'Hay demasiados registros desde esta conexión. Espera unos minutos o usa tus datos móviles.' }, 429, { 'Retry-After': '120' });
  }
  if (typeof d.sitio === 'string' && d.sitio) return json({ ok: true, nuevo: true, etiqueta: N.etiquetaDe(nombre, celular) }, 201);   // campo trampa: solo lo llena un robot
  if ((await valor(db, 'abierto')) !== '1') return json({ error: 'El registro está cerrado por ahora.', cerrado: true }, 409);
  const r = await db.prepare('INSERT INTO registros (celular, nombre, creado) VALUES (?1, ?2, ?3) ON CONFLICT(celular) DO NOTHING')
    .bind(celular, nombre, new Date().toISOString()).run();
  const nuevo = !!(r.meta && r.meta.changes);
  // Si el celular ya estaba, se responde con el nombre con que quedó registrado
  const guardado = nuevo ? nombre : ((await db.prepare('SELECT nombre FROM registros WHERE celular = ?1').bind(celular).first()) || {}).nombre || nombre;
  return json({ ok: true, nuevo, etiqueta: N.etiquetaDe(guardado, celular), total: Number(await valor(db, 'total')) || 0 }, nuevo ? 201 : 200);
}

/* ---------------- organizador (con la clave) ---------------- */
// 'si' · 'no' · 'bloqueado' (muchos intentos fallidos) · 'sin-clave' (falta configurarla)
async function permiso(request, env, db) {
  const clave = env.SORTEO_CLAVE;
  if (!clave || clave.length < 12) return 'sin-clave';
  const dada = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const [a, b] = await Promise.all([sha256('c|' + dada), sha256('c|' + clave)]);
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  if (dada && dif === 0) return 'si';
  return (await dentroDelLimite(db, 'a:' + (await quien(request, env)), 20, 600)) ? 'no' : 'bloqueado';
}
async function sinPermiso(request, env, db) {
  if (!mismoOrigen(request)) return json({ error: 'Origen no permitido.' }, 403);
  await preparar(db);
  const p = await permiso(request, env, db);
  if (p === 'sin-clave') return json({ error: 'Falta la clave del sorteo: en Settings → Variables and Secrets, agrega un Secret llamado SORTEO_CLAVE (mínimo 12 caracteres) y vuelve a publicar.', configurado: false }, 503);
  if (p === 'bloqueado') return json({ error: 'Demasiados intentos con una clave incorrecta. Espera 10 minutos.' }, 429, { 'Retry-After': '600' });
  if (p !== 'si') return json({ error: 'Clave incorrecta.' }, 401);
  return null;
}

async function registros(request, env, db) {
  const no = await sinPermiso(request, env, db);
  if (no) return no;
  if (request.method === 'POST') {
    const d = leerJSON((await leerTexto(request, 500)) || '');
    const accion = d && d.accion;
    if (accion === 'abrir' || accion === 'cerrar') {
      await db.prepare("UPDATE ajustes SET valor = ?1 WHERE clave = 'abierto'").bind(accion === 'abrir' ? '1' : '0').run();
    } else if (accion === 'quitar') {
      const celular = limpiarCelular(d.celular);
      if (!celular) return json({ error: 'Ese celular no es válido.' }, 400);
      const r = await db.prepare('DELETE FROM registros WHERE celular = ?1').bind(celular).run();
      if (!(r.meta && r.meta.changes)) return json({ error: 'Ese celular no está registrado.' }, 404);
      await recontar(db).run();
    } else if (accion === 'vaciar') {
      if (d.confirmar !== 'VACIAR') return json({ error: 'Falta confirmar con la palabra VACIAR.' }, 400);
      await db.batch([db.prepare('DELETE FROM registros'), recontar(db)]);
    } else return json({ error: 'Acción no válida.' }, 400);
    await olvidar(request, ['/api/participa?estado']);
  }
  const filas = await db.prepare('SELECT nombre, celular, creado FROM registros ORDER BY creado, celular').all();
  return json({ abierto: (await valor(db, 'abierto')) === '1', total: filas.results.length, registros: filas.results });
}

/* ---------------- sorteos publicados ---------------- */
function listaSorteos(request, db, context) {
  return conCache(request, context, '/api/sorteos?lista', async () => {
    await preparar(db);
    const f = await db.prepare('SELECT id, titulo, ensayo, ronda, participantes, huella, publicado FROM sorteos ORDER BY ronda DESC LIMIT 300').all();
    return json({ formato: N.FORMATO, sorteos: f.results.map((x) => ({ ...x, ensayo: !!x.ensayo })) }, 200, PUBLICO_15S);
  });
}
function unSorteo(request, db, context, id) {
  if (!N.RE_ID.test(id)) return json({ error: 'Ese sorteo no existe.' }, 404);
  return conCache(request, context, '/api/sorteos?id=' + id, async () => {
    await preparar(db);
    const f = await db.prepare('SELECT datos, publicado FROM sorteos WHERE id = ?1').bind(id).first();
    if (!f) return json({ error: 'Ese sorteo no existe.' }, 404);
    return json(f.datos, 200, { ...PUBLICO_15S, 'X-Sorteo-Publicado': f.publicado });
  });
}
// El archivo se guarda tal cual: lo verifica el navegador de cada persona (huella y firma de drand).
// Aquí solo se revisa la forma y que un sorteo oficial se publique ANTES de que salga su ronda.
async function publicar(request, env, db) {
  const no = await sinPermiso(request, env, db);
  if (no) return no;
  const texto = await leerTexto(request, MAX_SORTEO);
  if (texto === null) return json({ error: 'El sorteo es demasiado grande para publicarlo aquí. Descárgalo y súbelo a GitHub.' }, 413);
  const s = leerJSON(texto);
  if (!s) return json({ error: 'Datos no válidos.' }, 400);
  if (s.accion === 'borrar') {
    if (typeof s.id !== 'string' || !N.RE_ID.test(s.id)) return json({ error: 'Ese sorteo no existe.' }, 404);
    const r = await db.prepare('DELETE FROM sorteos WHERE id = ?1').bind(s.id).run();
    await olvidar(request, ['/api/sorteos?lista', '/api/sorteos?id=' + s.id]);
    return r.meta && r.meta.changes ? json({ ok: true }) : json({ error: 'Ese sorteo no existe.' }, 404);
  }
  const ronda = s.azar && s.azar.ronda;
  if (s.formato !== N.FORMATO || typeof s.id !== 'string' || !N.RE_ID.test(s.id) || typeof s.huella !== 'string' || !/^[0-9a-f]{64}$/.test(s.huella) ||
      typeof s.titulo !== 'string' || !Number.isSafeInteger(ronda) || ronda < 1 || !Array.isArray(s.participantes) || !s.participantes.length) {
    return json({ error: 'Ese archivo no es un sorteo válido.' }, 400);
  }
  const ensayo = s.ensayo === true;
  const ya = await db.prepare('SELECT huella FROM sorteos WHERE id = ?1').bind(s.id).first();
  if (ya && ya.huella !== s.huella) return json({ error: 'Ya hay un sorteo publicado con ese nombre y otra lista. Cambia el título o la hora.' }, 409);
  if (!ya && !ensayo && N.horaDeRonda(ronda) <= Date.now()) {
    return json({ error: 'La hora del sorteo ya pasó: un sorteo oficial se publica antes de que salga su número.' }, 409);
  }
  const titulo = N.limpiar(s.titulo).slice(0, 120);
  if (ya) await db.prepare('UPDATE sorteos SET datos = ?2 WHERE id = ?1').bind(s.id, texto).run();   // misma lista: p. ej. con la revelación
  else {
    await db.prepare('INSERT INTO sorteos (id, huella, titulo, ensayo, ronda, participantes, publicado, datos) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)')
      .bind(s.id, s.huella, titulo, ensayo ? 1 : 0, ronda, s.participantes.length, new Date().toISOString(), texto).run();
  }
  await olvidar(request, ['/api/sorteos?lista', '/api/sorteos?id=' + s.id]);
  return json({ ok: true, id: s.id, nuevo: !ya }, ya ? 200 : 201);
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url), ruta = url.pathname.replace(/\/+$/, '');
  try {
    if (ruta !== '/api/participa' && ruta !== '/api/registros' && ruta !== '/api/sorteos') return json({ error: 'No existe.' }, 404);
    if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405, { Allow: 'GET, POST' });
    const db = env.SORTEO_DB;
    if (!db || typeof db.prepare !== 'function') {
      // Dice qué falta en Cloudflare, para arreglarlo sin adivinar (no revela nada secreto)
      const motivo = db === undefined
        ? 'Falta enlazar la base: en Settings → Bindings (entorno Production), Add → D1 database, con el nombre SORTEO_DB. Luego hay que volver a publicar (Deployments → Retry deployment).'
        : 'SORTEO_DB está creada como variable de texto: bórrala de Variables and Secrets y agrégala en Settings → Bindings como «D1 database». Luego vuelve a publicar.';
      return json({ error: 'El registro todavía no está activado.', configurado: false, motivo }, 503);
    }
    const post = request.method === 'POST';
    if (ruta === '/api/registros') return await registros(request, env, db);
    if (ruta === '/api/sorteos') {
      if (post) return await publicar(request, env, db);
      return url.searchParams.has('id') ? await unSorteo(request, db, context, url.searchParams.get('id')) : await listaSorteos(request, db, context);
    }
    return post ? await inscribir(request, env, db) : await estado(request, db, context);
  } catch (e) {
    console.error('api sorteo:', (e && e.stack) || e);
    return json({ error: 'Error interno. Inténtalo de nuevo en un momento.' }, 500);
  }
}
