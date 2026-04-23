/**
 * jsonExtractor — robustly extracts ExportedView JSON from LLM output.
 *
 * Ported from HACS canvas-ui-react with platform view schema adaptations.
 */
import type { WidgetConfig } from '../../types';

export interface ExtractedView {
  version: string;
  view: {
    id: string;
    name: string;
    widgets: WidgetConfig[];
  };
}

/**
 * Single-pass JSON sanitiser.
 * - Strips // line comments and /* block comments * / outside strings
 * - Escapes bare control characters inside strings
 */
function sanitizeJson(json: string): string {
  const CTRL_ESC: Record<number, string> = {
    0x08: '\\b', 0x09: '\\t', 0x0a: '\\n', 0x0c: '\\f', 0x0d: '\\r',
  };
  let result = '';
  let inString = false;
  let escaped = false;
  let i = 0;
  while (i < json.length) {
    const char = json[i];
    const code = json.charCodeAt(i);
    if (inString) {
      if (escaped) { result += char; escaped = false; i++; continue; }
      if (char === '\\') { result += char; escaped = true; i++; continue; }
      if (char === '"') { inString = false; result += char; i++; continue; }
      if (code < 0x20) {
        result += CTRL_ESC[code] ?? `\\u${code.toString(16).padStart(4, '0')}`;
        i++; continue;
      }
      result += char; i++; continue;
    }
    if (char === '"') { inString = true; result += char; i++; continue; }
    if (char === '/' && json[i + 1] === '/') {
      while (i < json.length && json[i] !== '\n') i++;
      continue;
    }
    if (char === '/' && json[i + 1] === '*') {
      i += 2;
      while (i < json.length - 1 && !(json[i] === '*' && json[i + 1] === '/')) i++;
      i += 2; continue;
    }
    result += char; i++;
  }
  return result;
}

/** Map HACS position shape (x/y/width/height as top-level) to platform shape */
function normaliseWidget(w: any): WidgetConfig {
  // HACS widgets have position object; platform may differ — both use same shape
  return w as WidgetConfig;
}

/**
 * Extract the view JSON block from an LLM response string.
 * Handles markdown code fences, plain JSON, and trailing-comma defects.
 */
export function extractViewFromResponse(aiResponse: string): ExtractedView | null {
  try {
    const fenceMatch = aiResponse.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    const jsonStr = fenceMatch ? fenceMatch[1] : aiResponse;

    const start = jsonStr.indexOf('{');
    const end = jsonStr.lastIndexOf('}');
    if (start === -1 || end === -1) return null;

    let extracted = jsonStr.substring(start, end + 1);
    extracted = sanitizeJson(extracted);
    extracted = extracted.replace(/,(\s*[}\]])/g, '$1'); // trailing commas

    const parsed = JSON.parse(extracted);

    if (!parsed.view?.widgets || !Array.isArray(parsed.view.widgets)) {
      console.error('[extractViewFromResponse] Missing view.widgets array');
      return null;
    }

    // Merge borders array if AI produced a separate one (HACS quirk)
    if (Array.isArray(parsed.view.borders)) {
      parsed.view.widgets = [...parsed.view.widgets, ...parsed.view.borders];
      delete parsed.view.borders;
    }

    parsed.view.widgets = parsed.view.widgets.map(normaliseWidget);
    return parsed as ExtractedView;
  } catch (err) {
    console.error('[extractViewFromResponse] Parse failed:', err);
    return null;
  }
}
