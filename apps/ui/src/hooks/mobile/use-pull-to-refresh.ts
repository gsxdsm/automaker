import { useRef, useCallback, useEffect, useState } from 'react';

export interface PullToRefreshCallbacks {
  onRefresh: () => void | Promise<void>;
}

export interface PullToRefreshOptions {
  threshold?: number; // Distance in pixels to trigger refresh
  debounceMs?: number; // Debounce delay for refresh
  disabled?: boolean;
}

export interface PullToRefreshState {
  isPulling: boolean;
  isRefreshing: boolean;
  pullDistance: number;
  pullProgress: number; // 0 to 1
  shouldRefresh: boolean; // True when pull distance exceeds threshold
}

const DEFAULT_OPTIONS: Required<Omit<PullToRefreshOptions, 'debounceMs'>> & { debounceMs: number } =
  {
    threshold: 80,
    debounceMs: 300,
    disabled: false,
  };

/**
 * Hook for implementing pull-to-refresh functionality
 * Provides visual feedback as user pulls down and triggers refresh on release
 *
 * @example
 * const { pullState, refreshHandlers, refreshTrigger } = usePullToRefresh({
 *   onRefresh: async () => {
 *     await fetchData();
 *   },
 *   threshold: 100,
 * });
 */
export function usePullToRefresh(
  callbacks: PullToRefreshCallbacks,
  options: PullToRefreshOptions = {}
) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { onRefresh, threshold, debounceMs, disabled } = opts;

  const [pullState, setPullState] = useState<PullToRefreshState>({
    isPulling: false,
    isRefreshing: false,
    pullDistance: 0,
    pullProgress: 0,
    shouldRefresh: false,
  });

  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);
  const elementRef = useRef<HTMLElement | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetState = useCallback(() => {
    setPullState({
      isPulling: false,
      isRefreshing: false,
      pullDistance: 0,
      pullProgress: 0,
      shouldRefresh: false,
    });
    startY.current = 0;
    currentY.current = 0;
  }, []);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled) return;

      const touch = e.touches[0];
      const target = e.target as HTMLElement;

      // Check if we're at the top of the scrollable element
      const scrollTop = target.scrollTop || elementRef.current?.scrollTop || 0;
      if (scrollTop > 0) return;

      startY.current = touch.clientY;
      currentY.current = touch.clientY;

      setPullState({
        isPulling: true,
        isRefreshing: false,
        pullDistance: 0,
        pullProgress: 0,
        shouldRefresh: false,
      });
    },
    [disabled]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (disabled || !pullState.isPulling) return;

      const touch = e.touches[0];
      currentY.current = touch.clientY;
      const deltaY = currentY.current - startY.current;

      // Only allow pulling down (positive delta)
      if (deltaY <= 0) {
        setPullState((prev) => ({
          ...prev,
          pullDistance: 0,
          pullProgress: 0,
          shouldRefresh: false,
        }));
        return;
      }

      // Add resistance as user pulls further
      const resistance = deltaY > threshold ? 1 + (deltaY - threshold) / threshold / 2 : 1;
      const pullDistance = deltaY / resistance;

      // Calculate progress (capped at 1)
      const pullProgress = Math.min(pullDistance / threshold, 1);

      setPullState({
        isPulling: true,
        isRefreshing: false,
        pullDistance,
        pullProgress,
        shouldRefresh: pullProgress >= 1,
      });
    },
    [disabled, pullState.isPulling, threshold]
  );

  const handleTouchEnd = useCallback(async () => {
    if (disabled || !pullState.isPulling) return;

    // Clear any pending debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // Check if pull distance exceeds threshold
    if (pullState.shouldRefresh) {
      setPullState((prev) => ({
        ...prev,
        isPulling: false,
        isRefreshing: true,
      }));

      try {
        // Debounce the refresh to prevent rapid successive refreshes
        await new Promise<void>((resolve) => {
          debounceTimerRef.current = setTimeout(async () => {
            await onRefresh();
            resolve();
          }, debounceMs);
        });
      } finally {
        // Reset state after refresh
        setPullState({
          isPulling: false,
          isRefreshing: false,
          pullDistance: 0,
          pullProgress: 0,
          shouldRefresh: false,
        });
      }
    } else {
      // Reset without refreshing
      resetState();
    }
  }, [disabled, pullState.isPulling, pullState.shouldRefresh, onRefresh, debounceMs, resetState]);

  const handleTouchCancel = useCallback(() => {
    if (disabled) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    resetState();
  }, [disabled, resetState]);

  // Bind events to element
  const ref = useCallback(
    (node: HTMLElement | null) => {
      if (node) {
        elementRef.current = node;
        // Use passive: false to allow preventDefault if needed
        node.addEventListener('touchstart', handleTouchStart, { passive: false });
        node.addEventListener('touchmove', handleTouchMove, { passive: false });
        node.addEventListener('touchend', handleTouchEnd);
        node.addEventListener('touchcancel', handleTouchCancel);
      } else if (elementRef.current) {
        // Cleanup
        elementRef.current.removeEventListener('touchstart', handleTouchStart);
        elementRef.current.removeEventListener('touchmove', handleTouchMove);
        elementRef.current.removeEventListener('touchend', handleTouchEnd);
        elementRef.current.removeEventListener('touchcancel', handleTouchCancel);
        elementRef.current = null;
      }
    },
    [handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear any pending debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      // Remove event listeners
      if (elementRef.current) {
        elementRef.current.removeEventListener('touchstart', handleTouchStart);
        elementRef.current.removeEventListener('touchmove', handleTouchMove);
        elementRef.current.removeEventListener('touchend', handleTouchEnd);
        elementRef.current.removeEventListener('touchcancel', handleTouchCancel);
        elementRef.current = null;
      }
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel]);

  // Manual refresh trigger
  const refreshTrigger = useCallback(async () => {
    if (disabled || pullState.isRefreshing || pullState.isPulling) return;

    setPullState((prev) => ({
      ...prev,
      isRefreshing: true,
    }));

    try {
      await onRefresh();
    } finally {
      setPullState({
        isPulling: false,
        isRefreshing: false,
        pullDistance: 0,
        pullProgress: 0,
        shouldRefresh: false,
      });
    }
  }, [disabled, pullState.isRefreshing, pullState.isPulling, onRefresh]);

  return {
    ref,
    pullState,
    refreshTrigger,
  };
}
