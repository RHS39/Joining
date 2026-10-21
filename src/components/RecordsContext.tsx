import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { listRecords, migrateRenamedFields } from '@/db/repository';
import type { DataRecord } from '@/types';

interface RecordsContextValue {
  records: DataRecord[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

const RecordsContext = createContext<RecordsContextValue | null>(null);

export function RecordsProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<DataRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      // A field that was renamed takes its values with it.
      await migrateRenamedFields();
      const rows = await listRecords();
      setRecords(rows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The employee records could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo<RecordsContextValue>(() => ({ records, loading, error, reload }), [records, loading, error, reload]);

  return <RecordsContext.Provider value={value}>{children}</RecordsContext.Provider>;
}

export function useRecords(): RecordsContextValue {
  const context = useContext(RecordsContext);
  if (!context) throw new Error('useRecords must be used inside a RecordsProvider.');
  return context;
}
