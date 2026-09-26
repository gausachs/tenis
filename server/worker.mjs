import { handleAPI } from './api.mjs';
import html from '../versio-nova/index.html?raw';
import css from '../versio-nova/style.css?raw';
import game from '../versio-nova/script.js?raw';
import multiplayer from '../versio-nova/multiplayer.js?raw';
const assets = new Map([
  ['/', [html, 'text/html']], ['/index.html', [html, 'text/html']],
  ['/style.css', [css, 'text/css']], ['/script.js', [game, 'text/javascript']],
  ['/multiplayer.js', [multiplayer, 'text/javascript']],
]);
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/api/')) return handleAPI(request, env);
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
    const asset = assets.get(path);
    if (!asset) return new Response('Not found', { status: 404 });
    return new Response(request.method === 'HEAD' ? null : asset[0], { headers: {
      'Content-Type': `${asset[1]}; charset=utf-8`, 'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'self' https://*.chatgpt.com https://chatgpt.com; base-uri 'none'; form-action 'self'",
    } });
  }
};
