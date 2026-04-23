/**
 * CanvasRenderer — pure display of a view (no edit affordances).
 * Used in DisplayPage and as a preview.
 */
import type { ViewConfig, DataSourceValue } from '../../types';
import WidgetRenderer from '../widgets/WidgetRenderer';
import { useDataSourceValues } from '../../context/DataSourceValuesContext';

interface Props {
  view: ViewConfig;
  isEditMode: boolean;
}

function resolveBindings(
  bindings: Record<string, string> | undefined,
  values: Record<string, DataSourceValue>,
): Record<string, DataSourceValue> | undefined {
  if (!bindings || Object.keys(bindings).length === 0) return undefined;
  const result: Record<string, DataSourceValue> = {};
  for (const [field, ref] of Object.entries(bindings)) {
    const dv = values[ref];
    if (dv !== undefined) result[field] = dv;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

export default function CanvasRenderer({ view, isEditMode }: Props) {
  const { style, widgets, sizex = 1920, sizey = 1080 } = view;
  const { values } = useDataSourceValues();

  return (
    <div
      style={{
        position: 'relative',
        width: sizex,
        height: sizey,
        backgroundColor: style.backgroundColor,
        opacity: style.backgroundOpacity ?? 1,
        backgroundImage: style.backgroundImage ? `url(${style.backgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        overflow: 'hidden',
      }}
    >
      {widgets.map((w) => (
        <div
          key={w.id}
          style={{
            position: 'absolute',
            left: w.position.x,
            top: w.position.y,
            width: w.position.width,
            height: w.position.height,
            zIndex: w.position.zIndex ?? 1,
          }}
        >
          <WidgetRenderer
            config={w}
            isEditMode={isEditMode}
            dataValues={resolveBindings(w.bindings, values)}
          />
        </div>
      ))}
    </div>
  );
}
