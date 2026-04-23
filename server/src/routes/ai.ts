/**
 * AI Routes
 *
 * GET  /api/ai/settings           — read AI configuration (keys masked)
 * PUT  /api/ai/settings           — write AI configuration
 * GET  /api/ai/models             — list models for current provider
 * POST /api/ai/chat               — proxy a chat completion to the configured LLM
 */
import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/index';

// ─── helpers ────────────────────────────────────────────────────────────────

function getSetting(key: string): string {
  const db = getDb();
  const row = db.prepare('SELECT value FROM server_settings WHERE key = ?').get(key) as any;
  return row?.value ?? '';
}

function setSetting(key: string, value: string): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO server_settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
  `).run(key, value);
}

// All setting keys used by AI
const AI_KEYS = [
  'ai_provider',
  'ai_model',
  'ai_ollama_url',
  'ai_openai_key',
  'ai_openai_base_url',
  'ai_github_token',
  'ai_groq_key',
  'ai_openwebui_url',
  'ai_openwebui_key',
  'ai_copilotproxy_token',
  'ai_copilotproxy_url',
  'ai_timeout_ms',
] as const;

type AISettingKey = (typeof AI_KEYS)[number];

function mask(value: string): string {
  if (!value || value.length < 8) return value ? '***' : '';
  return value.slice(0, 4) + '****' + value.slice(-4);
}

// ─── LLM proxy ──────────────────────────────────────────────────────────────

interface ChatMessage {
  role: string;
  content: string | any[];
}

/** Call Ollama (non-OpenAI-compat format) */
async function callOllama(
  baseUrl: string,
  model: string,
  messages: ChatMessage[],
  timeoutMs: number,
): Promise<string> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/chat`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
    const json = await res.json() as any;
    return json.message?.content ?? '';
  } finally {
    clearTimeout(timer);
  }
}

/** Call any OpenAI-compatible endpoint */
async function callOpenAICompat(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  timeoutMs: number,
): Promise<string> {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 16000 }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
    const json = await res.json() as any;
    return json.choices?.[0]?.message?.content ?? '';
  } finally {
    clearTimeout(timer);
  }
}

// ─── Routes ─────────────────────────────────────────────────────────────────

export async function aiRoutes(app: FastifyInstance) {
  // GET /api/ai/settings
  app.get('/settings', async () => {
    const settings: Record<string, string> = {};
    for (const key of AI_KEYS) {
      settings[key] = getSetting(key);
    }
    // Mask sensitive fields in response
    const masked = { ...settings };
    for (const k of ['ai_openai_key', 'ai_github_token', 'ai_groq_key', 'ai_openwebui_key', 'ai_copilotproxy_token'] as AISettingKey[]) {
      if (masked[k]) masked[k] = mask(masked[k]);
    }
    return masked;
  });

  // PUT /api/ai/settings
  app.put<{ Body: Partial<Record<AISettingKey, string>> }>('/settings', async (req, reply) => {
    const updates = req.body;
    if (!updates || typeof updates !== 'object') {
      return reply.status(400).send({ error: 'Invalid body' });
    }
    for (const [key, value] of Object.entries(updates)) {
      if ((AI_KEYS as readonly string[]).includes(key)) {
        // Don't overwrite keys with masked placeholder values from the frontend
        if (value === '***' || (value?.length === 12 && value.endsWith('****'))) continue;
        setSetting(key, value ?? '');
      }
    }
    return { ok: true };
  });

  // --- key update (write raw value) POST /api/ai/settings/key/:key
  app.post<{ Params: { key: string }; Body: { value: string } }>(
    '/settings/key/:key',
    async (req, reply) => {
      const { key } = req.params;
      const { value } = req.body;
      if (!(AI_KEYS as readonly string[]).includes(key)) {
        return reply.status(400).send({ error: 'Unknown key' });
      }
      setSetting(key, value ?? '');
      return { ok: true };
    },
  );

  // GET /api/ai/models  — list models for configured provider
  app.get('/models', async (_req, reply) => {
    const provider = getSetting('ai_provider') || 'ollama';
    try {
      if (provider === 'ollama') {
        const baseUrl = getSetting('ai_ollama_url') || 'http://localhost:11434';
        const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/tags`);
        if (!res.ok) return reply.status(502).send({ error: 'Ollama unreachable' });
        const json = await res.json() as any;
        const models = (json.models ?? []).map((m: any) => m.name).sort();
        return { models };
      }
      if (provider === 'openai') {
        const key = getSetting('ai_openai_key');
        const base = getSetting('ai_openai_base_url') || 'https://api.openai.com/v1';
        if (!key) return reply.status(400).send({ error: 'OpenAI key not set' });
        const res = await fetch(`${base.replace(/\/$/, '')}/models`, {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (!res.ok) return reply.status(502).send({ error: await res.text() });
        const json = await res.json() as any;
        const isDefault = base === 'https://api.openai.com/v1';
        const all: string[] = (json.data ?? []).map((m: any) => m.id);
        const models = isDefault
          ? all.filter(id => id.includes('gpt') && !/(realtime|audio|tts|whisper|dall-e)/.test(id)).sort()
          : all.sort();
        return { models };
      }
      if (provider === 'github') {
        const token = getSetting('ai_github_token');
        if (!token) return reply.status(400).send({ error: 'GitHub token not set' });
        const res = await fetch('https://models.inference.ai.azure.com/models', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return reply.status(502).send({ error: await res.text() });
        const json = await res.json() as any;
        const models = (Array.isArray(json) ? json : json.data ?? [])
          .map((m: any) => m.id ?? m.name)
          .filter(Boolean)
          .sort();
        return { models };
      }
      if (provider === 'groq') {
        const key = getSetting('ai_groq_key');
        if (!key) return reply.status(400).send({ error: 'Groq key not set' });
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (!res.ok) return reply.status(502).send({ error: await res.text() });
        const json = await res.json() as any;
        const models = (json.data ?? []).map((m: any) => m.id).sort();
        return { models };
      }
      if (provider === 'openwebui') {
        const url = getSetting('ai_openwebui_url') || 'http://localhost:3000';
        const key = getSetting('ai_openwebui_key');
        const res = await fetch(`${url.replace(/\/$/, '')}/api/models`, {
          headers: key ? { Authorization: `Bearer ${key}` } : {},
        });
        if (!res.ok) return reply.status(502).send({ error: 'OpenWebUI unreachable' });
        const json = await res.json() as any;
        const models = (json.data ?? json.models ?? []).map((m: any) => m.id ?? m.name).filter(Boolean).sort();
        return { models };
      }
      if (provider === 'copilotproxy') {
        const token = getSetting('ai_copilotproxy_token');
        const url = getSetting('ai_copilotproxy_url') || 'http://localhost:3000/api';
        if (!token) return reply.status(400).send({ error: 'Copilot proxy token not set' });
        const res = await fetch(`${url.replace(/\/$/, '')}/v1/models`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return reply.status(502).send({ error: await res.text() });
        const json = await res.json() as any;
        const models = (json.data ?? []).map((m: any) => m.id).sort();
        return { models };
      }
      return reply.status(400).send({ error: `Unknown provider: ${provider}` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(502).send({ error: msg });
    }
  });

  // POST /api/ai/chat  — proxy completion
  app.post<{ Body: { messages: ChatMessage[]; model?: string; timeout?: number } }>(
    '/chat',
    async (req, reply) => {
      const { messages, model, timeout } = req.body ?? {};
      if (!Array.isArray(messages) || messages.length === 0) {
        return reply.status(400).send({ error: 'messages required' });
      }

      const provider = getSetting('ai_provider') || 'ollama';
      const resolvedModel = model || getSetting('ai_model') || (provider === 'ollama' ? 'llama3' : 'gpt-4o-mini');
      const timeoutMs = timeout || parseInt(getSetting('ai_timeout_ms') || '180000', 10) || 180000;

      try {
        let content = '';

        if (provider === 'ollama') {
          const url = getSetting('ai_ollama_url') || 'http://localhost:11434';
          content = await callOllama(url, resolvedModel, messages, timeoutMs);
        } else if (provider === 'openai') {
          const key = getSetting('ai_openai_key');
          const base = getSetting('ai_openai_base_url') || 'https://api.openai.com/v1';
          if (!key) return reply.status(400).send({ error: 'OpenAI key not configured' });
          content = await callOpenAICompat(base, key, resolvedModel, messages, timeoutMs);
        } else if (provider === 'github') {
          const token = getSetting('ai_github_token');
          if (!token) return reply.status(400).send({ error: 'GitHub token not configured' });
          content = await callOpenAICompat('https://models.inference.ai.azure.com', token, resolvedModel, messages, timeoutMs);
        } else if (provider === 'groq') {
          const key = getSetting('ai_groq_key');
          if (!key) return reply.status(400).send({ error: 'Groq key not configured' });
          content = await callOpenAICompat('https://api.groq.com/openai/v1', key, resolvedModel, messages, timeoutMs);
        } else if (provider === 'openwebui') {
          const url = getSetting('ai_openwebui_url') || 'http://localhost:3000';
          const key = getSetting('ai_openwebui_key');
          content = await callOpenAICompat(`${url}/api`, key, resolvedModel, messages, timeoutMs);
        } else if (provider === 'copilotproxy') {
          const token = getSetting('ai_copilotproxy_token');
          const url = getSetting('ai_copilotproxy_url') || 'http://localhost:3000/api';
          if (!token) return reply.status(400).send({ error: 'Copilot proxy token not configured' });
          content = await callOpenAICompat(url, token, resolvedModel, messages, timeoutMs);
        } else {
          return reply.status(400).send({ error: `Unknown provider: ${provider}` });
        }

        return { content };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return reply.status(502).send({ error: msg });
      }
    },
  );
}
