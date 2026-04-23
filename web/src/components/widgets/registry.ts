/**
 * Widget registry — maps type key → metadata for the sidebar widget picker.
 * Widgets not yet ported (HA-specific) are excluded.
 */
import type { WidgetMetadata } from './metadata';
import { TextWidgetMetadata } from './TextWidget';
import { GaugeWidgetMetadata } from './GaugeWidget';
import { ImageWidgetMetadata } from './ImageWidget';
import { ProgressBarWidgetMetadata } from './ProgressBarWidget';
import { ProgressCircleWidgetMetadata } from './ProgressCircleWidget';
import { IFrameWidgetMetadata } from './IFrameWidget';
import { BorderWidgetMetadata } from './BorderWidget';
import { FlipClockWidgetMetadata } from './FlipClockWidget';
import { DigitalClockWidgetMetadata } from './DigitalClockWidget';
import { ScrollingTextWidgetMetadata } from './ScrollingTextWidget';
import { htmlWidgetMetadata } from './HtmlWidget';
import { analogClockMetadata } from './AnalogClockWidget';
import { ShapeWidgetMetadata } from './ShapeWidget';
import { resolutionWidgetMetadata } from './ResolutionWidget';
import { ButtonWidgetMetadata } from './ButtonWidget';
import { SwitchWidgetMetadata } from './SwitchWidget';
import { SliderWidgetMetadata } from './SliderWidget';
import { ValueWidgetMetadata } from './ValueWidget';
import { iconWidgetMetadata } from './IconWidget';
import { KnobWidgetMetadata } from './KnobWidget';
import { InputTextWidgetMetadata } from './InputTextWidget';
import { RadioButtonWidgetMetadata } from './RadioButtonWidget';
import { ColorPickerWidgetMetadata } from './ColorPickerWidget';
import { WeatherWidgetMetadata } from './WeatherWidget';
import { GraphWidgetMetadata } from './GraphWidget';
import { CameraWidgetMetadata } from './CameraWidget';

export const WIDGET_REGISTRY: Record<string, WidgetMetadata> = {
  // Display
  text: TextWidgetMetadata,
  value: ValueWidgetMetadata,
  gauge: GaugeWidgetMetadata,
  progressbar: ProgressBarWidgetMetadata,
  progresscircle: ProgressCircleWidgetMetadata,
  image: ImageWidgetMetadata,
  icon: iconWidgetMetadata,
  html: htmlWidgetMetadata,
  scrollingtext: ScrollingTextWidgetMetadata,
  shape: ShapeWidgetMetadata,
  // Clocks
  analogclock: analogClockMetadata,
  flipclock: FlipClockWidgetMetadata,
  digitalclock: DigitalClockWidgetMetadata,
  // Controls
  button: ButtonWidgetMetadata,
  switch: SwitchWidgetMetadata,
  slider: SliderWidgetMetadata,
  knob: KnobWidgetMetadata,
  inputtext: InputTextWidgetMetadata,
  radiobutton: RadioButtonWidgetMetadata,
  colorpicker: ColorPickerWidgetMetadata,
  // Layout
  iframe: IFrameWidgetMetadata,
  border: BorderWidgetMetadata,
  resolution: resolutionWidgetMetadata,
  // Data
  weather: WeatherWidgetMetadata,
  graph: GraphWidgetMetadata,
  // Media
  camera: CameraWidgetMetadata,
};

export function getWidgetTypes(): string[] {
  return Object.keys(WIDGET_REGISTRY);
}

export function getWidgetMetadata(type: string): WidgetMetadata | undefined {
  return WIDGET_REGISTRY[type];
}
