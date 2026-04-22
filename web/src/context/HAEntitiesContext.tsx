/**
 * HAEntitiesContext — provides live HA entity states to the whole app.
 * Polls /api/ha/states every 30 s and exposes a getState() helper.
 */
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api/client';

export interface HAEntityState {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_updated: string;
  last_changed: string;
}

interface HAEntitiesContextValue {
  /** Map of entity_id → entity state */
  entities: Record<string, HAEntityState>;
  /** Returns the state string for the entity, or null if not found */
  getState: (entityId: string) => string | null;
  /** Returns the full entity object, or null if not found */
  getEntity: (entityId: string) => HAEntityState | null;
  /** True while the first fetch is in progress */
  loading: boolean;
}

const HAEntitiesContext = createContext<HAEntitiesContextValue>({
  entities: {},
  getState: () => null,
  getEntity: () => null,
  loading: false,
});

export function useHAEntities() {
  return useContext(HAEntitiesContext);
}

const POLL_INTERVAL_MS = 30_000;

export function HAEntitiesProvider({ children }: { children: ReactNode }) {
  const [entities, setEntities] = useState<Record<string, HAEntityState>>({});
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStates = useCallback(async () => {
    try {
      const states = await api.get<HAEntityState[]>('/api/ha/states');
      const map: Record<string, HAEntityState> = {};
      for (const s of states) map[s.entity_id] = s;
      setEntities(map);
    } catch (err) {
      // Silently ignore — HA might not be connected in dev mode
      console.warn('[HAEntities] Failed to fetch states:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStates();
    timerRef.current = setInterval(fetchStates, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchStates]);

  const getState = useCallback(
    (entityId: string) => entities[entityId]?.state ?? null,
    [entities],
  );

  const getEntity = useCallback(
    (entityId: string) => entities[entityId] ?? null,
    [entities],
  );

  return (
    <HAEntitiesContext.Provider value={{ entities, getState, getEntity, loading }}>
      {children}
    </HAEntitiesContext.Provider>
  );
}
