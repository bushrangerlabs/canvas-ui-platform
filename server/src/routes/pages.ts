import { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import { getDb } from '../db/index';
import { sendCommand } from '../ws/index';

export async function pageRoutes(app: FastifyInstance) {

  // GET /api/pages
  app.get('/pages', async () => {
    const db = getDb();
    const pages = db.prepare('SELECT * FROM pages ORDER BY name').all() as any[];
    return pages.map(p => parsePage(db, p));
  });

  // GET /api/pages/:id
  app.get<{ Params: { id: string } }>('/pages/:id', async (req, reply) => {
    const db = getDb();
    const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.id) as any;
    if (!page) return reply.code(404).send({ error: 'Page not found' });
    return parsePage(db, page);
  });

  // POST /api/pages
  app.post<{ Body: any }>('/pages', async (req, reply) => {
    const db = getDb();
    const body = req.body as any;
    const id = nanoid(10);
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO pages (id, name, swipe_left_page_id, swipe_right_page_id, floating_config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      body.name ?? 'New Page',
      body.swipe_left_page_id ?? null,
      body.swipe_right_page_id ?? null,
      body.floating_config ? JSON.stringify(body.floating_config) : null,
      now,
      now,
    );
    if (Array.isArray(body.panels)) {
      const ins = db.prepare(`
        INSERT INTO page_panels (id, page_id, name, x, y, w, h, view_id, url, position)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      body.panels.forEach((p: any, i: number) =>
        ins.run(nanoid(8), id, p.name ?? `panel_${i}`, p.x ?? 0, p.y ?? 0, p.w ?? 100, p.h ?? 100, p.view_id ?? null, p.url ?? null, i),
      );
    }
    reply.code(201);
    return parsePage(db, db.prepare('SELECT * FROM pages WHERE id = ?').get(id));
  });

  // PATCH /api/pages/:id  (update name / swipe links / floating config; optionally replace panels)
  app.patch<{ Params: { id: string }; Body: any }>('/pages/:id', async (req, reply) => {
    const db = getDb();
    const { id } = req.params;
    const body = req.body as any;
    if (!db.prepare('SELECT id FROM pages WHERE id = ?').get(id))
      return reply.code(404).send({ error: 'Page not found' });

    const fields: string[] = [];
    const vals: any[] = [];
    for (const f of ['name', 'swipe_left_page_id', 'swipe_right_page_id']) {
      if (body[f] !== undefined) { fields.push(`${f}=?`); vals.push(body[f]); }
    }
    if (body.floating_config !== undefined) {
      fields.push('floating_config=?');
      vals.push(body.floating_config ? JSON.stringify(body.floating_config) : null);
    }
    if (fields.length) {
      fields.push('updated_at=?');
      vals.push(new Date().toISOString());
      vals.push(id);
      db.prepare(`UPDATE pages SET ${fields.join(', ')} WHERE id=?`).run(...vals);
    }

    if (Array.isArray(body.panels)) {
      db.transaction(() => {
        db.prepare('DELETE FROM page_panels WHERE page_id=?').run(id);
        const ins = db.prepare(`
          INSERT INTO page_panels (id, page_id, name, x, y, w, h, view_id, url, position)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        body.panels.forEach((p: any, i: number) =>
          ins.run(p.id ?? nanoid(8), id, p.name ?? `panel_${i}`, p.x ?? 0, p.y ?? 0, p.w ?? 100, p.h ?? 100, p.view_id ?? null, p.url ?? null, i),
        );
      })();
    }

    return parsePage(db, db.prepare('SELECT * FROM pages WHERE id = ?').get(id));
  });

  // DELETE /api/pages/:id
  app.delete<{ Params: { id: string } }>('/pages/:id', async (req, reply) => {
    const db = getDb();
    if (!db.prepare('SELECT id FROM pages WHERE id = ?').get(req.params.id))
      return reply.code(404).send({ error: 'Page not found' });
    // Clear default_page_id on devices that reference this page
    db.prepare(`UPDATE devices SET default_page_id=NULL WHERE default_page_id=?`).run(req.params.id);
    db.prepare('DELETE FROM pages WHERE id = ?').run(req.params.id);
    return { success: true };
  });

  // PUT /api/pages/:id/panels  (replace all panels atomically)
  app.put<{ Params: { id: string }; Body: any[] }>('/pages/:id/panels', async (req, reply) => {
    const db = getDb();
    const { id } = req.params;
    if (!db.prepare('SELECT id FROM pages WHERE id = ?').get(id))
      return reply.code(404).send({ error: 'Page not found' });
    db.transaction(() => {
      db.prepare('DELETE FROM page_panels WHERE page_id=?').run(id);
      const ins = db.prepare(`
        INSERT INTO page_panels (id, page_id, name, x, y, w, h, view_id, url, position)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      (req.body ?? []).forEach((p: any, i: number) =>
        ins.run(p.id ?? nanoid(8), id, p.name ?? `panel_${i}`, p.x ?? 0, p.y ?? 0, p.w ?? 100, p.h ?? 100, p.view_id ?? null, p.url ?? null, i),
      );
    })();
    db.prepare(`UPDATE pages SET updated_at=? WHERE id=?`).run(new Date().toISOString(), id);
    return parsePage(db, db.prepare('SELECT * FROM pages WHERE id = ?').get(id));
  });

  // POST /api/pages/:id/push  (push load_page command to all devices assigned to this page)
  app.post<{ Params: { id: string } }>('/pages/:id/push', async (req, reply) => {
    const db = getDb();
    const { id } = req.params;
    const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(id) as any;
    if (!page) return reply.code(404).send({ error: 'Page not found' });

    const devices = db.prepare(`SELECT id FROM devices WHERE default_page_id=?`).all(id) as any[];
    const pageData = parsePage(db, page);
    for (const dev of devices) {
      sendCommand(dev.id, { type: 'load_page', page_id: id, page_data: pageData });
    }
    return { pushed_to: devices.length };
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parsePage(db: any, page: any) {
  if (!page) return page;
  const panels = db.prepare('SELECT * FROM page_panels WHERE page_id=? ORDER BY position').all(page.id);
  return {
    ...page,
    floating_config: page.floating_config ? JSON.parse(page.floating_config) : null,
    panels,
  };
}
