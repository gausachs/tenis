import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync('versio-nova/multiplayer.js', 'utf8');
async function createFromPage(hostname, response, apiOrigin = '') {
  const elements = new Map(); const requests = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id, { textContent: '', addEventListener(event, handler) { this[event] = handler; } });
    return elements.get(id);
  };
  const context = {
    document: { getElementById: element, addEventListener() {} },
    location: { hostname, search: '' }, window: { TENIS_API_ORIGIN: apiOrigin, addEventListener() {} },
    URLSearchParams, AbortSignal, crypto, setInterval() {},
    score: { initialServer: 'left', bestOf: 3 }, getPlayerLabel: () => 'Test',
    fetch: async (url, options) => { requests.push({ url, options }); return response; },
  };
  vm.runInNewContext(source, context);
  await element('create-room').click();
  return { requests, message: element('online-message').textContent };
}
test('Pages sends the room request to the real backend and explains HTML responses', async () => {
  const result = await createFromPage('gausachs.github.io', new Response('<html>Login</html>', { headers: { 'Content-Type': 'text/html' } }));
  assert.equal(result.requests[0].url, 'https://tenis-fate.vercel.app/api/rooms');
  assert.equal(result.requests[0].options.credentials, 'omit');
  assert.match(result.message, /demana iniciar sessió/); assert.doesNotMatch(result.message, /Unexpected token/);
});
test('local/hosted same-origin use is retained and JSON errors are readable', async () => {
  const result = await createFromPage('localhost', Response.json({ error: 'Servei temporalment no disponible.' }, { status: 503 }));
  assert.equal(result.requests[0].url, '/api/rooms'); assert.equal(result.message, 'Servei temporalment no disponible.');
});
