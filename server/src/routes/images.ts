import { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import path from 'path';
import fs from 'fs';
import { getDb } from '../db/index';
import { config } from '../config';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']);

export async function imageRoutes(app: FastifyInstance) {
  // GET /api/images
  app.get('/images', async () => {
    return getDb().prepare('SELECT * FROM images ORDER BY created_at DESC').all();
  });

  // POST /api/images/upload
  app.post('/images/upload', async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.code(400).send({ error: 'No file provided' });

    const mime = data.mimetype;
    if (!ALLOWED_MIME.has(mime)) {
      return reply.code(400).send({ error: `Unsupported file type: ${mime}` });
    }

    const ext = path.extname(data.filename) || mimeToExt(mime);
    const id = nanoid(10);
    const filename = `${id}${ext}`;
    const filePath = path.join(config.imagesDir, filename);
    const urlPath = `/api/images/${id}/file`;

    fs.mkdirSync(config.imagesDir, { recursive: true });

    const buffer = await data.toBuffer();
    fs.writeFileSync(filePath, buffer);

    const now = new Date().toISOString();
    getDb().prepare(`
      INSERT INTO images (id, filename, mime_type, size_bytes, url_path, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, filename, mime, buffer.length, urlPath, now);

    reply.code(201);
    return getDb().prepare('SELECT * FROM images WHERE id = ?').get(id);
  });

  // GET /api/images/:id/file
  app.get<{ Params: { id: string } }>('/images/:id/file', async (req, reply) => {
    const row = getDb().prepare('SELECT * FROM images WHERE id = ?').get(req.params.id) as any;
    if (!row) return reply.code(404).send({ error: 'Image not found' });
    const filePath = path.join(config.imagesDir, row.filename);
    if (!fs.existsSync(filePath)) return reply.code(404).send({ error: 'File missing on disk' });
    reply.header('Content-Type', row.mime_type);
    reply.header('Cache-Control', 'public, max-age=86400');
    return reply.send(fs.createReadStream(filePath));
  });

  // DELETE /api/images/:id
  app.delete<{ Params: { id: string } }>('/images/:id', async (req, reply) => {
    const db = getDb();
    const row = db.prepare('SELECT * FROM images WHERE id = ?').get(req.params.id) as any;
    if (!row) return reply.code(404).send({ error: 'Image not found' });
    const filePath = path.join(config.imagesDir, row.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    db.prepare('DELETE FROM images WHERE id = ?').run(req.params.id);
    return { success: true };
  });
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
  };
  return map[mime] ?? '.bin';
}
