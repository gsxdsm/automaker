/**
 * Pull Request Query Hooks
 *
 * React Query hooks for pull request operations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getElectronAPI } from '@/lib/electron';
import { queryKeys } from '@/lib/query-keys';
import { STALE_TIMES } from '@/lib/query-client';
import { toast } from 'sonner';
import type { GitPullRequest } from '@automaker/git-utils';

export interface PullRequestListOptions {
  state?: 'OPEN' | 'CLOSED' | 'MERGED' | 'ALL';
  limit?: number;
  head?: string;
  base?: string;
}

export interface PRCheck {
  name: string;
  status: string;
  conclusion?: string;
  databaseId?: number;
}

/**
 * Check if gh CLI is installed
 */
export function useGhInstalled() {
  return useQuery({
    queryKey: ['git', 'gh-cli', 'installed'],
    queryFn: async () => {
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }
      const result = await api.git.isGhInstalled();
      if (!result.success) {
        throw new Error(result.error || 'Failed to check gh CLI');
      }
      return result.installed ?? false;
    },
    staleTime: STALE_TIMES.GITHUB,
  });
}

/**
 * Fetch pull requests for a project
 *
 * @param projectPath - Path to the project
 * @param options - Optional filters for PR list
 * @returns Query result with pull requests
 */
export function usePullRequests(projectPath: string | undefined, options?: PullRequestListOptions) {
  return useQuery({
    queryKey: queryKeys.git.pullRequests(projectPath ?? '', options?.state),
    queryFn: async (): Promise<GitPullRequest[]> => {
      if (!projectPath) throw new Error('No project path');
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }
      const result = await api.git.listPullRequests(projectPath, options);
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch pull requests');
      }
      return result.prs ?? [];
    },
    enabled: !!projectPath,
    staleTime: STALE_TIMES.WORKTREES,
  });
}

/**
 * Fetch a single pull request
 *
 * @param projectPath - Path to the project
 * @param prNumber - Pull request number
 * @returns Query result with pull request details
 */
export function usePullRequest(projectPath: string | undefined, prNumber: number | undefined) {
  return useQuery({
    queryKey: queryKeys.git.pullRequest(projectPath ?? '', prNumber ?? 0),
    queryFn: async (): Promise<GitPullRequest | null> => {
      if (!projectPath || !prNumber) throw new Error('Missing project path or PR number');
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }
      const result = await api.git.getPullRequest(projectPath, prNumber);
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch pull request');
      }
      return result.pr ?? null;
    },
    enabled: !!projectPath && !!prNumber,
    staleTime: STALE_TIMES.WORKTREES,
  });
}

/**
 * Fetch pull request checks/status
 *
 * @param projectPath - Path to the project
 * @param prNumber - Pull request number
 * @returns Query result with PR checks
 */
export function usePullRequestChecks(
  projectPath: string | undefined,
  prNumber: number | undefined
) {
  return useQuery<PRCheck[]>({
    queryKey: queryKeys.git.pullRequestChecks(projectPath ?? '', prNumber ?? 0),
    queryFn: async (): Promise<PRCheck[]> => {
      if (!projectPath || !prNumber) throw new Error('Missing project path or PR number');
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }
      const result = await api.git.getPullRequestChecks(projectPath, prNumber);
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch PR checks');
      }
      return result.checks ?? [];
    },
    enabled: !!projectPath && !!prNumber,
    staleTime: 30_000, // 30 seconds - checks update frequently
    refetchInterval: 60_000, // Refetch every minute
  });
}

/**
 * Create a pull request
 */
export function useCreatePullRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectPath,
      title,
      body,
      head,
      base,
      draft,
    }: {
      projectPath: string;
      title: string;
      body?: string;
      head?: string;
      base?: string;
      draft?: boolean;
    }) => {
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }
      const result = await api.git.createPullRequest(projectPath, {
        title,
        body,
        head,
        base,
        draft,
      });
      if (!result.success) {
        throw new Error(result.error || 'Failed to create pull request');
      }
      return result.pr;
    },
    onSuccess: (pr, variables) => {
      // Invalidate PR list queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.git.pullRequests(variables.projectPath),
      });
      toast.success(`Pull request #${pr?.number} created successfully`);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create pull request');
    },
  });
}

/**
 * Close a pull request
 */
export function useClosePullRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectPath, prNumber }: { projectPath: string; prNumber: number }) => {
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }
      const result = await api.git.closePullRequest(projectPath, prNumber);
      if (!result.success) {
        throw new Error(result.error || 'Failed to close pull request');
      }
      return true;
    },
    onSuccess: (_, variables) => {
      // Invalidate PR list queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.git.pullRequests(variables.projectPath),
      });
      // Invalidate specific PR query
      queryClient.invalidateQueries({
        queryKey: queryKeys.git.pullRequest(variables.projectPath, variables.prNumber),
      });
      toast.success(`Pull request #${variables.prNumber} closed`);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to close pull request');
    },
  });
}

/**
 * Merge a pull request
 */
export function useMergePullRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectPath,
      prNumber,
      mergeMethod,
      comment,
    }: {
      projectPath: string;
      prNumber: number;
      mergeMethod?: 'merge' | 'squash' | 'rebase';
      comment?: string;
    }) => {
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }
      const result = await api.git.mergePullRequest(projectPath, prNumber, {
        mergeMethod,
        comment,
      });
      if (!result.success) {
        throw new Error(result.error || 'Failed to merge pull request');
      }
      return true;
    },
    onSuccess: (_, variables) => {
      // Invalidate PR list queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.git.pullRequests(variables.projectPath),
      });
      // Invalidate specific PR query
      queryClient.invalidateQueries({
        queryKey: queryKeys.git.pullRequest(variables.projectPath, variables.prNumber),
      });
      toast.success(`Pull request #${variables.prNumber} merged`);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to merge pull request');
    },
  });
}

/**
 * Add a comment to a pull request
 */
export function useCommentOnPullRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectPath,
      prNumber,
      comment,
    }: {
      projectPath: string;
      prNumber: number;
      comment: string;
    }) => {
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }
      const result = await api.git.commentOnPullRequest(projectPath, prNumber, comment);
      if (!result.success) {
        throw new Error(result.error || 'Failed to add comment');
      }
      return true;
    },
    onSuccess: (_, variables) => {
      toast.success('Comment added successfully');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to add comment');
    },
  });
}

/**
 * Checkout a pull request locally
 */
export function useCheckoutPullRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectPath, prNumber }: { projectPath: string; prNumber: number }) => {
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }
      const result = await api.git.checkoutPullRequest(projectPath, prNumber);
      if (!result.success) {
        throw new Error(result.error || 'Failed to checkout pull request');
      }
      return true;
    },
    onSuccess: (_, variables) => {
      // Invalidate branch queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.git.branches(variables.projectPath),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.git.currentBranch(variables.projectPath),
      });
      toast.success(`Checked out PR #${variables.prNumber}`);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to checkout pull request');
    },
  });
}

/**
 * Generate PR title from commits
 */
export function useGeneratePRTitle() {
  return useMutation({
    mutationFn: async ({
      projectPath,
      baseBranch,
    }: {
      projectPath: string;
      baseBranch?: string;
    }) => {
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }
      const result = await api.git.generatePRTitle(projectPath, baseBranch);
      if (!result.success) {
        throw new Error(result.error || 'Failed to generate PR title');
      }
      return result.title ?? '';
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to generate PR title');
    },
  });
}

/**
 * Generate PR description from commits and diffs
 */
export function useGeneratePRDescription() {
  return useMutation({
    mutationFn: async ({
      projectPath,
      baseBranch,
    }: {
      projectPath: string;
      baseBranch?: string;
    }) => {
      const api = getElectronAPI();
      if (!api.git) {
        throw new Error('Git API not available');
      }
      const result = await api.git.generatePRDescription(projectPath, baseBranch);
      if (!result.success) {
        throw new Error(result.error || 'Failed to generate PR description');
      }
      return result.description ?? '';
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to generate PR description');
    },
  });
}
