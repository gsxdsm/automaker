/**
 * Git Query Hooks
 *
 * React Query hooks for git operations.
 */

import { useQuery } from '@tanstack/react-query';
import { getElectronAPI } from '@/lib/electron';
import { queryKeys } from '@/lib/query-keys';
import { STALE_TIMES } from '@/lib/query-client';

/**
 * Fetch git diffs for a project (main project, not worktree)
 *
 * @param projectPath - Path to the project
 * @param enabled - Whether to enable the query
 * @returns Query result with files and diff content
 */
export function useGitDiffs(projectPath: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.git.diffs(projectPath ?? ''),
    queryFn: async () => {
      if (!projectPath) throw new Error('No project path');
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }
      const result = await api.git.getDiffs(projectPath);
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch diffs');
      }
      return {
        files: result.files ?? [],
        diff: result.diff ?? '',
      };
    },
    enabled: !!projectPath && enabled,
    staleTime: STALE_TIMES.WORKTREES,
  });
}

/**
 * Fetch stash list for a project
 *
 * @param projectPath - Path to the project
 * @param enabled - Whether to enable the query
 * @returns Query result with stash list
 */
export function useStashList(projectPath: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.git.stashes(projectPath ?? ''),
    queryFn: async () => {
      if (!projectPath) throw new Error('No project path');
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }
      const result = await api.git.listStashes(projectPath);
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch stash list');
      }
      return result.stashes ?? [];
    },
    enabled: !!projectPath && enabled,
    staleTime: STALE_TIMES.WORKTREES,
  });
}

/**
 * Fetch stash diff for a specific stash entry
 *
 * @param projectPath - Path to the project
 * @param index - Stash index
 * @param enabled - Whether to enable the query
 * @returns Query result with stash diff
 */
export function useStashDiff(projectPath: string | undefined, index?: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.git.stashDiff(projectPath ?? '', index ?? 0),
    queryFn: async () => {
      if (!projectPath) throw new Error('No project path');
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }
      const result = await api.git.showStash(projectPath, index);
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch stash diff');
      }
      return result.diff ?? '';
    },
    enabled: !!projectPath && index !== undefined && enabled,
    staleTime: STALE_TIMES.WORKTREES,
  });
}
