import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_CATEGORIES, getSettings } from '@/db/repository';
import { createDefaultCustomFields } from '@/lib/templates';
import type { SettingsBundle } from '@/types';

interface SettingsContextValue {
  settings: SettingsBundle;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

const DEFAULT_SETTINGS: SettingsBundle = {
  categories: [...DEFAULT_CATEGORIES],
  customFields: createDefaultCustomFields(),
  preferences: {
    appTitle: 'Kores Employee Records',
    organisation: 'PEFCO FOUNDRY DIVISION (BHOSARI)',
    currency: 'INR',
    footerNote: '',
    defaultPageSize: 'A4',
    defaultOrientation: 'portrait',
    showImagesInReports: true,
    showQuantities: false,
    defaultCategory: 'Casual',
  },
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SettingsBundle>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      const loaded = await getSettings();
      setSettings(loaded);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The settings could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo<SettingsContextValue>(() => ({ settings, loading, error, reload }), [settings, loading, error, reload]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used inside a SettingsProvider.');
  return context;
}
