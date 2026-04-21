import { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import { getDb } from '../db/index';
import { broadcast } from '../ws/index';

export async function viewRoutes(app: FastifyInstance) {
  // GET /api/views
  app.get('/views', async () => {
    const rows = getDb().prepare('SELECT * FROM views ORDER BY updated_at DESC').all();
    return rows.map(parseView);
  });

  // GET /api/views/:id
  app.get<{ Params: { id: string } }>('/views/:id', async (req, reply) => {
    const row = getDb().prepare('SELECT * FROM views WHERE id = ?').get(req.params.id);
    if (!row) return reply.code(404).send({ error: 'View not found' });
    return parseView(row as any);
  });

  // POST /api/views
  app.post<{ Body: any }>('/views', async (req, reply) => {
    const db = getDb();
    const body = req.body as any;
    const id = body.id ?? nanoid(10);
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO views (id, name, description, width, height, background, widgets, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      body.name ?? 'Untitled View',
      body.description ?? null,
      body.width ?? 1920,
      body.height ?? 1080,
      body.background ?? null,
      JSON.stringify(body.widgets ?? []),
      JSON.stringify(body.tags ?? []),
      now,
      now,
    );
    const row = db.prepare('SELECT * FROM views WHERE id = ?').get(id);
    reply.code(201);
    return parseView(row as any);
  });

  // PUT /api/views/:id  (full replace)
  app.put<{ Params: { id: string }; Body: any }>('/views/:id', async (req, reply) => {
    const db = getDb();
    const body = req.body as any;
    const existing = db.prepare('SELECT id FROM views WHERE id = ?').get(req.params.id);
    if (!existing) return reply.code(404).send({ error: 'View not found' });
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE views SET name=?, description=?, width=?, height=?, background=?, widgets=?, tags=?, updated_at=?
      WHERE id=?
    `).run(
      body.name,
      body.description ?? null,
      body.width ?? 1920,
      body.height ?? 1080,
      body.background ?? null,
      JSON.stringify(body.widgets ?? []),
      JSON.stringify(body.tags ?? []),
      now,
      req.params.id,
    );
    broadcast({ type: 'view_updated', view_id: req.params.id, updated_at: now });
    return parseView(db.prepare('SELECT * FROM views WHERE id = ?').get(req.params.id) as any);
  });

  // PATCH /api/views/:id  (partial update)
  app.patch<{ Params: { id: string }; Body: any }>('/views/:id', async (req, reply) => {
    const db = getDb();
    const body = req.body as any;
    const existing = db.prepare('SELECT * FROM views WHERE id = ?').get(req.params.id) as any;
    if (!existing) return reply.code(404).send({ error: 'View not found' });
    const now = new Date().toISOString();
    const merged = {
      name: body.name ?? existing.name,
      description: body.description !== undefined ? body.description : existing.description,
      width: body.width ?? existing.width,
      height: body.height ?? existing.height,
      background: body.background !== undefined ? body.background : existing.background,
      widgets: body.widgets !== undefined ? JSON.stringify(body.widgets) : existing.widgets,
      tags: body.tags !== undefined ? JSON.stringify(body.tags) : existing.tags,
    };
    db.prepare(`
      UPDATE views SET name=?, description=?, width=?, height=?, background=?, widgets=?, tags=?, updated_at=?
      WHERE id=?
    `).run(merged.name, merged.description, merged.width, merged.height, merged.background, merged.widgets, merged.tags, now, req.params.id);
    broadcast({ type: 'view_updated', view_id: req.params.id, updated_at: now });
    return parseView(db.prepare('SELECT * FROM views WHERE id = ?').get(req.params.id) as any);
  });

  // DELETE /api/views/:id
  app.delete<{ Params: { id: string } }>('/views/:id', async (req, reply) => {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM views WHERE id = ?').get(req.params.id);
    if (!existing) return reply.code(404).send({ error: 'View not found' });
    db.prepare('DELETE FROM views WHERE id = ?').run(req.params.id);
    broadcast({ type: 'view_deleted', view_id: req.params.id });
    return { success: true };
  });

  // POST /api/views/:id/duplicate
  app.post<{ Params: { id: string }; Body: any }>('/views/:id/duplicate', async (req, reply) => {
    const db = getDb();
    const source = db.prepare('SELECT * FROM views WHERE id = ?').get(req.params.id) as any;
    if (!source) return reply.code(404).send({ error: 'View not found' });
    const newId = nanoid(10);
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO views (id, name, description, width, height, background, widgets, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(newId, `${source.name} (copy)`, source.description, source.width, source.height, source.background, source.widgets, source.tags, now, now);
    reply.code(201);
    return parseView(db.prepare('SELECT * FROM views WHERE id = ?').get(newId) as any);
  });
}

function parseView(row: any) {
  return {
    ...row,
    widgets: JSON.parse(row.widgets ?? '[]'),
    tags: JSON.parse(row.tags ?? '[]'),
  };
}
