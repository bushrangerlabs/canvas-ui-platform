import { useCallback } from 'react';
import type { WidgetConfig } from '../../types';
import { useHAEntities } from '../../context/HAEntitiesContext';

export interface UseWidgetReturn {
  entityData: Record<string, any>;
  updateConfig: (changes: Partial<WidgetConfig>) => void;
  getEntity: (fieldName: string) => any;
  /** Returns the entity state string for the entity bound to fieldName */
  getEntityState: (fieldName: string) => string | null;
  isEntityAvailable: (fieldName: string) => boolean;
}

export function useWidget(
  config: WidgetConfig,
  onUpdate?: (updates: Partial<WidgetConfig>) => void,
): UseWidgetReturn {
  const { getState, getEntity, entities } = useHAEntities();

  const updateConfig = useCallback((changes: Partial<WidgetConfig>) => {
    onUpdate?.(changes);
  }, [onUpdate]);

  const getEntityState = useCallback((fieldName: string): string | null => {
    const entityId = config.config[fieldName] as string | undefined;
    if (!entityId) return null;
    return getState(entityId);
  }, [config.config, getState]);

  const getEntityObj = useCallback((fieldName: string) => {
    const entityId = config.config[fieldName] as string | undefined;
    if (!entityId) return null;
    return getEntity(entityId);
  }, [config.config, getEntity]);

  const isEntityAvailable = useCallback((fieldName: string): boolean => {
    const entityId = config.config[fieldName] as string | undefined;
    if (!entityId) return false;
    return entityId in entities;
  }, [config.config, entities]);

  return {
    entityData: entities,
    updateConfig,
    getEntity: getEntityObj,
    getEntityState,
    isEntityAvailable,
  };
}
