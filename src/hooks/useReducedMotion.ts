import { useEffect, useState } from 'react';

// Returns true when the OS/browser reports a reduced-motion preference.
// Use to conditionally skip or simplify animations for accessibility.
//
// Note: index.css already handles CSS-level suppression via
// @media (prefers-reduced-motion: reduce). This hook is for JS-driven
// animations or conditional class application.
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return reduced;
}
