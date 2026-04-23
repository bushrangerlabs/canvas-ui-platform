/**
 * WidgetRenderer — lazy-loads the correct widget component by type.
 */
import { lazy, Suspense, Component } from 'react';
import type { WidgetProps } from '../../types';
import type { ErrorInfo, ReactNode } from 'react';

class WidgetErrorBoundary extends Component<{ children: ReactNode; type: string }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[WidgetRenderer] Widget "${this.props.type}" crashed:`, error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          width: '100%', height: '100%', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: '#2a1a1a', color: '#ff6b6b', fontSize: 11, fontFamily: 'monospace', padding: 4,
        }}>
          ⚠ {this.props.type}
        </div>
      );
    }
    return this.props.children;
  }
}

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
  inputtext: lazy(() => import('./InputTextWidget')),
  radiobutton: lazy(() => import('./RadioButtonWidget')),
  colorpicker: lazy(() => import('./ColorPickerWidget')),
  // Layout
  iframe: lazy(() => import('./IFrameWidget')),
  border: lazy(() => import('./BorderWidget')),
  resolution: lazy(() => import('./ResolutionWidget')),
  // Data
  weather: lazy(() => import('./WeatherWidget')),
  graph: lazy(() => import('./GraphWidget')),
  camera: lazy(() => import('./CameraWidget')),
  calendar: lazy(() => import('./CalendarWidget')),
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
    <WidgetErrorBoundary type={props.config.type}>
      <Suspense fallback={<div style={{ width: '100%', height: '100%', background: '#1a1a2e' }} />}>
        <Component {...props} />
      </Suspense>
    </WidgetErrorBoundary>
  );
}
