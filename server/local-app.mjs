import { handleAPI } from './api.mjs';
import html from '../versio-nova/index.html?raw';
import css from '../versio-nova/style.css?raw';
import game from '../versio-nova/script.js?raw';
import multiplayer from '../versio-nova/multiplayer.js?raw';
import computer from '../versio-nova/computer.js?raw';
import reserveHtml from '../reserva-daus/index.html?raw';
import reserveCss from '../reserva-daus/style.css?raw';
import reserveGame from '../reserva-daus/script.js?raw';
import reserveRules from '../reserva-daus/reserve.js?raw';
import reserveMultiplayer from '../reserva-daus/multiplayer.js?raw';
import reserveComputer from '../reserva-daus/computer.js?raw';
import reserveManual from '../reserva-daus/manual.html?raw';
import reserveManualCss from '../reserva-daus/manual.css?raw';
import reserveManualText from '../reserva-daus/manual.md?raw';
import { readFile } from 'node:fs/promises';
const assets = new Map([
  ['/', [html, 'text/html']], ['/index.html', [html, 'text/html']],
  ['/style.css', [css, 'text/css']], ['/script.js', [game, 'text/javascript']],
  ['/multiplayer.js', [multiplayer, 'text/javascript']],
  ['/computer.js', [computer, 'text/javascript']],
  ['/reserva-daus/', [reserveHtml, 'text/html']],
  ['/reserva-daus/index.html', [reserveHtml, 'text/html']],
  ['/reserva-daus/style.css', [reserveCss, 'text/css']],
  ['/reserva-daus/script.js', [reserveGame, 'text/javascript']],
  ['/reserva-daus/reserve.js', [reserveRules, 'text/javascript']],
  ['/reserva-daus/computer.js', [reserveComputer, 'text/javascript']],
  ['/reserva-daus/multiplayer.js', [reserveMultiplayer, 'text/javascript']],
  ['/reserva-daus/manual.html', [reserveManual, 'text/html']],
  ['/reserva-daus/manual.css', [reserveManualCss, 'text/css']],
  ['/reserva-daus/manual.md', [reserveManualText, 'text/plain']],
]);
export default {
  async fetch(request, env) {
    let path = new URL(request.url).pathname;
    if (path.startsWith('/versio-nova/')) path = path.replace('/versio-nova', '');
    if (path.startsWith('/api/')) return handleAPI(request, env);
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
    if (path === '/reserva-daus') return Response.redirect(new URL('/reserva-daus/', request.url), 302);
    if (path === '/reserva-daus/manual.pdf') {
      return new Response(request.method === 'HEAD' ? null : await readFile('reserva-daus/manual.pdf'), { headers: { 'Content-Type': 'application/pdf' } });
    }
    const asset = assets.get(path);
    if (!asset) return new Response('Not found', { status: 404 });
    return new Response(request.method === 'HEAD' ? null : asset[0], { headers: {
      'Content-Type': `${asset[1]}; charset=utf-8`, 'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'self'; base-uri 'none'; form-action 'self'",
    } });
  }
};
