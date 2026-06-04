import { useState, useEffect } from "react";

/**
 * Subscribe to a CSS media query. Returns true when it matches.
 * Used for desktop-safe responsive layouts: components render their existing
 * desktop markup when this is false, and an adapted layout only when true.
 *
 * Example: const isNarrow = useMediaQuery("(max-width: 860px)"); // iPad portrait + phones
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
