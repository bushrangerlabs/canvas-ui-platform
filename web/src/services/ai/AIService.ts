/**
 * AIService — canvas generation via server-side AI proxy.
 *
 * All LLM calls go through POST /api/ai/chat so API keys stay on the server.
 */
import { api } from '../../api/client';
import { buildGenerationPrompt, type SelectedEntity } from './PromptBuilder';
import { extractViewFromResponse, type ExtractedView } from './jsonExtractor';

export type AIProvider = 'ollama' | 'openai' | 'github' | 'groq' | 'openwebui' | 'copilotproxy';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface AISettings {
  ai_provider: string;
  ai_model: string;
  ai_ollama_url: string;
  ai_openai_key: string;
  ai_openai_base_url: string;
  ai_github_token: string;
  ai_groq_key: string;
  ai_openwebui_url: string;
  ai_openwebui_key: string;
  ai_copilotproxy_token: string;
  ai_copilotproxy_url: string;
  ai_timeout_ms: string;
}

export interface GenerationResult {
  success: boolean;
  error?: string;
  extractedView?: ExtractedView;
  widgetCount?: number;
}

class AIService {
  private chatHistory: ChatMessage[] = [];

  // ── Settings ─────────────────────────────────────────────────────────────

  async loadSettings(): Promise<Partial<AISettings>> {
    try {
      return await api.get<Partial<AISettings>>('/api/ai/settings');
    } catch {
      return {};
    }
  }

  async saveSettings(updates: Partial<AISettings>): Promise<void> {
    await api.put('/api/ai/settings', updates);
  }

  /** Write a single sensitive key (raw, not masked) */
  async saveKey(key: keyof AISettings, value: string): Promise<void> {
    await api.post(`/api/ai/settings/key/${key}`, { value });
  }

  // ── Models ───────────────────────────────────────────────────────────────

  async fetchModels(): Promise<string[]> {
    try {
      const res = await api.get<{ models: string[] }>('/api/ai/models');
      return res.models ?? [];
    } catch {
      return [];
    }
  }

  // ── Chat history ─────────────────────────────────────────────────────────

  getHistory(): ChatMessage[] { return this.chatHistory; }
  clearHistory(): void { this.chatHistory = []; }

  // ── Generation ───────────────────────────────────────────────────────────

  async generate(opts: {
    userRequest: string;
    entities: SelectedEntity[];
    viewId: string;
    viewName: string;
    currentWidgets?: any[];
    viewWidth?: number;
    viewHeight?: number;
    imageDataUrl?: string;
  }): Promise<GenerationResult> {
    const { userRequest, entities, viewId, viewName, currentWidgets = [], viewWidth, viewHeight, imageDataUrl } = opts;
    const isEdit = currentWidgets.length > 0;

    this.chatHistory.push({ role: 'user', content: userRequest, timestamp: Date.now() });

    const prompt = buildGenerationPrompt({ userRequest, entities, viewId, viewName, currentWidgets, viewWidth, viewHeight });

    let messageContent: string | any[] = prompt;
    if (imageDataUrl) {
      // Compress image before sending to avoid large payloads
      const compressed = await compressImage(imageDataUrl);
      messageContent = [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: compressed } },
      ];
    }

    try {
      const res = await api.post<{ content?: string; error?: string }>('/api/ai/chat', {
        messages: [{ role: 'user', content: messageContent }],
      });

      if (res.error) throw new Error(res.error);
      const aiContent = res.content ?? '';

      this.chatHistory.push({ role: 'assistant', content: aiContent, timestamp: Date.now() });

      const extracted = extractViewFromResponse(aiContent);
      if (!extracted) {
        return { success: false, error: 'AI response did not contain valid dashboard JSON' };
      }

      // Defend against AI silently deleting existing widgets in edit mode
      if (isEdit && extracted.view.widgets.length < currentWidgets.length) {
        return {
          success: false,
          error: `AI returned only ${extracted.view.widgets.length} widget(s) but canvas has ${currentWidgets.length}. The model may not be following edit instructions — try rephrasing or a smarter model.`,
        };
      }

      return { success: true, extractedView: extracted, widgetCount: extracted.view.widgets.length };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.chatHistory.push({ role: 'assistant', content: `Error: ${msg}`, timestamp: Date.now() });
      return { success: false, error: msg };
    }
  }
}

// ─── Image compression helper (browser only) ────────────────────────────────

async function compressImage(dataUrl: string, maxDim = 512, quality = 0.65): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export const aiService = new AIService();
