import type { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import { getDb } from '../db/index';

interface DbSchedule {
  id: string;
  name: string;
  entries: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

function parseSchedule(row: DbSchedule) {
  return {
    ...row,
    entries: JSON.parse(row.entries),
    enabled: row.enabled === 1,
  };
}

export async function scheduleRoutes(app: FastifyInstance) {
  // GET /api/schedules
  app.get('/schedules', async (_req, reply) => {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM schedules ORDER BY name ASC').all() as DbSchedule[];
    reply.send(rows.map(parseSchedule));
  });

  // GET /api/schedules/:id
  app.get<{ Params: { id: string } }>('/schedules/:id', async (req, reply) => {
    const db = getDb();
    const row = db.prepare('SELECT * FROM schedules WHERE id = ?').get(req.params.id) as DbSchedule | undefined;
    if (!row) return reply.code(404).send({ error: 'Not found' });
    reply.send(parseSchedule(row));
  });

  // POST /api/schedules
  app.post('/schedules', async (req, reply) => {
    const db = getDb();
    const body = req.body as any;
    const id = nanoid(10);
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO schedules (id, name, entries, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      body.name ?? 'New Schedule',
      JSON.stringify(body.entries ?? []),
      body.enabled !== false ? 1 : 0,
      now,
      now,
    );
    const row = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id) as DbSchedule;
    reply.code(201).send(parseSchedule(row));
  });

  // PUT /api/schedules/:id
  app.put<{ Params: { id: string } }>('/schedules/:id', async (req, reply) => {
    const db = getDb();
    const body = req.body as any;
    const now = new Date().toISOString();
    const existing = db.prepare('SELECT * FROM schedules WHERE id = ?').get(req.params.id) as DbSchedule | undefined;
    if (!existing) return reply.code(404).send({ error: 'Not found' });
    db.prepare(`
      UPDATE schedules SET name=?, entries=?, enabled=?, updated_at=? WHERE id=?
    `).run(
      body.name ?? existing.name,
      JSON.stringify(body.entries ?? JSON.parse(existing.entries)),
      body.enabled !== undefined ? (body.enabled ? 1 : 0) : existing.enabled,
      now,
      req.params.id,
    );
    const row = db.prepare('SELECT * FROM schedules WHERE id = ?').get(req.params.id) as DbSchedule;
    reply.send(parseSchedule(row));
  });

  // DELETE /api/schedules/:id
  app.delete<{ Params: { id: string } }>('/schedules/:id', async (req, reply) => {
    const db = getDb();
    db.prepare('DELETE FROM schedules WHERE id = ?').run(req.params.id);
    reply.code(204).send();
  });
}
