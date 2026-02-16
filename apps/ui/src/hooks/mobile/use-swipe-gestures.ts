import { useRef, useCallback, useEffect, useState } from 'react';

export interface SwipeCallbacks {
  onSwipeLeft?: () => void | Promise<void>;
  onSwipeRight?: () => void | Promise<void>;
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
}

export interface SwipeGestureOptions {
  threshold?: number; // Minimum distance in pixels to trigger swipe
  velocityThreshold?: number; // Minimum velocity for swipe (px/ms)
  suppressContentWarning?: boolean;
  disabled?: boolean;
}

export interface SwipeState {
  isDragging: boolean;
  dragOffset: number;
  direction: 'left' | 'right' | null;
  progress: number; // 0 to 1, represents swipe progress
}

const DEFAULT_OPTIONS: Required<SwipeGestureOptions> = {
  threshold: 80,
  velocityThreshold: 0.3,
  suppressContentWarning: false,
  disabled: false,
};

/**
 * Hook for handling swipe gestures on touch devices
 * Supports horizontal swipes with visual feedback
 *
 * @example
 * const { swipeState, swipeHandlers } = useSwipeGestures({
 *   onSwipeLeft: () => console.log('Swiped left'),
 *   onSwipeRight: () => console.log('Swiped right'),
 *   threshold: 100,
 * });
 */
export function useSwipeGestures(callbacks: SwipeCallbacks, options: SwipeGestureOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeStart,
    onSwipeEnd,
    threshold,
    velocityThreshold,
    disabled,
  } = opts;

  const [swipeState, setSwipeState] = useState<SwipeState>({
    isDragging: false,
    dragOffset: 0,
    direction: null,
    progress: 0,
  });

  const startX = useRef<number>(0);
  const currentX = useRef<number>(0);
  const startTime = useRef<number>(0);
  const elementRef = useRef<HTMLElement | null>(null);

  const resetState = useCallback(() => {
    setSwipeState({
      isDragging: false,
      dragOffset: 0,
      direction: null,
      progress: 0,
    });
    startX.current = 0;
    currentX.current = 0;
    startTime.current = 0;
  }, []);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled) return;

      const touch = e.touches[0];
      startX.current = touch.clientX;
      currentX.current = touch.clientX;
      startTime.current = Date.now();

      setSwipeState({
        isDragging: true,
        dragOffset: 0,
        direction: null,
        progress: 0,
      });

      onSwipeStart?.();
    },
    [disabled, onSwipeStart]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (disabled || !swipeState.isDragging) return;

      const touch = e.touches[0];
      currentX.current = touch.clientX;
      const deltaX = currentX.current - startX.current;

      // Determine direction based on movement
      const direction = deltaX > 0 ? 'right' : 'left';

      // Calculate progress (capped at 1)
      const progress = Math.min(Math.abs(deltaX) / threshold, 1);

      setSwipeState({
        isDragging: true,
        dragOffset: deltaX,
        direction,
        progress,
      });
    },
    [disabled, swipeState.isDragging, threshold]
  );

  const handleTouchEnd = useCallback(async () => {
    if (disabled || !swipeState.isDragging) return;

    const deltaX = currentX.current - startX.current;
    const deltaTime = Date.now() - startTime.current;
    const velocity = Math.abs(deltaX) / Math.max(deltaTime, 1);

    const absDeltaX = Math.abs(deltaX);

    // Determine if swipe meets threshold or velocity requirements
    const isSwipeLeft = deltaX < 0 && (absDeltaX >= threshold || velocity >= velocityThreshold);
    const isSwipeRight = deltaX > 0 && (absDeltaX >= threshold || velocity >= velocityThreshold);

    // Reset dragging state
    setSwipeState((prev) => ({
      ...prev,
      isDragging: false,
    }));

    try {
      if (isSwipeLeft && onSwipeLeft) {
        await onSwipeLeft();
      } else if (isSwipeRight && onSwipeRight) {
        await onSwipeRight();
      }
    } finally {
      // Reset state after callbacks
      resetState();
      onSwipeEnd?.();
    }
  }, [
    disabled,
    swipeState.isDragging,
    threshold,
    velocityThreshold,
    onSwipeLeft,
    onSwipeRight,
    onSwipeEnd,
    resetState,
  ]);

  const handleTouchCancel = useCallback(() => {
    if (disabled) return;
    resetState();
    onSwipeEnd?.();
  }, [disabled, resetState, onSwipeEnd]);

  // Bind events to element
  const ref = useCallback(
    (node: HTMLElement | null) => {
      if (node) {
        elementRef.current = node;
        // Use passive: false for touchstart/touchmove to allow preventDefault if needed
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
      if (elementRef.current) {
        elementRef.current.removeEventListener('touchstart', handleTouchStart);
        elementRef.current.removeEventListener('touchmove', handleTouchMove);
        elementRef.current.removeEventListener('touchend', handleTouchEnd);
        elementRef.current.removeEventListener('touchcancel', handleTouchCancel);
        elementRef.current = null;
      }
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel]);

  return {
    ref,
    swipeState,
  };
}

/**
 * Hook specifically for staging/unstaging files with swipe
 * Swipe right to stage, swipe left to unstage
 */
export function useFileSwipeGestures(
  onStage: () => void | Promise<void>,
  onUnstage: () => void | Promise<void>,
  options?: SwipeGestureOptions
) {
  return useSwipeGestures(
    {
      onSwipeRight: onStage,
      onSwipeLeft: onUnstage,
    },
    options
  );
}

/**
 * Hook specifically for stash operations with swipe
 * Swipe right to apply, swipe left to drop
 */
export function useStashSwipeGestures(
  onApply: () => void | Promise<void>,
  onDrop: () => void | Promise<void>,
  options?: SwipeGestureOptions
) {
  return useSwipeGestures(
    {
      onSwipeRight: onApply,
      onSwipeLeft: onDrop,
    },
    options
  );
}
