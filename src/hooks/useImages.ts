import { useEffect, useMemo, useState } from 'react';
import { getImagesForRecords } from '@/db/repository';
import type { ImageAttachment } from '@/types';

/** Load the images of several records at once. */
export function useImagesMap(recordKeys: string[]): Map<string, ImageAttachment> {
  const [map, setMap] = useState<Map<string, ImageAttachment>>(() => new Map());
  const key = useMemo(() => [...recordKeys].sort().join('|'), [recordKeys]);

  useEffect(() => {
    let cancelled = false;
    const keys = key === '' ? [] : key.split('|');
    const load = async () => {
      const result = await getImagesForRecords(keys);
      if (!cancelled) setMap(result);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [key]);

  return map;
}

/** Create (and clean up) an object URL for a blob. */
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return undefined;
    }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [blob]);

  return url;
}
