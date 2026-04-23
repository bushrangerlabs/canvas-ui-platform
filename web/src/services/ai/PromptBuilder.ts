/**
 * PromptBuilder — builds single-pass dashboard generation prompts.
 *
 * Adapted from HACS canvas-ui-react for the platform:
 * - Widget catalog from platform WIDGET_CATALOG
 * - No Lovelace card discovery (simplifies prompt)
 * - No import.meta / localStorage dependencies
 */
import { WIDGET_CATALOG } from '../../components/widgets/widget-catalog';
import type { FieldMetadata } from '../../components/widgets/metadata';

export interface SelectedEntity {
  entity_id: string;
  friendly_name: string;
  domain: string;
  state?: string;
}

// ─── Widget catalog ─────────────────────────────────────────────────────────

const UNIVERSAL = new Set([
  'backgroundColor', 'backgroundImage', 'backgroundSize', 'backgroundPosition',
  'backgroundRepeat', 'borderWidth', 'borderColor', 'borderRadius', 'borderStyle',
  'boxShadow', 'shadowColor', 'shadowX', 'shadowY', 'shadowBlur', 'opacity', 'style',
]);
const LAYOUT = new Set(['x', 'y', 'width', 'height', 'zIndex']);

function formatField(f: FieldMetadata): string {
  const typeMap: Record<string, string> = {
    text: 'text', textarea: 'text', number: 'num', slider: 'num',
    checkbox: 'bool', color: 'color', entity: 'entity', icon: 'icon',
    select: 'enum', font: 'font',
  };
  const t = typeMap[f.type] ?? f.type;
  let s = `  ${f.name}: ${t}`;
  if (f.default !== undefined && f.default !== '' && f.default !== null) s += `(${f.default})`;
  if (f.type === 'select' && f.options) s += ` [${f.options.map(o => o.value).join('|')}]`;
  if ((f.type === 'slider' || f.type === 'number') && f.min !== undefined && f.max !== undefined) s += ` {${f.min}-${f.max}}`;
  if (f.type === 'checkbox' && f.name === 'showIcon') s += ' // MUST be true to show icon!';
  return s;
}

export function generateWidgetCatalog(): string {
  const lines: string[] = [
    '=== TYPE LEGEND ===',
    'text=string  num=number  bool=true/false  color=#hex  entity=HA entity ID  icon=mdi:name or MUIIconName  enum=pick one  font=font family',
    '',
    '=== UNIVERSAL (all widgets) ===',
    'Position: x, y, width, height, zIndex (always required)',
    'Background: backgroundColor(color), backgroundImage(text), backgroundSize(enum) [cover|contain|auto]',
    'Border: borderWidth(num), borderColor(color), borderStyle(enum) [solid|dashed|dotted]',
    '  borderRadius: num OR object {topLeft,topRight,bottomRight,bottomLeft} (num each)',
    '  chamfer corners: add *Style fields e.g. topLeftStyle(enum)[rounded|chamfer]',
    'Shadow: boxShadow(text), shadowColor(color)',
    '',
    '=== WIDGET-SPECIFIC PROPERTIES ===',
  ];

  for (const [type, meta] of Object.entries(WIDGET_CATALOG).sort(([a], [b]) => a.localeCompare(b))) {
    if (!meta?.fields) continue;
    const specific = meta.fields.filter(f => !UNIVERSAL.has(f.name) && !LAYOUT.has(f.name) && !f.visibleWhen);
    if (specific.length === 0) {
      lines.push(`${type}: (uses only universal properties)`);
    } else {
      lines.push(`${type}:`);
      for (const f of specific) lines.push(formatField(f));
    }
    lines.push('');
  }
  return lines.join('\n');
}

// ─── System prompts ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT_CREATE = `You are a Home Assistant dashboard expert creating a NEW dashboard from scratch.

FOLLOW LITERAL REQUIREMENTS:
- If they say "7 red buttons", create 7 buttons with backgroundColor: "#ff0000"
- If they say "days of the week", use labels: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
- If they say "yellow calendar icon", use icon: "mdi:calendar" with iconColor: "#ffff00"
- If they say "white border", CREATE a border widget with borderColor: "#ffffff"
- Count correctly: "7 buttons + border" = 8 widgets total

COLOR CODES: red=#ff0000, blue=#0000ff, green=#00ff00, yellow=#ffff00, white=#ffffff, black=#000000

CIRCULAR WIDGETS: Set borderRadius: 360 and equal width/height (e.g. 200x200)

PER-CORNER BORDER RADIUS & CHAMFER:
- Rounded: {"borderRadius": {"topLeft": 30, "topRight": 30, "bottomRight": 0, "bottomLeft": 0}}
- Chamfered (45° cut): add *Style="chamfer" fields e.g. {"borderRadius": {"topLeft": 20, "topLeftStyle": "chamfer"}}
- DO NOT use flat fields like cornerRadiusTopLeft

Respond with ONLY the JSON — no explanations, no examples, no text.`;

const SYSTEM_PROMPT_EDIT = `You are a Home Assistant dashboard expert EDITING an EXISTING dashboard.

⚠️ CRITICAL EDITING RULES ⚠️
1. The current dashboard widgets are shown below in JSON format
2. PRESERVE ALL existing widgets unless the user explicitly asks to change or remove them
3. When the user asks to modify ONE thing, keep EVERYTHING ELSE unchanged
4. Return the COMPLETE updated view with ALL widgets (unchanged + modified + new)
5. NEVER return partial responses — include every single widget
6. PRESERVE existing widget IDs exactly — copy the "id" field from CURRENT WIDGETS unchanged

Respond with ONLY the JSON — no explanations, no examples, no text.`;

const OUTPUT_FORMAT = `=== OUTPUT FORMAT ===

STRUCTURE:
{
  "version": "2.0.0",
  "exportedAt": "{{timestamp}}",
  "view": {
    "id": "{{viewId}}",
    "name": "{{viewName}}",
    "widgets": [
      {"id": "btn-1", "type": "button", "name": "My Button", "position": {"x": 10, "y": 10, "width": 150, "height": 80, "zIndex": 1}, "config": {}, "bindings": {}}
    ]
  }
}

CRITICAL RULES:
1. MUST include version, exportedAt, view wrapper
2. MUST use view.widgets array (NOT top-level widgets)
3. Each widget MUST have: id, type, name, position, config, bindings
4. Widget names should be descriptive ("Monday Button", "Temperature Display")
5. ALL widgets (including borders) go in ONE "widgets" array
6. For icons on buttons: showIcon MUST be true + set iconColor for colored icons
7. RESPOND WITH ONLY THE JSON — no explanatory text`;

// ─── Prompt builder ──────────────────────────────────────────────────────────

let _catalogCache: string | null = null;

export function buildGenerationPrompt(opts: {
  userRequest: string;
  entities: SelectedEntity[];
  viewId: string;
  viewName: string;
  currentWidgets?: any[];
  viewWidth?: number;
  viewHeight?: number;
}): string {
  const {
    userRequest,
    entities,
    viewId,
    viewName,
    currentWidgets = [],
    viewWidth = 1920,
    viewHeight = 1080,
  } = opts;

  const timestamp = new Date().toISOString();
  const isEdit = currentWidgets.length > 0;

  const entityList = entities.length > 0
    ? entities.map(e => `${e.entity_id} (${e.friendly_name}, state: ${e.state ?? 'unknown'})`).join('\n')
    : 'No entities selected';

  if (!_catalogCache) _catalogCache = generateWidgetCatalog();

  const system = isEdit ? SYSTEM_PROMPT_EDIT : SYSTEM_PROMPT_CREATE;

  const canvasSection = `CANVAS BOUNDS:
The view is ${viewWidth}px × ${viewHeight}px. All widgets must stay within: x+width ≤ ${viewWidth}, y+height ≤ ${viewHeight}. Start at x ≥ 10, y ≥ 10.`;

  const currentSection = isEdit
    ? `\nCURRENT WIDGETS ON CANVAS:\n\`\`\`json\n${JSON.stringify(
        { version: '2.0.0', exportedAt: timestamp, view: { id: viewId, name: viewName, widgets: currentWidgets } },
        null, 2,
      )}\n\`\`\`\n\nReturn the COMPLETE updated view with ALL widgets (including unchanged ones).\nCopy each widget's "id" field exactly — do NOT generate new IDs.\n`
    : '';

  const outputFmt = OUTPUT_FORMAT
    .replace('{{timestamp}}', timestamp)
    .replace('{{viewId}}', viewId)
    .replace('{{viewName}}', viewName);

  return [
    system,
    '',
    'USER REQUEST:',
    userRequest,
    '',
    canvasSection,
    '',
    'AVAILABLE ENTITIES:',
    entityList,
    currentSection,
    'AVAILABLE WIDGETS:',
    _catalogCache,
    '',
    outputFmt,
  ].join('\n').trim();
}
