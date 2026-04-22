/**
 * CanvasRenderer — pure display of a view (no edit affordances).
 * Used in DisplayPage and as a preview.
 */
import type { ViewConfig } from '../../types';
import WidgetRenderer from '../widgets/WidgetRenderer';

interface Props {
  view: ViewConfig;
  isEditMode: boolean;
}

export default function CanvasRenderer({ view, isEditMode }: Props) {
  const { style, widgets, sizex = 1920, sizey = 1080 } = view;

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
          <WidgetRenderer config={w} isEditMode={isEditMode} />
        </div>
      ))}
    </div>
  );
}
