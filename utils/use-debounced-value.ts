"use client";

import { useEffect, useState } from "react";

// Returns `value` after it has stopped changing for `delay` ms. Pair with
// query keys (e.g. TanStack Query) so the *key* debounces, not just the fetch
// — that way cache hits are still instant.
export function useDebouncedValue<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(handle);
  }, [value, delay]);

  return debounced;
}
