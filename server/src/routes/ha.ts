/**
 * HA Proxy routes — forwards requests to HA supervisor API.
 * Only available when the add-on has homeassistant_api: true.
 */
import type { FastifyInstance } from 'fastify';

const SUPERVISOR_TOKEN = process.env.SUPERVISOR_TOKEN;
const HA_API = 'http://supervisor/core/api';

async function supervisorFetch(path: string) {
  if (!SUPERVISOR_TOKEN) throw new Error('SUPERVISOR_TOKEN not available');
  const res = await fetch(`${HA_API}${path}`, {
    headers: {
      Authorization: `Bearer ${SUPERVISOR_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`HA API ${path} → ${res.status}`);
  return res.json();
}

export async function haRoutes(app: FastifyInstance) {
  // GET /api/ha/states — returns all entity states from HA
  app.get('/ha/states', async (_req, reply) => {
    try {
      const states = await supervisorFetch('/states');
      reply.send(states);
    } catch (err: any) {
      reply.code(503).send({ error: err.message });
    }
  });
}
