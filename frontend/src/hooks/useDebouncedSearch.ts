import { useState, useEffect, useCallback } from 'react';

interface UseDebouncedSearchResult<T> {
  data: T[];
  loading: boolean;
  search: string;
  setSearch: (val: string) => void;
  reload: () => void;
}

export function useDebouncedSearch<T>(
  fetchFn: (search?: string) => Promise<T[]>,
  deps: any[] = [],
  debounceMs = 300,
): UseDebouncedSearchResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const reload = useCallback(() => {
    setLoading(true);
    fetchFn(search || undefined).then(setData).finally(() => setLoading(false));
  }, [search, ...deps]);

  useEffect(() => { reload(); }, []);
  useEffect(() => {
    const t = setTimeout(reload, debounceMs);
    return () => clearTimeout(t);
  }, [search]);

  return { data, loading, search, setSearch, reload };
}
