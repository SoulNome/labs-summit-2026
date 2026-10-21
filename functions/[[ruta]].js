// Cloudflare Pages Function: responde 403 (Acceso restringido) en las rutas
// listadas en /_routes.json (carpetas internas y rutas que usan los bots que
// buscan fallas). El resto del sitio no pasa por aquí.
export async function onRequest(context) {
  let html = '<!doctype html><meta charset="utf-8"><title>Acceso restringido</title><h1>403 · Acceso restringido</h1>';
  try {
    const pagina = await context.env.ASSETS.fetch(new URL('/403.html', context.request.url));
    if (pagina.ok) html = await pagina.text();
  } catch (e) {
    // Si no se puede leer la página bonita, se responde la versión simple.
  }
  return new Response(html, {
    status: 403,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    }
  });
}
