/**
 * Widget registry — maps type key → metadata for the sidebar widget picker.
 *
 * IMPORTANT: Do NOT import widget .tsx component files here.
 * All metadata lives in widget-catalog.ts (pure TypeScript, no React),
 * which prevents static imports from defeating lazy loading in WidgetRenderer.
 */
import type { WidgetMetadata } from './metadata';
import { WIDGET_CATALOG } from './widget-catalog';

export const WIDGET_REGISTRY: Record<string, WidgetMetadata> = WIDGET_CATALOG;

export function getWidgetTypes(): string[] {
  return Object.keys(WIDGET_REGISTRY);
}

export function getWidgetMetadata(type: string): WidgetMetadata | undefined {
  return WIDGET_REGISTRY[type];
}
