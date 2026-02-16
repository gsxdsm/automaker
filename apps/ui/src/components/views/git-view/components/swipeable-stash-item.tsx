import { useState, useCallback, useEffect, useRef } from 'react';
import { Archive, ChevronDown, ChevronRight, RefreshCw, Eye, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useStashSwipeGestures } from '@/hooks/mobile';
import type { StashEntry } from '../types';

interface SwipeableStashItemProps {
  stash: StashEntry;
  onApply: () => void;
  onPop: () => void;
  onDrop: () => void;
  onViewDiff: () => void;
  isPending?: boolean;
  pendingAction?: 'apply' | 'pop' | 'drop';
}

// Constants
const SWIPE_THRESHOLD = 100;
const ACTION_FEEDBACK_TIMEOUT_MS = 1500;
const MIN_TAP_TARGET_SIZE = 44; // iOS HIG minimum touch target

/**
 * Swipeable Stash Item Component for Mobile
 *
 * - Swipe right to apply stash
 * - Swipe left to drop stash
 * - Visual feedback during swipe
 * - Action buttons appear on hover (desktop) or are always visible (mobile)
 */
export function SwipeableStashItem({
  stash,
  onApply,
  onPop,
  onDrop,
  onViewDiff,
  isPending = false,
  pendingAction,
}: SwipeableStashItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<'apply' | 'drop' | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Parse message to extract branch info if available
  const { branchInfo, displayMessage } = (() => {
    const messageParts = stash.message.split(': ');
    const branch = messageParts.length > 1 ? messageParts[0] : null;
    const message = messageParts.length > 1 ? messageParts.slice(1).join(': ') : stash.message;
    return { branchInfo: branch, displayMessage: message };
  })();

  const handleSwipeStart = useCallback(() => {
    setActionFeedback(null);
  }, []);

  const handleSwipeRight = useCallback(async () => {
    setActionFeedback('apply');
    await onApply();

    // Clear any existing timeout
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }

    // Set new timeout with cleanup
    feedbackTimeoutRef.current = setTimeout(() => {
      setActionFeedback(null);
      feedbackTimeoutRef.current = null;
    }, ACTION_FEEDBACK_TIMEOUT_MS);
  }, [onApply]);

  const handleSwipeLeft = useCallback(async () => {
    setActionFeedback('drop');
    await onDrop();

    // Clear any existing timeout
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }

    // Set new timeout with cleanup
    feedbackTimeoutRef.current = setTimeout(() => {
      setActionFeedback(null);
      feedbackTimeoutRef.current = null;
    }, ACTION_FEEDBACK_TIMEOUT_MS);
  }, [onDrop]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  const { swipeState, ref } = useStashSwipeGestures(handleSwipeRight, handleSwipeLeft, {
    threshold: SWIPE_THRESHOLD,
    onSwipeStart: handleSwipeStart,
  });

  return (
    <div ref={ref} className="relative border-b border-border/50 last:border-0 overflow-hidden">
      {/* Background Actions - shown during swipe */}
      <div className="absolute inset-0 flex">
        {/* Apply Action (Right - Green) */}
        <div
          className={cn(
            'flex-1 flex items-center justify-end pr-4 transition-colors',
            swipeState.direction === 'right' && swipeState.isDragging
              ? 'bg-green-500'
              : 'bg-green-500/80'
          )}
          style={{
            opacity: swipeState.direction === 'right' ? swipeState.progress : 0,
          }}
        >
          <RefreshCw className="h-6 w-6 text-white" />
        </div>

        {/* Drop Action (Left - Red) */}
        <div
          className={cn(
            'flex-1 flex items-center justify-start pl-4 transition-colors',
            swipeState.direction === 'left' && swipeState.isDragging
              ? 'bg-red-500'
              : 'bg-red-500/80'
          )}
          style={{
            opacity: swipeState.direction === 'left' ? swipeState.progress : 0,
          }}
        >
          <X className="h-6 w-6 text-white" />
        </div>
      </div>

      {/* Action Feedback Overlay */}
      {actionFeedback && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20 animate-in fade-in">
          <div className="flex items-center gap-2 text-white font-medium">
            {actionFeedback === 'apply' ? (
              <>
                <RefreshCw className="h-5 w-5 animate-spin" />
                <span>Applying...</span>
              </>
            ) : (
              <>
                <X className="h-5 w-5" />
                <span>Dropped</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div
        className={cn(
          'relative bg-background transition-transform',
          swipeState.isDragging && 'will-change-transform'
        )}
        style={{
          transform: `translateX(${swipeState.dragOffset}px)`,
        }}
      >
        {/* Main row */}
        <div className="flex items-start gap-2 px-3 py-3 min-h-[56px]">
          {/* Expand/Collapse Button */}
          <button
            className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors mt-0.5 touch-manipulation"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? 'Collapse stash details' : 'Expand stash details'}
            style={{ minWidth: MIN_TAP_TARGET_SIZE, minHeight: MIN_TAP_TARGET_SIZE }}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>

          {/* Stash Icon */}
          <Archive className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />

          {/* Stash Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{displayMessage}</span>
              {branchInfo && (
                <span className="text-xs text-muted-foreground shrink-0">on {branchInfo}</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground font-mono">{stash.hash.slice(0, 7)}</div>
          </div>

          {/* Action Buttons - Always visible on mobile */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 touch-manipulation"
              title="View diff"
              onClick={onViewDiff}
              disabled={isPending}
              style={{ minWidth: MIN_TAP_TARGET_SIZE, minHeight: MIN_TAP_TARGET_SIZE }}
            >
              <span className="sr-only">View diff</span>
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 touch-manipulation text-green-500 hover:text-green-600"
              title="Apply stash"
              onClick={onApply}
              disabled={isPending}
              style={{ minWidth: MIN_TAP_TARGET_SIZE, minHeight: MIN_TAP_TARGET_SIZE }}
            >
              <span className="sr-only">Apply stash</span>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 touch-manipulation text-red-500 hover:text-red-600"
              title="Drop stash"
              onClick={onDrop}
              disabled={isPending}
              style={{ minWidth: MIN_TAP_TARGET_SIZE, minHeight: MIN_TAP_TARGET_SIZE }}
            >
              <span className="sr-only">Drop stash</span>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Expanded Content */}
        {expanded && (
          <div className="px-3 pb-3 pl-11 text-xs text-muted-foreground">
            <div className="flex items-center gap-2 py-1">
              <span className="font-mono text-[10px]">{stash.ref}</span>
            </div>
            <div className="text-[10px] text-muted-foreground/60 mt-1">
              Stash index: {stash.index}
            </div>
          </div>
        )}
      </div>

      {/* Swipe Progress Indicator */}
      {swipeState.isDragging && swipeState.progress > 0 && (
        <div
          className={cn(
            'absolute top-0 bottom-0 w-1 z-10 transition-all',
            swipeState.direction === 'right' ? 'left-0 bg-green-500' : 'right-0 bg-red-500'
          )}
          style={{
            height: `${swipeState.progress * 100}%`,
            top: `${(1 - swipeState.progress) * 50}%`,
          }}
        />
      )}
    </div>
  );
}
