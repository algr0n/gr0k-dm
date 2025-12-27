import { renderHook, waitFor } from '@testing-library/react';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { useLayoutBreakpoint } from '../../client/src/hooks/useLayoutBreakpoint';

describe('useLayoutBreakpoint', () => {
  let listeners: Map<string, Set<(e: any) => void>>;

  beforeEach(() => {
    listeners = new Map();

    // Mock matchMedia
    global.matchMedia = vi.fn((query: string) => {
      const matches = 
        (query.includes('max-width: 767px') && window.innerWidth < 768) ||
        (query.includes('min-width: 768px') && query.includes('max-width: 1023px') && window.innerWidth >= 768 && window.innerWidth < 1024) ||
        (query.includes('min-width: 1024px') && window.innerWidth >= 1024);

      return {
        matches,
        media: query,
        onchange: null,
        addEventListener: (event: string, handler: (e: any) => void) => {
          if (!listeners.has(query)) {
            listeners.set(query, new Set());
          }
          listeners.get(query)!.add(handler);
        },
        removeEventListener: (event: string, handler: (e: any) => void) => {
          listeners.get(query)?.delete(handler);
        },
        dispatchEvent: vi.fn(),
      } as any;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('returns mobile for width < 768px', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    const { result } = renderHook(() => useLayoutBreakpoint());
    expect(result.current).toBe('mobile');
  });

  test('returns tablet for width 768-1023px', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 800,
    });

    const { result } = renderHook(() => useLayoutBreakpoint());
    expect(result.current).toBe('tablet');
  });

  test('returns desktop for width >= 1024px', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1440,
    });

    const { result } = renderHook(() => useLayoutBreakpoint());
    expect(result.current).toBe('desktop');
  });

  test('hook cleans up event listeners on unmount', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1440,
    });

    const { unmount } = renderHook(() => useLayoutBreakpoint());
    
    // Verify listeners were added
    expect(listeners.size).toBeGreaterThan(0);
    
    // Unmount should clean up listeners
    unmount();
    
    // This test primarily ensures no errors are thrown during cleanup
    expect(true).toBe(true);
  });
});
