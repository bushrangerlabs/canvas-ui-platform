/**
 * WidgetRenderer — lazy-loads the correct widget component by type.
 */
import { lazy, Suspense } from 'react';
import type { WidgetProps } from '../../types';

const widgetMap: Record<string, React.LazyExoticComponent<React.FC<WidgetProps>>> = {
  // Display
  text: lazy(() => import('./TextWidget')),
  value: lazy(() => import('./ValueWidget')),
  gauge: lazy(() => import('./GaugeWidget')),
  progressbar: lazy(() => import('./ProgressBarWidget')),
  progresscircle: lazy(() => import('./ProgressCircleWidget')),
  image: lazy(() => import('./ImageWidget')),
  icon: lazy(() => import('./IconWidget')),
  html: lazy(() => import('./HtmlWidget')),
  scrollingtext: lazy(() => import('./ScrollingTextWidget')),
  shape: lazy(() => import('./ShapeWidget')),
  // Clocks
  analogclock: lazy(() => import('./AnalogClockWidget')),
  flipclock: lazy(() => import('./FlipClockWidget')),
  digitalclock: lazy(() => import('./DigitalClockWidget')),
  // Controls
  button: lazy(() => import('./ButtonWidget')),
  switch: lazy(() => import('./SwitchWidget')),
  slider: lazy(() => import('./SliderWidget')),
  knob: lazy(() => import('./KnobWidget')),
  // Layout
  iframe: lazy(() => import('./IFrameWidget')),
  border: lazy(() => import('./BorderWidget')),
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
