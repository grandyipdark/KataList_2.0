import Fuse from 'fuse.js';
import { useMemo } from 'react';

export const useFuzzySearch = <T>(
  data: T[],
  searchQuery: string,
  options: any
): T[] => {
  const fuse = useMemo(() => {
      // Basic safeguard for data validity
      if (!data || data.length === 0) return null;
      return new Fuse(data, options);
  }, [data, options]);
  
  return useMemo(() => {
    if (!searchQuery || !fuse) return data;
    const results = fuse.search(searchQuery);
    return results.map(result => result.item);
  }, [fuse, searchQuery, data]);
};