import { useEffect, type DependencyList } from 'react';

export function useDebouncedEffect(fn: () => void, deps: DependencyList, delay = 300) {
  useEffect(() => {
    const t = setTimeout(fn, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
