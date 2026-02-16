/**
 * Branch Query Hooks
 *
 * React Query hooks for branch operations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getElectronAPI } from '@/lib/electron';
import { queryKeys } from '@/lib/query-keys';
import { STALE_TIMES } from '@/lib/query-client';
import type { GitBranchData } from '@/components/views/git-view/git-branch-management.types';

// Re-export type for convenience
export type { GitBranchData as GitBranch };

/**
 * Fetch branches for a project
 *
 * @param projectPath - Path to the project
 * @param includeRemote - Whether to include remote branches
 * @param enabled - Whether to enable the query
 * @returns Query result with branches array
 */
export function useBranches(
  projectPath: string | undefined,
  includeRemote = false,
  enabled = true
) {
  return useQuery<GitBranchData[]>({
    queryKey: queryKeys.git.branches(projectPath ?? '', includeRemote),
    queryFn: async () => {
      if (!projectPath) throw new Error('No project path');
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }

      // Call the API to get branches
      const result = await api.git.getBranches(projectPath, { includeRemote });
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch branches');
      }
      return result.branches ?? [];
    },
    enabled: !!projectPath && enabled,
    staleTime: STALE_TIMES.WORKTREES,
    refetchOnWindowFocus: false,
  });
}

/**
 * Fetch current branch for a project
 *
 * @param projectPath - Path to the project
 * @param enabled - Whether to enable the query
 * @returns Query result with current branch name
 */
export function useCurrentBranch(projectPath: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.git.currentBranch(projectPath ?? ''),
    queryFn: async () => {
      if (!projectPath) throw new Error('No project path');
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }

      const result = await api.git.getCurrentBranch(projectPath);
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch current branch');
      }
      return result.branch ?? '';
    },
    enabled: !!projectPath && enabled,
    staleTime: STALE_TIMES.WORKTREES,
  });
}

/**
 * Fetch remotes for a project
 *
 * @param projectPath - Path to the project
 * @param enabled - Whether to enable the query
 * @returns Query result with remotes array
 */
export function useRemotes(projectPath: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.git.remotes(projectPath ?? ''),
    queryFn: async () => {
      if (!projectPath) throw new Error('No project path');
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }

      const result = await api.git.getRemotes(projectPath);
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch remotes');
      }
      return result.remotes ?? [];
    },
    enabled: !!projectPath && enabled,
    staleTime: STALE_TIMES.WORKTREES * 2, // Remotes change less frequently
  });
}

/**
 * Checkout a branch mutation
 *
 * @returns Mutation for checking out a branch
 */
export function useCheckoutBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectPath,
      branchName,
    }: {
      projectPath: string;
      branchName: string;
    }) => {
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }

      const result = await api.git.checkoutBranch(projectPath, branchName);
      if (!result.success) {
        throw new Error(result.error || 'Failed to checkout branch');
      }
      return result;
    },
    onSuccess: (_, variables) => {
      // Invalidate all branch queries for this project (both local and remote)
      queryClient.invalidateQueries({
        queryKey: queryKeys.git.branches(variables.projectPath),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.git.currentBranch(variables.projectPath),
      });
    },
  });
}

/**
 * Create a branch mutation
 *
 * @returns Mutation for creating a new branch
 */
export function useCreateBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectPath,
      branchName,
      startPoint,
    }: {
      projectPath: string;
      branchName: string;
      startPoint?: string;
    }) => {
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }

      const result = await api.git.createBranch(projectPath, branchName, startPoint);
      if (!result.success) {
        throw new Error(result.error || 'Failed to create branch');
      }
      return result;
    },
    onSuccess: (_, variables) => {
      // Invalidate branch queries for this project
      queryClient.invalidateQueries({
        queryKey: queryKeys.git.branches(variables.projectPath),
      });
    },
  });
}

/**
 * Delete a branch mutation
 *
 * @returns Mutation for deleting a branch
 */
export function useDeleteBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectPath,
      branchName,
      force,
    }: {
      projectPath: string;
      branchName: string;
      force?: boolean;
    }) => {
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }

      const result = await api.git.deleteBranch(projectPath, branchName, force);
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete branch');
      }
      return result;
    },
    onSuccess: (_, variables) => {
      // Invalidate branch queries for this project
      queryClient.invalidateQueries({
        queryKey: queryKeys.git.branches(variables.projectPath),
      });
    },
  });
}

/**
 * Rename a branch mutation
 *
 * @returns Mutation for renaming a branch
 */
export function useRenameBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectPath,
      oldName,
      newName,
    }: {
      projectPath: string;
      oldName?: string;
      newName: string;
    }) => {
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }

      const result = await api.git.renameBranch(projectPath, oldName, newName);
      if (!result.success) {
        throw new Error(result.error || 'Failed to rename branch');
      }
      return result;
    },
    onSuccess: (_, variables) => {
      // Invalidate all branch queries for this project (both local and remote)
      queryClient.invalidateQueries({
        queryKey: queryKeys.git.branches(variables.projectPath),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.git.currentBranch(variables.projectPath),
      });
    },
  });
}

/**
 * Merge a branch mutation
 *
 * @returns Mutation for merging a branch
 */
export function useMergeBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectPath,
      branchName,
      options,
    }: {
      projectPath: string;
      branchName: string;
      options?: { noCommit?: boolean; noFF?: boolean; squash?: boolean };
    }) => {
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }

      const result = await api.git.mergeBranch(projectPath, branchName, options);
      if (!result.success) {
        throw new Error(result.error || 'Failed to merge branch');
      }
      return result;
    },
    onSuccess: (_, variables) => {
      // Invalidate branch and state queries for this project
      queryClient.invalidateQueries({
        queryKey: queryKeys.git.branches(variables.projectPath),
      });
    },
  });
}

/**
 * Rebase onto a branch mutation
 *
 * @returns Mutation for rebasing onto a branch
 */
export function useRebaseBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectPath,
      branchName,
    }: {
      projectPath: string;
      branchName: string;
    }) => {
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }

      const result = await api.git.rebaseBranch(projectPath, branchName);
      if (!result.success) {
        throw new Error(result.error || 'Failed to rebase branch');
      }
      return result;
    },
    onSuccess: (_, variables) => {
      // Invalidate branch queries for this project
      queryClient.invalidateQueries({
        queryKey: queryKeys.git.branches(variables.projectPath),
      });
    },
  });
}

/**
 * Abort merge mutation
 *
 * Aborts the current merge operation and restores the repository to its pre-merge state.
 *
 * @returns Mutation for aborting a merge
 *
 * @example
 * ```ts
 * const abortMergeMutation = useAbortMerge();
 * await abortMergeMutation.mutateAsync({ projectPath: '/path/to/repo' });
 * ```
 */
export function useAbortMerge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectPath }: { projectPath: string }) => {
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }

      const result = await api.git.abortMerge(projectPath);
      if (!result.success) {
        throw new Error(result.error || 'Failed to abort merge');
      }
      return result;
    },
    onSuccess: (_, variables) => {
      // Invalidate all git queries for this project
      queryClient.invalidateQueries({
        queryKey: queryKeys.git.branches(variables.projectPath),
      });
      queryClient.invalidateQueries({ queryKey: ['git', 'status', variables.projectPath] });
      queryClient.invalidateQueries({ queryKey: queryKeys.git.diffs(variables.projectPath) });
    },
  });
}

/**
 * Continue merge mutation
 *
 * Continues the current merge operation after conflicts have been resolved.
 * Creates a merge commit with the resolved changes.
 *
 * @returns Mutation for continuing a merge
 *
 * @example
 * ```ts
 * const continueMergeMutation = useContinueMerge();
 * await continueMergeMutation.mutateAsync({ projectPath: '/path/to/repo' });
 * ```
 */
export function useContinueMerge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectPath }: { projectPath: string }) => {
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }

      const result = await api.git.continueMerge(projectPath);
      if (!result.success) {
        throw new Error(result.error || 'Failed to continue merge');
      }
      return result;
    },
    onSuccess: (_, variables) => {
      // Invalidate all git queries for this project
      queryClient.invalidateQueries({
        queryKey: queryKeys.git.branches(variables.projectPath),
      });
      queryClient.invalidateQueries({ queryKey: ['git', 'status', variables.projectPath] });
      queryClient.invalidateQueries({ queryKey: queryKeys.git.diffs(variables.projectPath) });
    },
  });
}

/**
 * Abort rebase mutation
 *
 * Aborts the current rebase operation and restores the branch to its pre-rebase state.
 *
 * @returns Mutation for aborting a rebase
 *
 * @example
 * ```ts
 * const abortRebaseMutation = useAbortRebase();
 * await abortRebaseMutation.mutateAsync({ projectPath: '/path/to/repo' });
 * ```
 */
export function useAbortRebase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectPath }: { projectPath: string }) => {
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }

      const result = await api.git.abortRebase(projectPath);
      if (!result.success) {
        throw new Error(result.error || 'Failed to abort rebase');
      }
      return result;
    },
    onSuccess: (_, variables) => {
      // Invalidate all git queries for this project
      queryClient.invalidateQueries({
        queryKey: queryKeys.git.branches(variables.projectPath),
      });
      queryClient.invalidateQueries({ queryKey: ['git', 'status', variables.projectPath] });
      queryClient.invalidateQueries({ queryKey: queryKeys.git.diffs(variables.projectPath) });
    },
  });
}

/**
 * Continue rebase mutation
 *
 * Continues the current rebase operation after conflicts have been resolved.
 * Applies the next commit in the rebase sequence.
 *
 * @returns Mutation for continuing a rebase
 *
 * @example
 * ```ts
 * const continueRebaseMutation = useContinueRebase();
 * await continueRebaseMutation.mutateAsync({ projectPath: '/path/to/repo' });
 * ```
 */
export function useContinueRebase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectPath }: { projectPath: string }) => {
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }

      const result = await api.git.continueRebase(projectPath);
      if (!result.success) {
        throw new Error(result.error || 'Failed to continue rebase');
      }
      return result;
    },
    onSuccess: (_, variables) => {
      // Invalidate all git queries for this project
      queryClient.invalidateQueries({
        queryKey: queryKeys.git.branches(variables.projectPath),
      });
      queryClient.invalidateQueries({ queryKey: ['git', 'status', variables.projectPath] });
      queryClient.invalidateQueries({ queryKey: queryKeys.git.diffs(variables.projectPath) });
    },
  });
}

/**
 * Skip rebase patch mutation
 *
 * Skips the current patch during a rebase and continues with the next one.
 *
 * @returns Mutation for skipping a rebase patch
 *
 * @example
 * ```ts
 * const skipPatchMutation = useSkipRebasePatch();
 * await skipPatchMutation.mutateAsync({ projectPath: '/path/to/repo' });
 * ```
 */
export function useSkipRebasePatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectPath }: { projectPath: string }) => {
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }

      const result = await api.git.skipRebasePatch(projectPath);
      if (!result.success) {
        throw new Error(result.error || 'Failed to skip patch');
      }
      return result;
    },
    onSuccess: (_, variables) => {
      // Invalidate all git queries for this project
      queryClient.invalidateQueries({
        queryKey: queryKeys.git.branches(variables.projectPath),
      });
      queryClient.invalidateQueries({ queryKey: ['git', 'status', variables.projectPath] });
      queryClient.invalidateQueries({ queryKey: queryKeys.git.diffs(variables.projectPath) });
    },
  });
}

/**
 * Get conflict details for merge/rebase resolution
 *
 * Fetches detailed information about conflicts including 3-way merge data.
 *
 * @returns Query for conflict details
 *
 * @example
 * ```ts
 * const { data: conflictDetails } = useConflictDetails('/path/to/repo', ['file1.ts', 'file2.ts']);
 * ```
 */
export function useConflictDetails(
  projectPath: string | undefined,
  conflictFiles: string[] | undefined
) {
  return useQuery({
    queryKey: ['git', 'conflicts', projectPath, conflictFiles],
    queryFn: async () => {
      if (!projectPath || !conflictFiles || conflictFiles.length === 0) {
        return { conflicts: [] };
      }

      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }

      const result = await api.git.getConflictDetails(projectPath, conflictFiles);
      if (!result.success) {
        throw new Error(result.error || 'Failed to get conflict details');
      }
      return result;
    },
    enabled: !!projectPath && !!conflictFiles && conflictFiles.length > 0,
    staleTime: 0, // Always refetch conflicts
  });
}

/**
 * Pull changes mutation
 *
 * @returns Mutation for pulling changes
 */
export function usePullChanges() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectPath,
      remote,
      branch,
      options,
    }: {
      projectPath: string;
      remote?: string;
      branch?: string;
      options?: { rebase?: boolean };
    }) => {
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }

      const result = await api.git.pull(projectPath, remote, branch, options);
      if (!result.success) {
        throw new Error(result.error || 'Failed to pull changes');
      }
      return result;
    },
    onSuccess: (_, variables) => {
      // Invalidate branch queries for this project
      queryClient.invalidateQueries({
        queryKey: queryKeys.git.branches(variables.projectPath),
      });
    },
  });
}

/**
 * Push changes mutation
 *
 * @returns Mutation for pushing changes
 */
export function usePushChanges() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectPath,
      remote,
      branch,
      options,
    }: {
      projectPath: string;
      remote?: string;
      branch?: string;
      options?: { force?: boolean; setUpstream?: boolean };
    }) => {
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }

      const result = await api.git.push(projectPath, remote, branch, options);
      if (!result.success) {
        throw new Error(result.error || 'Failed to push changes');
      }
      return result;
    },
    onSuccess: (_, variables) => {
      // Invalidate branch queries for this project
      queryClient.invalidateQueries({
        queryKey: queryKeys.git.branches(variables.projectPath),
      });
    },
  });
}

/**
 * Fetch from remote mutation
 *
 * Fetches updates from a git remote without merging. This updates the remote tracking
 * branches but does not modify the current working branch.
 *
 * @returns Mutation for fetching from remote
 *
 * @example
 * ```ts
 * const fetchMutation = useFetchFromRemote();
 * await fetchMutation.mutateAsync({ projectPath: '/path/to/repo', remote: 'origin' });
 * ```
 */
export function useFetchFromRemote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectPath, remote }: { projectPath: string; remote?: string }) => {
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }

      const result = await api.git.fetch(projectPath, remote);
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch from remote');
      }
      return result;
    },
    onSuccess: (_, variables) => {
      // Invalidate branch and remote queries for this project
      queryClient.invalidateQueries({
        queryKey: queryKeys.git.branches(variables.projectPath),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.git.remotes(variables.projectPath),
      });
    },
  });
}

/**
 * Add remote mutation
 *
 * Adds a new git remote to the repository.
 *
 * @returns Mutation for adding a remote
 *
 * @example
 * ```ts
 * const addRemoteMutation = useAddRemote();
 * await addRemoteMutation.mutateAsync({
 *   projectPath: '/path/to/repo',
 *   name: 'upstream',
 *   url: 'https://github.com/original/repo.git'
 * });
 * ```
 */
export function useAddRemote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectPath,
      name,
      url,
    }: {
      projectPath: string;
      name: string;
      url: string;
    }) => {
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }

      const result = await api.git.addRemote(projectPath, name, url);
      if (!result.success) {
        throw new Error(result.error || 'Failed to add remote');
      }
      return result;
    },
    onSuccess: (_, variables) => {
      // Invalidate remote queries for this project
      queryClient.invalidateQueries({
        queryKey: queryKeys.git.remotes(variables.projectPath),
      });
    },
  });
}

/**
 * Remove remote mutation
 *
 * Removes a git remote from the repository configuration.
 *
 * @returns Mutation for removing a remote
 *
 * @example
 * ```ts
 * const removeRemoteMutation = useRemoveRemote();
 * await removeRemoteMutation.mutateAsync({
 *   projectPath: '/path/to/repo',
 *   name: 'upstream'
 * });
 * ```
 */
export function useRemoveRemote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectPath, name }: { projectPath: string; name: string }) => {
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }

      const result = await api.git.removeRemote(projectPath, name);
      if (!result.success) {
        throw new Error(result.error || 'Failed to remove remote');
      }
      return result;
    },
    onSuccess: (_, variables) => {
      // Invalidate remote queries for this project
      queryClient.invalidateQueries({
        queryKey: queryKeys.git.remotes(variables.projectPath),
      });
    },
  });
}

/**
 * Update remote URL mutation
 *
 * Updates the URL of an existing git remote.
 *
 * @returns Mutation for updating a remote URL
 *
 * @example
 * ```ts
 * const updateRemoteMutation = useUpdateRemote();
 * await updateRemoteMutation.mutateAsync({
 *   projectPath: '/path/to/repo',
 *   name: 'origin',
 *   url: 'https://github.com/new/location.git'
 * });
 * ```
 */
export function useUpdateRemote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectPath,
      name,
      url,
    }: {
      projectPath: string;
      name: string;
      url: string;
    }) => {
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }

      const result = await api.git.updateRemote(projectPath, name, url);
      if (!result.success) {
        throw new Error(result.error || 'Failed to update remote');
      }
      return result;
    },
    onSuccess: (_, variables) => {
      // Invalidate remote queries for this project
      queryClient.invalidateQueries({
        queryKey: queryKeys.git.remotes(variables.projectPath),
      });
    },
  });
}

/**
 * Set branch upstream mutation
 *
 * Configures the upstream (tracking) branch for the current branch.
 * This allows using simple `git pull` and `git push` without specifying remote/branch.
 *
 * Uses `git push --set-upstream` internally to establish tracking.
 *
 * @returns Mutation for setting branch tracking
 *
 * @example
 * ```ts
 * const setUpstreamMutation = useSetBranchUpstream();
 * await setUpstreamMutation.mutateAsync({
 *   projectPath: '/path/to/repo',
 *   branch: 'feature',
 *   remote: 'origin',
 *   remoteBranch: 'feature'
 * });
 * ```
 */
export function useSetBranchUpstream() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectPath,
      branch,
      remote,
      remoteBranch,
    }: {
      projectPath: string;
      branch?: string;
      remote: string;
      remoteBranch: string;
    }) => {
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }

      // Use push with setUpstream to set tracking
      const branchName = branch || 'HEAD';
      const result = await api.git.push(projectPath, remote, branchName, { setUpstream: true });
      if (!result.success) {
        throw new Error(result.error || 'Failed to set branch upstream');
      }
      return result;
    },
    onSuccess: (_, variables) => {
      // Invalidate branch queries for this project
      queryClient.invalidateQueries({
        queryKey: queryKeys.git.branches(variables.projectPath),
      });
    },
  });
}
