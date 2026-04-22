import { useCallback } from 'react';
import type { WidgetConfig } from '../../types';

export interface UseWidgetReturn {
  entityData: Record<string, any>;
  updateConfig: (changes: Partial<WidgetConfig>) => void;
  getEntity: (fieldName: string) => any;
  /** Alias kept for compatibility with ported widgets */
  getEntityState: (fieldName: string) => any;
}

export function useWidget(
  _config: WidgetConfig,
  onUpdate?: (updates: Partial<WidgetConfig>) => void,
): UseWidgetReturn {
  const updateConfig = useCallback((changes: Partial<WidgetConfig>) => {
    onUpdate?.(changes);
  }, [onUpdate]);
  return { entityData: {}, updateConfig, getEntity: () => null, getEntityState: () => null };
}
