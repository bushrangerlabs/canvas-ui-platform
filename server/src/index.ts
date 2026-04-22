import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import staticFiles from '@fastify/static';
import path from 'path';
import { config } from './config';
import { initDb } from './db/index';
import { initWss, startHAStatePoller } from './ws/index';
import { viewRoutes } from './routes/views';
import { deviceRoutes } from './routes/devices';
import { dataSourceRoutes } from './routes/datasources';
import { imageRoutes } from './routes/images';
import { serverRoutes } from './routes/server';
import { haRoutes } from './routes/ha';

async function main() {
  // ── Database ──────────────────────────────────────────────────────────────
  initDb();

  // ── Fastify ───────────────────────────────────────────────────────────────
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'warn' },
    ignoreTrailingSlash: true,
  });

  await app.register(cors, { origin: config.corsOrigins });
  await app.register(jwt, { secret: config.jwtSecret });
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } }); // 50 MB

  // ── Routes ────────────────────────────────────────────────────────────────
  await app.register(viewRoutes,       { prefix: '/api' });
  await app.register(deviceRoutes,     { prefix: '/api' });
  await app.register(dataSourceRoutes, { prefix: '/api' });
  await app.register(imageRoutes,      { prefix: '/api' });
  await app.register(serverRoutes,     { prefix: '/api' });
  await app.register(haRoutes,         { prefix: '/api' });

  // ── Serve web SPA (editor + display) ─────────────────────────────────────
  const webRoot = path.join(__dirname, '..', 'public');
  await app.register(staticFiles, {
    root: webRoot,
    prefix: '/',
    index: 'index.html',
    decorateReply: false,
  });

  // Never cache index.html — ensures fresh asset hashes after updates
  app.addHook('onSend', async (request, reply) => {
    if (request.url === '/' || request.url.endsWith('/index.html')) {
      reply.header('Cache-Control', 'no-store');
    }
  });

  // SPA fallback — all non-API routes serve index.html
  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api') || request.url.startsWith('/ws')) {
      reply.code(404).send({ error: 'Not Found', statusCode: 404 });
      return;
    }
    reply.header('Cache-Control', 'no-store');
    return reply.sendFile('index.html', webRoot);
  });

  // Health check (no prefix)
  app.get('/health', async () => ({ ok: true }));

  // ── HTTP server + WebSocket ───────────────────────────────────────────────
  await app.ready();
  initWss(app.server);
  startHAStatePoller();

  // ── Start ─────────────────────────────────────────────────────────────────
  try {
    await app.listen({ port: config.port, host: config.host });
    const host = config.host === '0.0.0.0' ? 'localhost' : config.host;
    console.log(`\n  Canvas UI Platform server`);
    console.log(`  Mode  →  ${config.isHaAddon ? 'HA add-on' : 'standalone'}`);
    console.log(`  API   →  http://${host}:${config.port}/api`);
    console.log(`  WS    →  ws://${host}:${config.port}/ws`);
    console.log(`  DB    →  ${config.dbPath}\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

process.on('uncaughtException', (err) => {
  console.error('[canvas-ui] Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[canvas-ui] Unhandled rejection:', reason);
  process.exit(1);
});

main();
