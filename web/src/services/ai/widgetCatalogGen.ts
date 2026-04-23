/**
 * widgetCatalogGen — generates compact AI prompt catalog from WIDGET_CATALOG.
 *
 * Extracted to its own file so both PromptBuilder and PromptTemplateStore can
 * import it without a circular dependency.
 */
import type { FieldMetadata } from '../../components/widgets/metadata';
import { WIDGET_CATALOG } from '../../components/widgets/widget-catalog';

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

let _cache: string | null = null;

export function generateWidgetCatalog(): string {
  if (_cache) return _cache;

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
    '  chamfer=45° diagonal cut; rounded=smooth arc (default)',
    'Shadow: boxShadow(text), shadowColor(color)',
    '',
    '=== WIDGET-SPECIFIC PROPERTIES ===',
  ];

  for (const [type, meta] of Object.entries(WIDGET_CATALOG).sort(([a], [b]) => a.localeCompare(b))) {
    if (!meta?.fields) continue;
    const specific = meta.fields.filter(f =>
      !UNIVERSAL.has(f.name) && !LAYOUT.has(f.name) && !f.visibleWhen,
    );
    if (specific.length === 0) {
      lines.push(`${type}: (uses only universal properties)`);
    } else {
      lines.push(`${type}:`);
      for (const f of specific) lines.push(formatField(f));
    }
    lines.push('');
  }

  _cache = lines.join('\n');
  return _cache;
}
