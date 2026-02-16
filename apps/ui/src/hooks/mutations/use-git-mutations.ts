/**
 * Git Mutations
 *
 * React Query mutations for git operations like stage, unstage, commit, discard.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getElectronAPI } from '@/lib/electron';
import { queryKeys } from '@/lib/query-keys';
import { toast } from 'sonner';

/**
 * Stage files for commit
 *
 * @returns Mutation for staging files
 */
export function useStageFiles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectPath, paths }: { projectPath: string; paths?: string[] }) => {
      const api = getElectronAPI();
      if (!api.git) throw new Error('Git API not available');
      const result = await api.git.stageFiles(projectPath, paths);
      if (!result.success) {
        throw new Error(result.error || 'Failed to stage files');
      }
      return result;
    },
    onSuccess: (_, { projectPath }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.git.diffs(projectPath) });
      queryClient.invalidateQueries({ queryKey: ['git', 'status', projectPath] });
    },
    onError: (error: Error) => {
      toast.error('Failed to stage files', {
        description: error.message,
      });
    },
  });
}

/**
 * Unstage files
 *
 * @returns Mutation for unstaging files
 */
export function useUnstageFiles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectPath, paths }: { projectPath: string; paths: string[] }) => {
      const api = getElectronAPI();
      if (!api.git) throw new Error('Git API not available');
      const result = await api.git.unstageFiles(projectPath, paths);
      if (!result.success) {
        throw new Error(result.error || 'Failed to unstage files');
      }
      return result;
    },
    onSuccess: (_, { projectPath }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.git.diffs(projectPath) });
      queryClient.invalidateQueries({ queryKey: ['git', 'status', projectPath] });
    },
    onError: (error: Error) => {
      toast.error('Failed to unstage files', {
        description: error.message,
      });
    },
  });
}

/**
 * Commit staged changes
 *
 * @returns Mutation for committing changes
 */
export function useCommitChanges() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectPath,
      message,
      options,
    }: {
      projectPath: string;
      message: string;
      options?: { allowEmpty?: boolean; amend?: boolean; noVerify?: boolean; signOff?: boolean };
    }) => {
      const api = getElectronAPI();
      if (!api.git) throw new Error('Git API not available');
      const result = await api.git.commit(projectPath, message, options);
      if (!result.success) {
        throw new Error(result.error || 'Failed to commit changes');
      }
      return result;
    },
    onSuccess: (_, { projectPath }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.git.diffs(projectPath) });
      queryClient.invalidateQueries({ queryKey: ['git', 'status', projectPath] });
      queryClient.invalidateQueries({ queryKey: queryKeys.git.branches(projectPath) });
      toast.success('Changes committed');
    },
    onError: (error: Error) => {
      toast.error('Failed to commit changes', {
        description: error.message,
      });
    },
  });
}

/**
 * Discard changes to files
 *
 * @returns Mutation for discarding changes
 */
export function useDiscardChanges() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectPath, paths }: { projectPath: string; paths: string[] }) => {
      const api = getElectronAPI();
      if (!api.git) throw new Error('Git API not available');
      const result = await api.git.discardChanges(projectPath, paths);
      if (!result.success) {
        throw new Error(result.error || 'Failed to discard changes');
      }
      return result;
    },
    onSuccess: (_, { projectPath }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.git.diffs(projectPath) });
      queryClient.invalidateQueries({ queryKey: ['git', 'status', projectPath] });
      toast.success('Changes discarded');
    },
    onError: (error: Error) => {
      toast.error('Failed to discard changes', {
        description: error.message,
      });
    },
  });
}

// ============================================
// Stash Mutations
// ============================================

/**
 * Save changes to stash
 *
 * @returns Mutation for stashing changes
 */
export function useSaveStash() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectPath,
      message,
      includeUntracked,
    }: {
      projectPath: string;
      message?: string;
      includeUntracked?: boolean;
    }) => {
      const api = getElectronAPI();
      if (!api.git) throw new Error('Git API not available');
      const result = await api.git.saveStash(projectPath, message, includeUntracked);
      if (!result.success) {
        throw new Error(result.error || 'Failed to save stash');
      }
      return result;
    },
    onSuccess: (_, { projectPath }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.git.stashes(projectPath) });
      queryClient.invalidateQueries({ queryKey: queryKeys.git.diffs(projectPath) });
      toast.success('Stash saved');
    },
    onError: (error: Error) => {
      toast.error('Failed to save stash', {
        description: error.message,
      });
    },
  });
}

/**
 * Apply stash (keeps it in the list)
 *
 * @returns Mutation for applying stash
 */
export function useApplyStash() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectPath, index }: { projectPath: string; index?: number }) => {
      const api = getElectronAPI();
      if (!api.git) throw new Error('Git API not available');
      const result = await api.git.applyStash(projectPath, index);
      if (!result.success) {
        throw new Error(result.error || 'Failed to apply stash');
      }
      return result;
    },
    onSuccess: (_, { projectPath }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.git.diffs(projectPath) });
      queryClient.invalidateQueries({ queryKey: queryKeys.git.stashes(projectPath) });
      toast.success('Stash applied');
    },
    onError: (error: Error) => {
      toast.error('Failed to apply stash', {
        description: error.message,
      });
    },
  });
}

/**
 * Pop stash (removes it from the list)
 *
 * @returns Mutation for popping stash
 */
export function usePopStash() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectPath, index }: { projectPath: string; index?: number }) => {
      const api = getElectronAPI();
      if (!api.git) throw new Error('Git API not available');
      const result = await api.git.popStash(projectPath, index);
      if (!result.success) {
        throw new Error(result.error || 'Failed to pop stash');
      }
      return result;
    },
    onSuccess: (_, { projectPath }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.git.diffs(projectPath) });
      queryClient.invalidateQueries({ queryKey: queryKeys.git.stashes(projectPath) });
      toast.success('Stash popped');
    },
    onError: (error: Error) => {
      toast.error('Failed to pop stash', {
        description: error.message,
      });
    },
  });
}

/**
 * Drop stash
 *
 * @returns Mutation for dropping stash
 */
export function useDropStash() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectPath, index }: { projectPath: string; index: number }) => {
      const api = getElectronAPI();
      if (!api.git) throw new Error('Git API not available');
      const result = await api.git.dropStash(projectPath, index);
      if (!result.success) {
        throw new Error(result.error || 'Failed to drop stash');
      }
      return result;
    },
    onSuccess: (_, { projectPath }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.git.stashes(projectPath) });
      toast.success('Stash dropped');
    },
    onError: (error: Error) => {
      toast.error('Failed to drop stash', {
        description: error.message,
      });
    },
  });
}

/**
 * Clear all stashes
 *
 * @returns Mutation for clearing all stashes
 */
export function useClearStashes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectPath }: { projectPath: string }) => {
      const api = getElectronAPI();
      if (!api.git) throw new Error('Git API not available');
      const result = await api.git.clearStashes(projectPath);
      if (!result.success) {
        throw new Error(result.error || 'Failed to clear stashes');
      }
      return result;
    },
    onSuccess: (_, { projectPath }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.git.stashes(projectPath) });
      toast.success('All stashes cleared');
    },
    onError: (error: Error) => {
      toast.error('Failed to clear stashes', {
        description: error.message,
      });
    },
  });
}
