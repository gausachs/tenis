import { defineConfig } from 'vite';
import { createLocalDB } from './server/local-db.mjs';
export default defineConfig({
  plugins: [{
    name: 'tenis-local-server',
    configureServer(server) {
      const db = createLocalDB('.local/tenis.sqlite');
      server.httpServer?.on('close', () => db.close());
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith('/@') || req.url?.startsWith('/node_modules')) return next();
        try {
          const app = await server.ssrLoadModule('/server/local-app.mjs');
          const url = `http://${req.headers.host}${req.url}`;
          const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : req;
          const response = await app.default.fetch(new Request(url, { method: req.method, headers: req.headers, body, ...(body ? { duplex: 'half' } : {}) }), { DB: db });
          res.writeHead(response.status, Object.fromEntries(response.headers));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (error) { next(error); }
      });
    },
  }],
});
