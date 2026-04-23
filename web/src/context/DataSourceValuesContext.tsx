/**
 * DataSourceValuesContext
 * Tracks live data-source values pushed by the server via WebSocket
 * `data_update` messages.  Values are keyed as "<sourceId>.<key>".
 */
import React, { createContext, useCallback, useContext, useState } from 'react';
import type { DataSourceValue } from '../types';
import { usePlatformWS } from '../hooks/usePlatformWS';

type ValuesMap = Record<string, DataSourceValue>;

interface DataSourceValuesContextType {
  values: ValuesMap;
  getValue: (ref: string) => DataSourceValue | undefined;
}

const DataSourceValuesContext = createContext<DataSourceValuesContextType>({
  values: {},
  getValue: () => undefined,
});

export function DataSourceValuesProvider({ children }: { children: React.ReactNode }) {
  const [values, setValues] = useState<ValuesMap>({});

  const handleMessage = useCallback((msg: any) => {
    if (msg.type === 'data_update') {
      const key = `${msg.sourceId}.${msg.key}`;
      const entry: DataSourceValue = {
        id: msg.sourceId,
        key: msg.key,
        value: msg.value,
        unit: msg.unit,
        last_updated: new Date().toISOString(),
      };
      setValues((prev) => ({ ...prev, [key]: entry }));
    }
  }, []);

  usePlatformWS(handleMessage);

  const getValue = useCallback((ref: string) => values[ref], [values]);

  return (
    <DataSourceValuesContext.Provider value={{ values, getValue }}>
      {children}
    </DataSourceValuesContext.Provider>
  );
}

export function useDataSourceValues() {
  return useContext(DataSourceValuesContext);
}
