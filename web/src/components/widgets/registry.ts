/**
 * Widget registry — maps type key → metadata for the sidebar widget picker.
 * Widgets not yet ported (HA-specific) are excluded.
 */
import type { WidgetMetadata } from './metadata';
import { TextWidgetMetadata } from './TextWidget';
import { GaugeWidgetMetadata } from './GaugeWidget';
import { ImageWidgetMetadata } from './ImageWidget';
import { ProgressBarWidgetMetadata } from './ProgressBarWidget';
import { IFrameWidgetMetadata } from './IFrameWidget';
import { BorderWidgetMetadata } from './BorderWidget';
import { FlipClockWidgetMetadata } from './FlipClockWidget';
import { DigitalClockWidgetMetadata } from './DigitalClockWidget';
import { ScrollingTextWidgetMetadata } from './ScrollingTextWidget';
import { htmlWidgetMetadata } from './HtmlWidget';
import { analogClockMetadata } from './AnalogClockWidget';
import { ShapeWidgetMetadata } from './ShapeWidget';
import { resolutionWidgetMetadata } from './ResolutionWidget';

export const WIDGET_REGISTRY: Record<string, WidgetMetadata> = {
  text: TextWidgetMetadata,
  gauge: GaugeWidgetMetadata,
  image: ImageWidgetMetadata,
  progressbar: ProgressBarWidgetMetadata,
  iframe: IFrameWidgetMetadata,
  border: BorderWidgetMetadata,
  flipclock: FlipClockWidgetMetadata,
  digitalclock: DigitalClockWidgetMetadata,
  scrollingtext: ScrollingTextWidgetMetadata,
  html: htmlWidgetMetadata,
  analogclock: analogClockMetadata,
  shape: ShapeWidgetMetadata,
  resolution: resolutionWidgetMetadata,
};

export function getWidgetTypes(): string[] {
  return Object.keys(WIDGET_REGISTRY);
}

export function getWidgetMetadata(type: string): WidgetMetadata | undefined {
  return WIDGET_REGISTRY[type];
}
