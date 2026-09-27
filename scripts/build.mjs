import { cp, mkdir, rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('versio-nova', 'dist', { recursive: true });
// Keep existing /versio-nova/ links usable on the new host.
await cp('versio-nova', 'dist/versio-nova', { recursive: true });
console.log('Web preparat a dist/. API: api/index.js (Vercel Functions).');
