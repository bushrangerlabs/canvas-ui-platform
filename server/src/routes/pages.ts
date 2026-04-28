import { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import { getDb } from '../db/index';
import { sendCommand } from '../ws/index';

/**
 * Pages — named display slots, each pointing to a canvas-ui-hacs view.
 *
 * A device is assigned a page. The kiosk loads:
 *   http://<ha_host>/canvas-kiosk#<canvas_view_id>
 */
export async function pageRoutes(app: FastifyInstance) {

  // GET /api/pages
  app.get('/pages', async () => {
    return getDb().prepare('SELECT * FROM pages ORDER BY name').all();
  });

  // GET /api/pages/:id
  app.get<{ Params: { id: string } }>('/pages/:id', async (req, reply) => {
    const page = getDb().prepare('SELECT * FROM pages WHERE id = ?').get(req.params.id);
    if (!page) return reply.code(404).send({ error: 'Page not found' });
    return page;
  });

  // POST /api/pages  { name, canvas_view_id }
  app.post<{ Body: any }>('/pages', async (req, reply) => {
    const db = getDb();
    const { name = 'New Page', canvas_view_id = null } = req.body as any;
    const id = nanoid(10);
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO pages (id, name, canvas_view_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, name, canvas_view_id, now, now);
    reply.code(201);
    return db.prepare('SELECT * FROM pages WHERE id = ?').get(id);
  });

  // PATCH /api/pages/:id  { name?, canvas_view_id? }
  app.patch<{ Params: { id: string }; Body: any }>('/pages/:id', async (req, reply) => {
    const db = getDb();
    const { id } = req.params;
    if (!db.prepare('SELECT id FROM pages WHERE id = ?').get(id))
      return reply.code(404).send({ error: 'Page not found' });

    const fields: string[] = [];
    const vals: any[] = [];
    for (const f of ['name', 'canvas_view_id']) {
      if ((req.body as any)[f] !== undefined) {
        fields.push(`${f}=?`);
        vals.push((req.body as any)[f]);
      }
    }
    if (fields.length) {
      fields.push('updated_at=?');
      vals.push(new Date().toISOString(), id);
      db.prepare(`UPDATE pages SET ${fields.join(', ')} WHERE id=?`).run(...vals);
    }
    return db.prepare('SELECT * FROM pages WHERE id = ?').get(id);
  });

  // DELETE /api/pages/:id
  app.delete<{ Params: { id: string } }>('/pages/:id', async (req, reply) => {
    const db = getDb();
    if (!db.prepare('SELECT id FROM pages WHERE id = ?').get(req.params.id))
      return reply.code(404).send({ error: 'Page not found' });
    db.prepare('UPDATE devices SET assigned_page_id=NULL WHERE assigned_page_id=?').run(req.params.id);
    db.prepare('DELETE FROM pages WHERE id = ?').run(req.params.id);
    return { success: true };
  });

  // POST /api/pages/:id/push  — tell all assigned devices to reload
  app.post<{ Params: { id: string } }>('/pages/:id/push', async (req, reply) => {
    const db = getDb();
    const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.id) as any;
    if (!page) return reply.code(404).send({ error: 'Page not found' });

    const devices = db.prepare('SELECT id FROM devices WHERE assigned_page_id=?').all(page.id) as any[];
    for (const dev of devices) {
      sendCommand(dev.id, {
        type: 'load_view',
        canvas_view_id: page.canvas_view_id,
      });
    }
    return { pushed_to: devices.length };
  });
}
