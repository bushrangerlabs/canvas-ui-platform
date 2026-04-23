/**
 * PromptTemplateStore — user-editable AI prompt templates with localStorage persistence.
 *
 * Ported from HACS canvas-ui-react. Templates are stored per-browser in
 * localStorage so users can customise system prompts, widget catalog, and
 * output format without touching code.
 */

import { generateWidgetCatalog } from './widgetCatalogGen';

export interface PromptTemplates {
  systemPromptCreate: string;
  systemPromptEdit: string;
  widgetCatalog: string;
  outputFormat: string;
}

const TEMPLATE_VERSION = 1; // increment to force-reset stored templates

// ─── Default templates ────────────────────────────────────────────────────────

function makeDefaults(): PromptTemplates {
  const create = `You are a Home Assistant dashboard expert creating a NEW dashboard from scratch.

FOLLOW LITERAL REQUIREMENTS:
- If they say "7 red buttons", create 7 buttons with backgroundColor: "#ff0000"
- If they say "days of the week", use labels: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
- If they say "yellow calendar icon", use icon: "mdi:calendar" with iconColor: "#ffff00"
- If they say "white border", CREATE a border widget with borderColor: "#ffffff"
- Count correctly: "7 buttons + border" = 8 widgets total

COLOR CODES: red=#ff0000, blue=#0000ff, green=#00ff00, yellow=#ffff00, white=#ffffff, black=#000000

CIRCULAR WIDGETS: To make a widget circular/round:
- Set cornerRadius: 360 (all corners)
- Make it square: width = height (e.g., 200x200)
- Example: "round button" → {"width": 200, "height": 200, "cornerRadius": 360}

PER-CORNER BORDER RADIUS & CHAMFER: Use config.style.borderRadius as an object for per-corner control:
- Rounded corners only: {"borderRadius": {"topLeft": 30, "topRight": 30, "bottomRight": 0, "bottomLeft": 0}}
- Chamfered corners (45° diagonal cut): add *Style fields set to "chamfer":
  {"borderRadius": {"topLeft": 20, "topLeftStyle": "chamfer", "topRight": 20, "topRightStyle": "chamfer", "bottomRight": 0, "bottomLeft": 0}}
- Mixed: some corners "chamfer", others omit *Style (defaults to "rounded")
- "chamfer" produces a clipped diagonal corner; "rounded" produces a smooth arc
- Example: "beveled top corners" → {"config": {"style": {"borderRadius": {"topLeft": 20, "topLeftStyle": "chamfer", "topRight": 20, "topRightStyle": "chamfer"}}}}
- DO NOT use flat fields like cornerRadiusTopLeft — they are not supported.

Respond with ONLY the JSON — no explanations, no examples, no text.`;

  const edit = `You are a Home Assistant dashboard expert EDITING an EXISTING dashboard.

⚠️ CRITICAL EDITING RULES ⚠️
1. The current dashboard widgets are shown below in JSON format
2. PRESERVE ALL existing widgets unless the user explicitly asks to change or remove them
3. When the user asks to modify ONE thing, keep EVERYTHING ELSE unchanged
4. Return the COMPLETE updated view with ALL widgets (unchanged + modified + new)
5. NEVER return partial responses — you must include every single widget
6. PRESERVE existing widget IDs exactly — copy the "id" field from CURRENT WIDGETS unchanged; do NOT generate new IDs

EXAMPLE EDIT REQUEST:
User: "change the border radius to 30"

Current widgets: [widget1, widget2, widget3, border]
Correct response: [widget1, widget2, widget3, border (with borderRadius: 30)]
WRONG response: [border (with borderRadius: 30)]  ❌ MISSING 3 widgets!

You MUST return ALL widgets, not just the ones being modified!

OUTPUT FORMAT: Return the complete view JSON with all widgets, matching the structure of the current widgets shown below.

COLOR CODES: red=#ff0000, blue=#0000ff, green=#00ff00, yellow=#ffff00, white=#ffffff, black=#000000

CIRCULAR WIDGETS: To make a widget circular/round:
- Set cornerRadius: 360 (all corners)
- Make it square: width = height (e.g., 200x200)

PER-CORNER BORDER RADIUS & CHAMFER: Use config.style.borderRadius as an object for per-corner control:
- Rounded corners only: {"borderRadius": {"topLeft": 30, "topRight": 30, "bottomRight": 0, "bottomLeft": 0}}
- Chamfered corners (45° diagonal cut): add *Style fields set to "chamfer":
  {"borderRadius": {"topLeft": 20, "topLeftStyle": "chamfer", "topRight": 20, "topRightStyle": "chamfer"}}
- DO NOT use flat fields like cornerRadiusTopLeft — they are not supported.

Respond with ONLY the JSON — no explanations, no examples, no text.`;

  const outputFormat = `=== OUTPUT FORMAT ===

IMPORTANT: Position values are in PIXELS (not grid units)
- x, y: pixel coordinates (10, 20, 100, 200, etc.)
- width: typical 150-200px for buttons, 300-500px for borders
- height: typical 80-100px for buttons, 200-300px for borders
- zIndex: 1-999 (borders usually 999)

STRUCTURE:
{
  "version": "2.0.0",
  "exportedAt": "{{timestamp}}",
  "view": {
    "id": "{{viewId}}",
    "name": "{{viewName}}",
    "widgets": [
      {"id": "btn-1", "type": "button", "name": "Monday Button", "position": {"x": 10, "y": 10, "width": 150, "height": 80, "zIndex": 1}, "config": {}, "bindings": {}}
    ]
  }
}

CRITICAL RULES:
1. MUST include version, exportedAt, view wrapper
2. MUST use view.widgets array (NOT top-level widgets)
3. Each widget MUST have: id, type, name (descriptive), position, config, bindings
4. Widget names should be descriptive ("Monday Button", "Temperature Display", "Main Border")
5. ALL widgets (including borders) go in ONE "widgets" array
6. For icons on buttons: showIcon MUST be true + set iconColor for colored icons
7. RESPOND WITH ONLY THE JSON — no explanatory text, no examples, no tutorials
8. FOLLOW THE EXACT NUMBERS AND SPECIFICATIONS from the user request`;

  return {
    systemPromptCreate: create,
    systemPromptEdit: edit,
    widgetCatalog: generateWidgetCatalog(),
    outputFormat,
  };
}

// ─── Store class ──────────────────────────────────────────────────────────────

class PromptTemplateStore {
  private templates: PromptTemplates;
  private readonly storageKey = 'canvasui_platform_prompt_templates';
  private readonly versionKey = 'canvasui_platform_prompt_templates_version';

  constructor() {
    this.templates = this.load();
  }

  private load(): PromptTemplates {
    try {
      const storedVersion = parseInt(localStorage.getItem(this.versionKey) ?? '0', 10);
      if (storedVersion !== TEMPLATE_VERSION) {
        localStorage.removeItem(this.storageKey);
        localStorage.setItem(this.versionKey, String(TEMPLATE_VERSION));
        return makeDefaults();
      }
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        return { ...makeDefaults(), ...JSON.parse(stored) };
      }
    } catch {
      // ignore
    }
    return makeDefaults();
  }

  private save(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.templates));
      localStorage.setItem(this.versionKey, String(TEMPLATE_VERSION));
    } catch {
      // ignore
    }
  }

  getTemplates(): PromptTemplates {
    return { ...this.templates };
  }

  getTemplate(key: keyof PromptTemplates): string {
    return this.templates[key];
  }

  updateTemplate(key: keyof PromptTemplates, value: string): void {
    this.templates[key] = value;
    this.save();
  }

  saveTemplates(updates: Partial<PromptTemplates>): void {
    this.templates = { ...this.templates, ...updates };
    this.save();
  }

  resetToDefaults(): void {
    this.templates = makeDefaults();
    localStorage.removeItem(this.storageKey);
    localStorage.setItem(this.versionKey, String(TEMPLATE_VERSION));
  }

  isCustomized(): boolean {
    return !!localStorage.getItem(this.storageKey);
  }
}

export const promptTemplateStore = new PromptTemplateStore();
