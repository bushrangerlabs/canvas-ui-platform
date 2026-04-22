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

async function supervisorPost(path: string, body: unknown) {
  if (!SUPERVISOR_TOKEN) throw new Error('SUPERVISOR_TOKEN not available');
  const res = await fetch(`${HA_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPERVISOR_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HA API POST ${path} → ${res.status}`);
  // HA returns [] for service calls
  const ct = res.headers.get('content-type') ?? '';
  return ct.includes('application/json') ? res.json() : {};
}

export async function haRoutes(app: FastifyInstance) {
  // GET /api/ha/states — returns all entity states
  app.get('/ha/states', async (_req, reply) => {
    try {
      reply.send(await supervisorFetch('/states'));
    } catch (err: any) {
      reply.code(503).send({ error: err.message });
    }
  });

  // GET /api/ha/states/:entityId — single entity state
  app.get<{ Params: { entityId: string } }>('/ha/states/:entityId', async (req, reply) => {
    try {
      reply.send(await supervisorFetch(`/states/${req.params.entityId}`));
    } catch (err: any) {
      reply.code(503).send({ error: err.message });
    }
  });

  // POST /api/ha/services/:domain/:service — call an HA service
  app.post<{ Params: { domain: string; service: string } }>(
    '/ha/services/:domain/:service',
    async (req, reply) => {
      try {
        const result = await supervisorPost(
          `/services/${req.params.domain}/${req.params.service}`,
          req.body ?? {},
        );
        reply.send(result);
      } catch (err: any) {
        reply.code(503).send({ error: err.message });
      }
    },
  );
}
