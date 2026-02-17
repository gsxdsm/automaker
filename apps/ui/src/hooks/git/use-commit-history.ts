import { useState, useCallback, useEffect, useRef } from 'react';
import type { GitCommitWithStats, CommitFileChange } from '@automaker/git-utils';
import { api } from '@/lib/api';

export interface CommitHistoryFilters {
  author?: string;
  since?: string;
  until?: string;
  searchQuery?: string;
}

export interface UseCommitHistoryOptions {
  repoPath: string;
  branch?: string;
  pageSize?: number;
  enabled?: boolean;
}

export interface CommitWithFiles extends GitCommitWithStats {
  files?: CommitFileChange[];
}

// Constants
const DEFAULT_PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Deep comparison for filter objects
 */
function filtersEqual(a: CommitHistoryFilters, b: CommitHistoryFilters): boolean {
  return (
    a.author === b.author &&
    a.since === b.since &&
    a.until === b.until &&
    a.searchQuery === b.searchQuery
  );
}

export function useCommitHistory({
  repoPath,
  branch,
  pageSize = DEFAULT_PAGE_SIZE,
  enabled = true,
}: UseCommitHistoryOptions) {
  const [commits, setCommits] = useState<CommitWithFiles[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const filtersRef = useRef<CommitHistoryFilters>({});
  const offsetRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Load commits with pagination
   */
  const loadCommits = useCallback(
    async (reset = false) => {
      if (!enabled || !repoPath) return;

      const actualOffset = reset ? 0 : offsetRef.current;
      setIsLoading(true);
      setError(null);

      try {
        const filters = filtersRef.current;

        // Build options for API call
        const options = {
          limit: pageSize,
          offset: actualOffset,
          branch,
          author: filters.author,
          since: filters.since,
          until: filters.until,
        };

        const [commitsResult, countResult] = await Promise.all([
          api.git.getCommitHistory(repoPath, options),
          api.git.getCommitCount(repoPath, branch),
        ]);

        if (!commitsResult.success) {
          throw new Error(commitsResult.error || 'Failed to fetch commit history');
        }
        if (!countResult.success) {
          throw new Error(countResult.error || 'Failed to fetch commit count');
        }

        const newCommits = (commitsResult.commits || []) as GitCommitWithStats[];
        const count = countResult.count || 0;

        // Apply client-side search filter if needed
        let filteredCommits = newCommits;
        if (filters.searchQuery) {
          const query = filters.searchQuery.toLowerCase();
          filteredCommits = newCommits.filter(
            (c) =>
              c.message.toLowerCase().includes(query) ||
              c.author.toLowerCase().includes(query) ||
              c.shortHash.toLowerCase().includes(query)
          );
        }

        setCommits((prev) => (reset ? filteredCommits : [...prev, ...filteredCommits]));
        setTotalCount(count);
        setHasMore(actualOffset + newCommits.length < count);

        if (!reset) {
          offsetRef.current += newCommits.length;
        } else {
          offsetRef.current = filteredCommits.length;
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load commits'));
        console.error('Error loading commits:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [enabled, repoPath, branch, pageSize]
  );

  /**
   * Load more commits (for infinite scroll)
   */
  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      loadCommits(false);
    }
  }, [isLoading, hasMore, loadCommits]);

  /**
   * Refresh commits (reset and reload)
   */
  const refresh = useCallback(() => {
    offsetRef.current = 0;
    loadCommits(true);
  }, [loadCommits]);

  /**
   * Update filters and reload
   */
  const setFilters = useCallback(
    (newFilters: CommitHistoryFilters) => {
      if (!filtersEqual(filtersRef.current, newFilters)) {
        filtersRef.current = newFilters;
        offsetRef.current = 0;
        loadCommits(true);
      }
    },
    [loadCommits]
  );

  /**
   * Load files for a specific commit
   */
  const loadCommitFiles = useCallback(
    async (commitHash: string): Promise<CommitFileChange[] | null> => {
      if (!enabled || !repoPath) return null;

      try {
        const result = await api.git.getCommitFiles(repoPath, commitHash);
        if (!result.success) {
          throw new Error(result.error || 'Failed to load commit files');
        }

        const files = (result.files || []) as CommitFileChange[];

        // Update commit with files
        setCommits((prev) => prev.map((c) => (c.hash === commitHash ? { ...c, files } : c)));

        return files;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load commit files';
        console.error('Error loading commit files:', err);
        setError(new Error(message));
        return null;
      }
    },
    [enabled, repoPath]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Initial load
  useEffect(() => {
    if (enabled && repoPath) {
      refresh();
    }
  }, [enabled, repoPath, branch, refresh]);

  return {
    commits,
    isLoading,
    error,
    hasMore,
    totalCount,
    filters: filtersRef.current,
    loadMore,
    refresh,
    setFilters,
    loadCommitFiles,
  };
}
