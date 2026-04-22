/**
 * WidgetRenderer — lazy-loads the correct widget component by type.
 */
import { lazy, Suspense } from 'react';
import type { WidgetProps } from '../../types';

const widgetMap: Record<string, React.LazyExoticComponent<React.FC<WidgetProps>>> = {
  text: lazy(() => import('./TextWidget')),
  gauge: lazy(() => import('./GaugeWidget')),
  image: lazy(() => import('./ImageWidget')),
  progressbar: lazy(() => import('./ProgressBarWidget')),
  iframe: lazy(() => import('./IFrameWidget')),
  border: lazy(() => import('./BorderWidget')),
  flipclock: lazy(() => import('./FlipClockWidget')),
  digitalclock: lazy(() => import('./DigitalClockWidget')),
  scrollingtext: lazy(() => import('./ScrollingTextWidget')),
  html: lazy(() => import('./HtmlWidget')),
  analogclock: lazy(() => import('./AnalogClockWidget')),
  shape: lazy(() => import('./ShapeWidget')),
  resolution: lazy(() => import('./ResolutionWidget')),
};

export default function WidgetRenderer(props: WidgetProps) {
  const Component = widgetMap[props.config.type];
  if (!Component) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#2a2a3e',
          color: '#888',
          fontSize: 12,
          fontFamily: 'monospace',
        }}
      >
        Unknown: {props.config.type}
      </div>
    );
  }

  return (
    <Suspense fallback={<div style={{ width: '100%', height: '100%', background: '#1a1a2e' }} />}>
      <Component {...props} />
    </Suspense>
  );
}
