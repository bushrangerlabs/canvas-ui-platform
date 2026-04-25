/**
 * /proxy?url=<encoded-url>
 *
 * Fetches an external URL on behalf of the browser and strips X-Frame-Options
 * and Content-Security-Policy frame-ancestors so the response can be rendered
 * inside an iframe in the kiosk browser app.
 *
 * Usage (panel External URL field):
 *   http://<addon-host>:<port>/proxy?url=http%3A%2F%2F192.168.1.103%3A8123%2Fcanvas-ui
 */

import type { FastifyInstance } from 'fastify';

const STRIP_HEADERS = new Set([
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
]);

export async function proxyRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { url?: string } }>('/proxy', async (req, reply) => {
    const targetUrl = req.query.url;
    if (!targetUrl) {
      return reply.status(400).send({ error: 'Missing ?url= parameter' });
    }

    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return reply.status(400).send({ error: 'Invalid URL' });
    }

    // Only allow http/https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return reply.status(400).send({ error: 'Only http/https URLs are allowed' });
    }

    let upstream: Response;
    try {
      // Forward the incoming Authorization header if present (passes HA long-lived tokens)
      const headers: Record<string, string> = {
        'User-Agent': 'CanvasUI-Proxy/1.0',
      };
      const auth = req.headers['authorization'];
      if (auth) headers['Authorization'] = auth;

      const cookie = req.headers['cookie'];
      if (cookie) headers['Cookie'] = cookie;

      upstream = await fetch(parsed.toString(), { headers, redirect: 'follow' });
    } catch (err: any) {
      return reply.status(502).send({ error: `Upstream fetch failed: ${err.message}` });
    }

    // Copy headers, stripping the ones that block framing
    upstream.headers.forEach((value, key) => {
      if (!STRIP_HEADERS.has(key.toLowerCase())) {
        reply.header(key, value);
      }
    });

    reply.status(upstream.status);
    const body = Buffer.from(await upstream.arrayBuffer());
    return reply.send(body);
  });
}
