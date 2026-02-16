/**
 * Git View Dialogs
 * Barrel export for all git view dialogs
 */

export { BranchCreateDialog } from './branch-create-dialog';
export { BranchRenameDialog } from './branch-rename-dialog';
export { BranchDeleteDialog } from './branch-delete-dialog';
export { BranchMergeDialog } from './branch-merge-dialog';
export { BranchRebaseDialog } from './branch-rebase-dialog';
export { PushPullDialog } from './push-pull-dialog';
export { RemoteManagementDialog } from './remote-management-dialog';
export { SetBranchTrackingDialog } from './set-branch-tracking-dialog';
export { ConflictResolutionDialog } from './conflict-resolution-dialog';
export { CommitDialog } from './commit-dialog';
export { StashDiffDialog } from './stash-dialog';

// Re-export types
export type { StashEntry } from '../types';
