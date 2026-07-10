import { useState, useCallback, useRef } from 'react';

export function useLoadData<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(() => {
    setLoading(true);
    return fetcherRef.current()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, load, setData };
}
