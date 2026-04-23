/**
 * PromptBuilder — builds single-pass dashboard generation prompts.
 *
 * Uses PromptTemplateStore for user-editable system prompts, and
 * widgetCatalogGen for the auto-generated widget catalog.
 */
import { generateWidgetCatalog } from './widgetCatalogGen';
import { promptTemplateStore } from './PromptTemplateStore';

export { generateWidgetCatalog };

export interface SelectedEntity {
  entity_id: string;
  friendly_name: string;
  domain: string;
  state?: string;
}

// ─── Task breakdown (CREATE mode only) ───────────────────────────────────────

function buildTaskBreakdown(userRequest: string): string {
  const lower = userRequest.toLowerCase();
  const out: string[] = ['=== TASK BREAKDOWN ===', ''];

  const numberMatch = userRequest.match(/(\d+)\s+(\w+)/);
  if (numberMatch) {
    const count = parseInt(numberMatch[1]);
    const widgetType = numberMatch[2];
    out.push(`CREATE: ${count} ${widgetType} widgets`);
    out.push('');

    if (widgetType.includes('button')) {
      out.push('BUTTON CONFIG EXAMPLE:');
      out.push('{');
      out.push('  "id": "button-1",');
      out.push('  "type": "button",');
      out.push('  "position": {"x": 10, "y": 10, "width": 150, "height": 80, "zIndex": 1},');
      out.push('  "config": {');
      out.push('    "label": "LABEL_FROM_REQUEST",');
      out.push('    "backgroundColor": "COLOR_FROM_REQUEST",');
      out.push('    "showIcon": true,');
      out.push('    "icon": "ICON_FROM_REQUEST",');
      out.push('    "iconPosition": "top",');
      out.push('    "iconColor": "ICON_COLOR_FROM_REQUEST"');
      out.push('  }');
      out.push('}');
      out.push('');
    }
  }

  const colorMap: Record<string, string> = {
    red: '#ff0000', blue: '#0000ff', green: '#00ff00',
    yellow: '#ffff00', white: '#ffffff', black: '#000000',
  };

  for (const [colorName, hexCode] of Object.entries(colorMap)) {
    if (!lower.includes(colorName)) continue;
    if (lower.includes(`${colorName} button`) || (colorName === 'red' && lower.includes('button')))
      out.push(`BUTTON BACKGROUND: "backgroundColor": "${hexCode}"`);
    if (lower.includes(`${colorName} icon`) || lower.includes(`${colorName} calendar`))
      out.push(`ICON COLOR: "iconColor": "${hexCode}"`);
    if (lower.includes(`${colorName} border`))
      out.push(`BORDER COLOR: "borderColor": "${hexCode}"`);
  }

  if (lower.includes('days of the week') || lower.includes('day of the week')) {
    out.push('');
    out.push('BUTTON LABELS (use these exact strings):');
    ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      .forEach((d, i) => out.push(`Button ${i + 1}: "${d}"`));
  }

  if (lower.includes('calendar icon')) {
    out.push('');
    out.push('ICON SETUP (required for icons to show):');
    out.push('"icon": "mdi:calendar"');
    out.push('"showIcon": true');
    out.push('"iconPosition": "top"');
  }

  if (lower.includes('border')) {
    out.push('');
    out.push('BORDER WIDGET:');
    out.push('{');
    out.push('  "id": "border-1",');
    out.push('  "type": "border",');
    out.push('  "position": {"x": 0, "y": 0, "width": 500, "height": 300, "zIndex": 999},');
    out.push('  "config": {"borderWidth": 3, "borderColor": "#ffffff", "borderRadius": 3}');
    out.push('}');
  }

  out.push('');
  return out.join('\n');
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

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

  const system = isEdit
    ? promptTemplateStore.getTemplate('systemPromptEdit')
    : promptTemplateStore.getTemplate('systemPromptCreate');

  // Task breakdown only in CREATE mode (edit mode keeps exact widget context)
  const taskBreakdown = isEdit ? '' : buildTaskBreakdown(userRequest);

  const canvasSection = `CANVAS BOUNDS:\nThe view is ${viewWidth}px × ${viewHeight}px. All widgets must stay within: x+width ≤ ${viewWidth}, y+height ≤ ${viewHeight}. Start at x ≥ 10, y ≥ 10.`;

  const currentSection = isEdit
    ? `\nCURRENT WIDGETS ON CANVAS:\n\`\`\`json\n${JSON.stringify(
        { version: '2.0.0', exportedAt: timestamp, view: { id: viewId, name: viewName, widgets: currentWidgets } },
        null, 2,
      )}\n\`\`\`\n\nReturn the COMPLETE updated view with ALL widgets (including unchanged ones).\nCopy each widget's "id" field exactly — do NOT generate new IDs.\n`
    : '';

  const catalog = promptTemplateStore.getTemplate('widgetCatalog') || generateWidgetCatalog();

  const outputFmt = promptTemplateStore.getTemplate('outputFormat')
    .replace('{{timestamp}}', timestamp)
    .replace('{{viewId}}', viewId)
    .replace('{{viewName}}', viewName);

  return [
    system,
    '',
    'USER REQUEST:',
    userRequest,
    '',
    taskBreakdown,
    canvasSection,
    '',
    'AVAILABLE ENTITIES:',
    entityList,
    currentSection,
    'AVAILABLE WIDGETS:',
    catalog,
    '',
    outputFmt,
  ].join('\n').trim();
}
