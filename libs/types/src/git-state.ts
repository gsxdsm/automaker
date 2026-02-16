/**
 * Git state management types for AutoMaker
 * Provides types for tracking repository state in real-time
 */

import type { FileStatus } from '@automaker/git-utils';

/**
 * Represents the ahead/behind status of a branch compared to its remote
 */
export interface BranchAheadBehind {
  ahead: number;
  behind: number;
}

/**
 * Represents the status of a branch's remote tracking
 */
export interface RemoteStatus {
  hasRemote: boolean;
  remoteName?: string;
  branchName?: string;
  aheadBehind?: BranchAheadBehind;
}

/**
 * Detailed branch information including remote status
 */
export interface BranchInfo {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
  remoteStatus?: RemoteStatus;
}

/**
 * Uncommitted changes summary
 */
export interface UncommittedChanges {
  files: FileStatus[];
  stagedCount: number;
  unstagedCount: number;
  untrackedCount: number;
  hasConflicts: boolean;
}

/**
 * Git operation progress state
 */
export interface GitOperationProgress {
  operation: string;
  currentStep: number;
  totalSteps: number;
  message: string;
  details?: string;
}

/**
 * Complete git repository state snapshot
 */
export interface GitRepositoryState {
  repoPath: string;
  currentBranch: string;
  branches: BranchInfo[];
  uncommittedChanges: UncommittedChanges;
  stashCount: number;
  remoteStatus: RemoteStatus;
  operationProgress?: GitOperationProgress;
  lastUpdated: number;
  isWorktree: boolean;
  worktreePath?: string;
}

/**
 * Git state change event payload
 */
export interface GitStateChangeEvent {
  repoPath: string;
  state: GitRepositoryState;
  changes: GitStateChange[];
}

/**
 * Types of state changes that can occur
 */
export type GitStateChangeType =
  | 'branch-changed'
  | 'branch-created'
  | 'branch-deleted'
  | 'commit-created'
  | 'commit-amended'
  | 'files-staged'
  | 'files-unstaged'
  | 'changes-discarded'
  | 'stash-created'
  | 'stash-applied'
  | 'stash-dropped'
  | 'remote-fetched'
  | 'push-completed'
  | 'pull-completed'
  | 'merge-started'
  | 'merge-completed'
  | 'merge-aborted'
  | 'rebase-started'
  | 'rebase-completed'
  | 'rebase-aborted'
  | 'operation-started'
  | 'operation-progress'
  | 'operation-completed'
  | 'operation-failed';

/**
 * Individual state change details
 */
export interface GitStateChange {
  type: GitStateChangeType;
  timestamp: number;
  details?: Record<string, unknown>;
}

/**
 * Cache entry for git state
 */
export interface GitStateCacheEntry {
  state: GitRepositoryState;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

/**
 * Options for git state service configuration
 */
export interface GitStateServiceOptions {
  cacheTTL?: number; // Default cache time-to-live in milliseconds
  enablePolling?: boolean; // Whether to enable polling for state changes
  pollingInterval?: number; // Polling interval in milliseconds
}

/**
 * Result of a git state query
 */
export interface GitStateQueryResult {
  state: GitRepositoryState | null;
  cached: boolean;
  error?: string;
}
