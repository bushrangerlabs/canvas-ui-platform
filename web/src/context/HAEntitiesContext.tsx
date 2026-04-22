/**
 * HAEntitiesContext — provides live HA entity states to the whole app.
 * Subscribes to the platform WebSocket for real-time ha_state_update pushes.
 * Falls back to polling /api/ha/states every 60 s when WS is unavailable.
 */
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api/client';
import { usePlatformWS } from '../hooks/usePlatformWS';

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

const POLL_INTERVAL_MS = 60_000;

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

  // Real-time updates from the platform WS server
  const handleWsMessage = useCallback((msg: any) => {
    if (msg.type === 'ha_state_update') {
      setEntities((prev) => ({
        ...prev,
        [msg.entity_id]: {
          entity_id: msg.entity_id,
          state: msg.state,
          attributes: msg.attributes ?? {},
          last_updated: msg.last_updated ?? new Date().toISOString(),
          last_changed: msg.last_changed ?? new Date().toISOString(),
        },
      }));
    }
  }, []);
  usePlatformWS(handleWsMessage);

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
