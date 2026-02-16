import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { usePullToRefresh } from '@/hooks/mobile';

export interface PullToRefreshWrapperProps {
  children: React.ReactNode;
  onRefresh: () => void | Promise<void>;
  threshold?: number;
  disabled?: boolean;
  className?: string;
  onError?: (error: Error) => void;
}

/**
 * Pull to Refresh Wrapper Component
 *
 * Wraps content with pull-to-refresh functionality for mobile.
 * Shows a loading indicator when pulling down.
 *
 * @example
 * <PullToRefreshWrapper onRefresh={async () => await fetchData()}>
 *   <div>Content that can be refreshed</div>
 * </PullToRefreshWrapper>
 */
export function PullToRefreshWrapper({
  children,
  onRefresh,
  threshold = 80,
  disabled = false,
  className,
  onError,
}: PullToRefreshWrapperProps) {
  const [error, setError] = useState<Error | null>(null);

  const handleRefresh = useCallback(async () => {
    try {
      setError(null);
      await onRefresh();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Refresh failed');
      setError(error);
      onError?.(error);
      throw error;
    }
  }, [onRefresh, onError]);

  const { pullState, ref } = usePullToRefresh(
    { onRefresh: handleRefresh },
    { threshold, disabled }
  );

  return (
    <div ref={ref} className={cn('relative', className)} style={{ touchAction: 'pan-y' }}>
      {/* Pull Indicator */}
      <div
        className={cn(
          'absolute left-0 right-0 flex justify-center items-center gap-2 z-10 pointer-events-none',
          'transition-transform duration-200 ease-out',
          pullState.pullDistance > 0 && 'transform'
        )}
        style={{
          transform: `translateY(${Math.max(0, pullState.pullDistance - 50)}px)`,
          opacity: pullState.pullProgress,
          top: 20,
        }}
        aria-live="polite"
        aria-busy={pullState.isRefreshing}
      >
        <div
          className={cn(
            'h-8 w-8 rounded-full bg-muted flex items-center justify-center',
            pullState.isRefreshing && 'animate-spin',
            pullState.shouldRefresh && 'bg-brand-500 text-white',
            error && 'bg-destructive text-white'
          )}
        >
          {error ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <RefreshCw
              className={cn(
                'h-4 w-4 text-muted-foreground',
                pullState.shouldRefresh && 'text-white'
              )}
              style={{
                transform: `rotate(${pullState.pullProgress * 360}deg)`,
              }}
            />
          )}
        </div>
        {pullState.pullProgress > 0.5 && (
          <span
            className={cn(
              'text-sm font-medium',
              error
                ? 'text-destructive'
                : pullState.shouldRefresh
                  ? 'text-brand-500'
                  : 'text-muted-foreground'
            )}
          >
            {error
              ? 'Refresh failed'
              : pullState.isRefreshing
                ? 'Refreshing...'
                : pullState.shouldRefresh
                  ? 'Release to refresh'
                  : 'Pull to refresh'}
          </span>
        )}
      </div>

      {/* Content */}
      <div
        className={cn(
          'transition-transform duration-200 ease-out',
          pullState.isPulling && 'will-change-transform'
        )}
        style={{
          transform: pullState.isPulling
            ? `translateY(${Math.max(0, Math.min(pullState.pullDistance, threshold))}px)`
            : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
