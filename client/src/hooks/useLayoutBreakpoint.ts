import { useState, useEffect } from 'react';

export type LayoutBreakpoint = 'mobile' | 'tablet' | 'desktop';

/**
 * Hook to detect the current layout breakpoint based on window width.
 * Uses matchMedia for efficient, event-driven updates.
 * 
 * Breakpoints:
 * - mobile: < 768px
 * - tablet: 768px - 1023px
 * - desktop: >= 1024px
 */
export function useLayoutBreakpoint(): LayoutBreakpoint {
  const [breakpoint, setBreakpoint] = useState<LayoutBreakpoint>(() => {
    // Initialize based on current window width
    if (typeof window === 'undefined') return 'desktop';
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  });

  useEffect(() => {
    // Define media queries
    const mobileQuery = window.matchMedia('(max-width: 767px)');
    const tabletQuery = window.matchMedia('(min-width: 768px) and (max-width: 1023px)');
    const desktopQuery = window.matchMedia('(min-width: 1024px)');

    // Handler to update breakpoint
    const updateBreakpoint = () => {
      if (mobileQuery.matches) {
        setBreakpoint('mobile');
      } else if (tabletQuery.matches) {
        setBreakpoint('tablet');
      } else if (desktopQuery.matches) {
        setBreakpoint('desktop');
      }
    };

    // Add listeners
    mobileQuery.addEventListener('change', updateBreakpoint);
    tabletQuery.addEventListener('change', updateBreakpoint);
    desktopQuery.addEventListener('change', updateBreakpoint);

    // Initial check
    updateBreakpoint();

    // Cleanup
    return () => {
      mobileQuery.removeEventListener('change', updateBreakpoint);
      tabletQuery.removeEventListener('change', updateBreakpoint);
      desktopQuery.removeEventListener('change', updateBreakpoint);
    };
  }, []);

  return breakpoint;
}
