import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import { createServer } from 'http';
import { config } from './config';
import { initDb } from './db/index';
import { initWss } from './ws/index';
import { viewRoutes } from './routes/views';
import { deviceRoutes } from './routes/devices';
import { dataSourceRoutes } from './routes/datasources';
import { imageRoutes } from './routes/images';
import { serverRoutes } from './routes/server';

async function main() {
  // ── Database ──────────────────────────────────────────────────────────────
  initDb();

  // ── Fastify ───────────────────────────────────────────────────────────────
  const app = Fastify({ logger: { level: 'info' } });

  await app.register(cors, { origin: config.corsOrigins });
  await app.register(jwt, { secret: config.jwtSecret });
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } }); // 50 MB

  // ── Routes ────────────────────────────────────────────────────────────────
  await app.register(viewRoutes,       { prefix: '/api' });
  await app.register(deviceRoutes,     { prefix: '/api' });
  await app.register(dataSourceRoutes, { prefix: '/api' });
  await app.register(imageRoutes,      { prefix: '/api' });
  await app.register(serverRoutes,     { prefix: '/api' });

  // Health check (no prefix)
  app.get('/health', async () => ({ ok: true }));

  // ── HTTP server + WebSocket ───────────────────────────────────────────────
  // We use a raw http.Server so we can attach the WebSocketServer to it
  await app.ready();
  const httpServer = createServer(app.server);
  // Detach Fastify from its built-in server and reattach to ours
  // Actually: Fastify already owns a server; we attach wss to it directly
  initWss(app.server);

  // ── Start ─────────────────────────────────────────────────────────────────
  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`\n  Canvas UI Platform server`);
    console.log(`  API   →  http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}/api`);
    console.log(`  WS    →  ws://localhost:${config.port}/ws`);
    console.log(`  DB    →  ${config.dbPath}\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
