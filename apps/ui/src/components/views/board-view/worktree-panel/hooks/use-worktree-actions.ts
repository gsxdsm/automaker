import { useState, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { createLogger } from '@automaker/utils/logger';
import { getElectronAPI } from '@/lib/electron';
import { toast } from 'sonner';
import {
  useSwitchBranch,
  useStashAndSwitch,
  useCheckoutRemoteBranch,
  usePullWorktree,
  usePushWorktree,
  useOpenInEditor,
} from '@/hooks/mutations';
import type { WorktreeInfo } from '../types';

const logger = createLogger('WorktreeActions');

export function useWorktreeActions() {
  const navigate = useNavigate();
  const [isActivating, setIsActivating] = useState(false);

  // Stash dialog state
  const [stashDialogOpen, setStashDialogOpen] = useState(false);
  const [pendingBranchSwitch, setPendingBranchSwitch] = useState<{
    worktree: WorktreeInfo;
    branchName: string;
    isRemote: boolean;
  } | null>(null);

  // Use React Query mutations
  const switchBranchMutation = useSwitchBranch();
  const stashAndSwitchMutation = useStashAndSwitch();
  const checkoutRemoteBranchMutation = useCheckoutRemoteBranch();
  const pullMutation = usePullWorktree();
  const pushMutation = usePushWorktree();
  const openInEditorMutation = useOpenInEditor();

  const handleSwitchBranch = useCallback(
    async (worktree: WorktreeInfo, branchName: string, isRemote = false) => {
      const isAnySwitching =
        switchBranchMutation.isPending ||
        stashAndSwitchMutation.isPending ||
        checkoutRemoteBranchMutation.isPending;

      if (isAnySwitching || branchName === worktree.branch) return;

      if (isRemote) {
        // For remote branches, use the checkout-remote-branch endpoint
        // It will return UNCOMMITTED_CHANGES error code if stashing is needed
        checkoutRemoteBranchMutation.mutate(
          {
            worktreePath: worktree.path,
            remoteBranchName: branchName,
            stashChanges: false,
          },
          {
            onError: (error: Error & { code?: string; changesSummary?: string }) => {
              if (error.code === 'UNCOMMITTED_CHANGES') {
                // Show the stash dialog
                setPendingBranchSwitch({ worktree, branchName, isRemote: true });
                setStashDialogOpen(true);
              }
              // Other errors are handled by the mutation's onError
            },
          }
        );
      } else {
        // For local branches, try switching first
        switchBranchMutation.mutate(
          {
            worktreePath: worktree.path,
            branchName,
          },
          {
            onError: (error: Error & { code?: string }) => {
              if (
                error.message?.includes('uncommitted') ||
                error.message?.includes('UNCOMMITTED_CHANGES') ||
                error.code === 'UNCOMMITTED_CHANGES'
              ) {
                // Show the stash dialog
                setPendingBranchSwitch({ worktree, branchName, isRemote: false });
                setStashDialogOpen(true);
              }
              // Other errors are handled by the mutation's onError
            },
          }
        );
      }
    },
    [switchBranchMutation, stashAndSwitchMutation, checkoutRemoteBranchMutation]
  );

  const handleConfirmStashAndSwitch = useCallback(() => {
    if (!pendingBranchSwitch) return;

    const { worktree, branchName, isRemote } = pendingBranchSwitch;

    if (isRemote) {
      checkoutRemoteBranchMutation.mutate({
        worktreePath: worktree.path,
        remoteBranchName: branchName,
        stashChanges: true,
      });
    } else {
      stashAndSwitchMutation.mutate({
        worktreePath: worktree.path,
        branchName,
      });
    }

    setStashDialogOpen(false);
    setPendingBranchSwitch(null);
  }, [pendingBranchSwitch, stashAndSwitchMutation, checkoutRemoteBranchMutation]);

  const handleCancelStashDialog = useCallback(() => {
    setStashDialogOpen(false);
    setPendingBranchSwitch(null);
  }, []);

  const handlePull = useCallback(
    async (worktree: WorktreeInfo) => {
      if (pullMutation.isPending) return;
      pullMutation.mutate(worktree.path);
    },
    [pullMutation]
  );

  const handlePush = useCallback(
    async (worktree: WorktreeInfo) => {
      if (pushMutation.isPending) return;
      pushMutation.mutate({
        worktreePath: worktree.path,
      });
    },
    [pushMutation]
  );

  const handleOpenInIntegratedTerminal = useCallback(
    (worktree: WorktreeInfo, mode?: 'tab' | 'split') => {
      // Navigate to the terminal view with the worktree path and branch name
      // The terminal view will handle creating the terminal with the specified cwd
      // Include nonce to allow opening the same worktree multiple times
      navigate({
        to: '/terminal',
        search: { cwd: worktree.path, branch: worktree.branch, mode, nonce: Date.now() },
      });
    },
    [navigate]
  );

  const handleOpenInEditor = useCallback(
    async (worktree: WorktreeInfo, editorCommand?: string) => {
      openInEditorMutation.mutate({
        worktreePath: worktree.path,
        editorCommand,
      });
    },
    [openInEditorMutation]
  );

  const handleOpenInExternalTerminal = useCallback(
    async (worktree: WorktreeInfo, terminalId?: string) => {
      try {
        const api = getElectronAPI();
        if (!api?.worktree?.openInExternalTerminal) {
          logger.warn('Open in external terminal API not available');
          return;
        }
        const result = await api.worktree.openInExternalTerminal(worktree.path, terminalId);
        if (result.success && result.result) {
          toast.success(result.result.message);
        } else if (result.error) {
          toast.error(result.error);
        }
      } catch (error) {
        logger.error('Open in external terminal failed:', error);
      }
    },
    []
  );

  return {
    isPulling: pullMutation.isPending,
    isPushing: pushMutation.isPending,
    isSwitching:
      switchBranchMutation.isPending ||
      stashAndSwitchMutation.isPending ||
      checkoutRemoteBranchMutation.isPending,
    isActivating,
    setIsActivating,
    handleSwitchBranch,
    handlePull,
    handlePush,
    handleOpenInIntegratedTerminal,
    handleOpenInEditor,
    handleOpenInExternalTerminal,
    // Stash dialog state
    stashDialogOpen,
    setStashDialogOpen,
    pendingBranchSwitch,
    handleConfirmStashAndSwitch,
    handleCancelStashDialog,
  };
}
