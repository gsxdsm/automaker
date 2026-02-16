import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  GitCommit,
  GitBranch,
  User,
  Clock,
  ChevronDown,
  ChevronRight,
  FileJson,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CommitWithFiles } from '@/hooks/git/use-commit-history';
import { CommitGraph } from './commit-graph';

export interface CommitListProps {
  commits: CommitWithFiles[];
  selectedCommit: string | null;
  onCommitSelect: (hash: string | null) => void;
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  showGraph?: boolean;
  compact?: boolean;
}

// Constants
const INFINITE_SCROLL_ROOT_MARGIN = '200px';
const DATE_FORMAT = {
  JUST_NOW_THRESHOLD: 1, // minute
  MINUTES_THRESHOLD: 60, // minutes
  HOURS_THRESHOLD: 24, // hours
  DAYS_THRESHOLD: 7, // days
  MS_PER_MINUTE: 60000,
  MS_PER_HOUR: 3600000,
  MS_PER_DAY: 86400000,
} as const;

/**
 * File status badge configuration
 */
const FILE_STATUS_BADGES = {
  M: { label: 'M', className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  A: { label: 'A', className: 'bg-green-500/10 text-green-400 border-green-500/20' },
  D: { label: 'D', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
  R: { label: 'R', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  C: { label: 'C', className: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
} as const;

// Cache for formatted dates to avoid recomputation
const dateCache = new Map<string, string>();
const MAX_CACHE_SIZE = 500;

/**
 * Format date to relative time (with caching)
 */
function formatRelativeDate(dateString: string): string {
  // Check cache first
  if (dateCache.has(dateString)) {
    return dateCache.get(dateString)!;
  }

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / DATE_FORMAT.MS_PER_MINUTE);
  const diffHours = Math.floor(diffMs / DATE_FORMAT.MS_PER_HOUR);
  const diffDays = Math.floor(diffMs / DATE_FORMAT.MS_PER_DAY);

  let result: string;
  if (diffMins < DATE_FORMAT.JUST_NOW_THRESHOLD) {
    result = 'just now';
  } else if (diffMins < DATE_FORMAT.MINUTES_THRESHOLD) {
    result = `${diffMins}m ago`;
  } else if (diffHours < DATE_FORMAT.HOURS_THRESHOLD) {
    result = `${diffHours}h ago`;
  } else if (diffDays < DATE_FORMAT.DAYS_THRESHOLD) {
    result = `${diffDays}d ago`;
  } else {
    result = date.toLocaleDateString();
  }

  // Cache the result (with size limit)
  if (dateCache.size >= MAX_CACHE_SIZE) {
    // Clear oldest entry
    const firstKey = dateCache.keys().next().value;
    if (firstKey) {
      dateCache.delete(firstKey);
    }
  }
  dateCache.set(dateString, result);

  return result;
}

/**
 * Extract branch name from refs
 */
function extractBranchName(refs?: string): string | null {
  if (!refs) return null;
  // Match heads/branch-name or tags/tag-name
  const headMatch = refs.match(/HEAD -> ([^,]+)/);
  if (headMatch) return headMatch[1].replace('refs/heads/', '');

  const branchMatch = refs.match(/refs\/heads\/([^,]+)/);
  if (branchMatch) return branchMatch[1];

  const tagMatch = refs.match(/tag: ([^,]+)/);
  if (tagMatch) return tagMatch[1];

  return null;
}

export function CommitList({
  commits,
  selectedCommit,
  onCommitSelect,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  showGraph = true,
  compact = false,
}: CommitListProps) {
  const [expandedCommits, setExpandedCommits] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Infinite scroll observer
  useEffect(() => {
    if (!onLoadMore || !hasMore || isLoading) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: INFINITE_SCROLL_ROOT_MARGIN }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [onLoadMore, hasMore, isLoading]);

  const toggleCommitExpanded = useCallback((commitHash: string) => {
    setExpandedCommits((prev) => {
      const next = new Set(prev);
      if (next.has(commitHash)) {
        next.delete(commitHash);
      } else {
        next.add(commitHash);
      }
      return next;
    });
  }, []);

  const handleCommitClick = useCallback(
    (commit: CommitWithFiles) => {
      if (selectedCommit === commit.hash) {
        // Toggle expand if already selected
        toggleCommitExpanded(commit.hash);
      } else {
        // Select and expand
        onCommitSelect(commit.hash);
        setExpandedCommits((prev) => new Set(prev).add(commit.hash));
      }
    },
    [selectedCommit, onCommitSelect, toggleCommitExpanded]
  );

  const getFileStatusBadge = useCallback((status: keyof typeof FILE_STATUS_BADGES) => {
    const badge = FILE_STATUS_BADGES[status];
    return (
      <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-mono border', badge.className)}>
        {badge.label}
      </span>
    );
  }, []);

  if (commits.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <GitCommit className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-sm">No commits found</p>
          <p className="text-xs mt-1 text-muted-foreground/60">Try adjusting your filters</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Commit graph (if enabled) */}
      {showGraph && (
        <div className="w-16 shrink-0 border-r border-border bg-muted/10 overflow-hidden py-3">
          <CommitGraph
            commits={commits}
            selectedCommit={selectedCommit}
            onCommitClick={onCommitSelect}
            compact={compact}
          />
        </div>
      )}

      {/* Commit list */}
      <div ref={listRef} className={cn('flex-1 overflow-y-auto', compact ? 'overflow-x-auto' : '')}>
        <div className="divide-y divide-border">
          {commits.map((commit) => {
            const isExpanded = expandedCommits.has(commit.hash);
            const isSelected = selectedCommit === commit.hash;
            const branchName = extractBranchName(commit.refs);

            return (
              <div key={commit.hash} className="hover:bg-accent/30">
                <div
                  className={cn(
                    'flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors',
                    isSelected && 'bg-accent/50',
                    compact && 'py-2'
                  )}
                  onClick={() => handleCommitClick(commit)}
                >
                  {/* Expand/collapse icon */}
                  <button
                    className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCommitExpanded(commit.hash);
                    }}
                    aria-label={isExpanded ? 'Collapse commit' : 'Expand commit'}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>

                  {/* Commit icon */}
                  <div className="shrink-0">
                    <GitCommit className="h-4 w-4 text-brand-500" />
                  </div>

                  {/* Commit info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className={cn(
                          'font-mono text-xs text-muted-foreground hover:text-brand-500 transition-colors cursor-pointer',
                          compact && 'text-[10px]'
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(commit.hash);
                        }}
                        title={commit.hash}
                      >
                        {commit.shortHash}
                      </span>
                      <span className={cn('text-sm', compact && 'text-xs')}>{commit.message}</span>
                      {branchName && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-400 text-[10px] border border-brand-500/20">
                          <GitBranch className="h-2.5 w-2.5" />
                          {branchName}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className={cn('flex items-center gap-1', compact && 'text-[10px]')}>
                        <User className="h-3 w-3" />
                        {commit.author}
                      </span>
                      <span className={cn('flex items-center gap-1', compact && 'text-[10px]')}>
                        <Clock className="h-3 w-3" />
                        {formatRelativeDate(commit.date)}
                      </span>
                    </div>
                  </div>

                  {/* Stats */}
                  {!compact && (
                    <div className="shrink-0 text-right">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-green-400">+{commit.insertionCount}</span>
                        <span className="text-red-400">-{commit.deletionCount}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {commit.fileCount} {commit.fileCount === 1 ? 'file' : 'files'}
                      </div>
                    </div>
                  )}
                </div>

                {/* Expanded file changes */}
                {isExpanded && commit.files && commit.files.length > 0 && (
                  <div className="border-t border-border bg-muted/10 px-4 py-2">
                    <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                      <FileJson className="h-3 w-3" />
                      Files changed ({commit.files.length})
                    </div>
                    <div className="space-y-1">
                      {commit.files.map((file, idx) => (
                        <div
                          key={`${file.path}-${idx}`}
                          className={cn(
                            'flex items-center gap-2 px-2 py-1 rounded hover:bg-accent/30 cursor-pointer group',
                            compact && 'py-0.5'
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            onCommitSelect(commit.hash);
                          }}
                        >
                          {getFileStatusBadge(file.status)}
                          <span
                            className={cn(
                              'flex-1 truncate font-mono',
                              compact ? 'text-[10px]' : 'text-xs'
                            )}
                          >
                            {file.path}
                          </span>
                          <div className="flex items-center gap-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-green-400">+{file.additions}</span>
                            <span className="text-red-400">-{file.deletions}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Loading sentinel for infinite scroll */}
          {hasMore && (
            <div ref={sentinelRef} className="py-4 text-center text-muted-foreground">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                  <span className="text-xs">Loading commits...</span>
                </div>
              ) : (
                <span className="text-xs">Scroll to load more</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
