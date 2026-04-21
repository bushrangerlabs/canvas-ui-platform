import { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import { getDb } from '../db/index';

export async function dataSourceRoutes(app: FastifyInstance) {
  // GET /api/datasources
  app.get('/datasources', async () => {
    return getDb().prepare('SELECT id, name, type, url, enabled, created_at FROM data_sources ORDER BY name').all();
  });

  // GET /api/datasources/:id
  app.get<{ Params: { id: string } }>('/datasources/:id', async (req, reply) => {
    const row = getDb().prepare('SELECT id, name, type, url, enabled, created_at FROM data_sources WHERE id = ?').get(req.params.id);
    if (!row) return reply.code(404).send({ error: 'Data source not found' });
    return row;
  });

  // POST /api/datasources
  app.post<{ Body: any }>('/datasources', async (req, reply) => {
    const db = getDb();
    const body = req.body as any;
    const id = nanoid(10);
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO data_sources (id, name, type, url, token, enabled, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, body.name, body.type ?? 'homeassistant', body.url, body.token ?? null, 1, now);
    reply.code(201);
    return db.prepare('SELECT id, name, type, url, enabled, created_at FROM data_sources WHERE id = ?').get(id);
  });

  // PUT /api/datasources/:id
  app.put<{ Params: { id: string }; Body: any }>('/datasources/:id', async (req, reply) => {
    const db = getDb();
    const body = req.body as any;
    if (!db.prepare('SELECT id FROM data_sources WHERE id = ?').get(req.params.id))
      return reply.code(404).send({ error: 'Data source not found' });
    const updates: any = { name: body.name, type: body.type, url: body.url, enabled: body.enabled ?? 1 };
    if (body.token !== undefined) updates.token = body.token;
    const fields = Object.keys(updates).map(k => `${k}=?`).join(', ');
    db.prepare(`UPDATE data_sources SET ${fields} WHERE id=?`).run(...Object.values(updates), req.params.id);
    return db.prepare('SELECT id, name, type, url, enabled, created_at FROM data_sources WHERE id = ?').get(req.params.id);
  });

  // DELETE /api/datasources/:id
  app.delete<{ Params: { id: string } }>('/datasources/:id', async (req, reply) => {
    const db = getDb();
    if (!db.prepare('SELECT id FROM data_sources WHERE id = ?').get(req.params.id))
      return reply.code(404).send({ error: 'Data source not found' });
    db.prepare('DELETE FROM data_sources WHERE id = ?').run(req.params.id);
    return { success: true };
  });

  // POST /api/datasources/:id/test
  app.post<{ Params: { id: string } }>('/datasources/:id/test', async (req, reply) => {
    const row = getDb().prepare('SELECT * FROM data_sources WHERE id = ?').get(req.params.id) as any;
    if (!row) return reply.code(404).send({ error: 'Data source not found' });

    if (row.type === 'homeassistant') {
      try {
        const url = `${row.url.replace(/\/$/, '')}/api/`;
        const r = await fetch(url, {
          headers: row.token ? { Authorization: `Bearer ${row.token}` } : {},
          signal: AbortSignal.timeout(5000),
        });
        if (r.ok) return { success: true, status: r.status };
        return reply.code(502).send({ success: false, status: r.status, error: r.statusText });
      } catch (e: any) {
        return reply.code(502).send({ success: false, error: e.message });
      }
    }

    return reply.code(400).send({ error: `No test implementation for type "${row.type}"` });
  });
}
