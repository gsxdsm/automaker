/**
 * Git State Management Service
 *
 * Provides real-time tracking of git repository state with caching and WebSocket updates.
 * Emits events when git state changes (commits, branch switches, pulls, etc.)
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import {
  listBranches,
  getCurrentBranch,
  parseGitStatus,
  isGitRepo,
  listStash,
  type FileStatus,
  type GitBranch,
} from '@automaker/git-utils';
import { createLogger } from '@automaker/utils';
import type {
  EventEmitter,
  GitRepositoryState,
  GitStateCacheEntry,
  GitStateChange,
  GitStateChangeEvent,
  GitStateQueryResult,
  GitStateServiceOptions,
  RemoteStatus,
  BranchInfo,
  UncommittedChanges,
} from '@automaker/types';

const execAsync = promisify(exec);

const logger = createLogger('GitStateService');

// Named constants for default values
const DEFAULT_CACHE_TTL_MS = 5000; // 5 seconds
const DEFAULT_POLLING_INTERVAL_MS = 10000; // 10 seconds
const GIT_COMMAND_TIMEOUT_MS = 30000; // 30 seconds for git commands

// Event type constants
const GIT_STATE_CHANGED_EVENT = 'git:state-changed' as const;
const GIT_OPERATION_PROGRESS_EVENT = 'git:operation-progress' as const;

const DEFAULT_OPTIONS: Required<Omit<GitStateServiceOptions, 'enablePolling'>> = {
  cacheTTL: DEFAULT_CACHE_TTL_MS,
  pollingInterval: DEFAULT_POLLING_INTERVAL_MS,
};

/**
 * Service for tracking and caching git repository state
 */
export class GitStateService {
  private cache: Map<string, GitStateCacheEntry> = new Map();
  private options: Required<Omit<GitStateServiceOptions, 'enablePolling'>>;
  private eventEmitter: EventEmitter;
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private enablePolling: boolean;
  // Track in-flight state requests to prevent duplicates
  private pendingStateRequests: Map<string, Promise<GitRepositoryState>> = new Map();

  constructor(eventEmitter: EventEmitter, options: GitStateServiceOptions = {}) {
    this.eventEmitter = eventEmitter;
    this.enablePolling = options.enablePolling ?? false;
    this.options = {
      cacheTTL: options.cacheTTL ?? DEFAULT_OPTIONS.cacheTTL,
      pollingInterval: options.pollingInterval ?? DEFAULT_OPTIONS.pollingInterval,
    };
  }

  /**
   * Get the current state of a git repository
   * Uses cache if available and not expired
   * Prevents duplicate simultaneous requests for the same repository
   */
  async getState(repoPath: string): Promise<GitStateQueryResult> {
    try {
      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        return {
          state: null,
          cached: false,
          error: 'Not a git repository',
        };
      }

      // Check cache first
      const cached = this.cache.get(repoPath);
      const now = Date.now();
      if (cached && now - cached.timestamp < cached.ttl) {
        return {
          state: cached.state,
          cached: true,
        };
      }

      // Check if there's already a pending request for this repo
      const existingRequest = this.pendingStateRequests.get(repoPath);
      if (existingRequest) {
        const state = await existingRequest;
        return {
          state,
          cached: false,
        };
      }

      // Build fresh state
      const statePromise = this.buildState(repoPath);
      this.pendingStateRequests.set(repoPath, statePromise);

      try {
        const state = await statePromise;

        // Update cache
        this.cache.set(repoPath, {
          state,
          timestamp: now,
          ttl: this.options.cacheTTL,
        });

        return {
          state,
          cached: false,
        };
      } finally {
        // Clean up pending request
        this.pendingStateRequests.delete(repoPath);
      }
    } catch (error) {
      // Clean up pending request on error
      this.pendingStateRequests.delete(repoPath);
      logger.error('Error getting git state:', error);
      return {
        state: null,
        cached: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check if polling is enabled
   */
  isPollingEnabled(): boolean {
    return this.enablePolling;
  }

  /**
   * Get cached state without fetching if available
   */
  getCachedState(repoPath: string): GitRepositoryState | null {
    const cached = this.cache.get(repoPath);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.state;
    }
    return null;
  }

  /**
   * Invalidate cache for a specific repository
   */
  invalidateCache(repoPath: string): void {
    this.cache.delete(repoPath);
  }

  /**
   * Build a complete repository state snapshot
   * Uses Promise.allSettled to ensure partial failures don't break entire state
   */
  private async buildState(repoPath: string): Promise<GitRepositoryState> {
    // Execute all independent queries in parallel, handling failures gracefully
    const results = await Promise.allSettled([
      this.getCurrentBranch(repoPath),
      this.getBranchesInfo(repoPath),
      this.getStatusOutput(repoPath),
      this.getStashCount(repoPath),
      this.getRemoteStatus(repoPath),
      this.checkIsWorktree(repoPath),
    ]);

    // Extract results with fallbacks for failures
    const currentBranch = results[0].status === 'fulfilled' ? results[0].value : 'HEAD';
    const branches = results[1].status === 'fulfilled' ? results[1].value : [];
    const statusOutput = results[2].status === 'fulfilled' ? results[2].value : '';
    const stashes = results[3].status === 'fulfilled' ? results[3].value : 0;
    const remoteStatus =
      results[4].status === 'fulfilled' ? results[4].value : { hasRemote: false };
    const isWorktree = results[5].status === 'fulfilled' ? results[5].value : false;

    const uncommittedChanges = this.parseUncommittedChanges(statusOutput);

    return {
      repoPath,
      currentBranch,
      branches,
      uncommittedChanges,
      stashCount: stashes,
      remoteStatus,
      lastUpdated: Date.now(),
      isWorktree,
      worktreePath: isWorktree ? repoPath : undefined,
    };
  }

  /**
   * Get current branch name
   */
  private async getCurrentBranch(repoPath: string): Promise<string> {
    try {
      return await getCurrentBranch(repoPath);
    } catch {
      return 'HEAD';
    }
  }

  /**
   * Get branch information including remote status
   * Handles failures for individual branch remote status queries gracefully
   */
  private async getBranchesInfo(repoPath: string): Promise<BranchInfo[]> {
    try {
      const branches = await listBranches(repoPath);
      const currentBranch = await this.getCurrentBranch(repoPath);

      // Get ahead/behind for each branch, handling failures per-branch
      const branchInfoPromises = branches.map(async (branch) => {
        let remoteStatus: RemoteStatus | undefined;

        // Try to get remote status, but don't fail the entire operation if it fails
        try {
          remoteStatus = await this.getBranchRemoteStatus(repoPath, branch.name);
        } catch (error) {
          logger.debug(`Failed to get remote status for branch ${branch.name}:`, error);
          remoteStatus = { hasRemote: false };
        }

        return {
          name: branch.name,
          isCurrent: branch.name === currentBranch,
          isRemote: branch.isRemote,
          remoteStatus,
        };
      });

      return await Promise.all(branchInfoPromises);
    } catch (error) {
      logger.error('Error getting branch info:', error);
      return [];
    }
  }

  /**
   * Get remote status for a specific branch
   */
  private async getBranchRemoteStatus(
    repoPath: string,
    branchName: string
  ): Promise<RemoteStatus | undefined> {
    try {
      // Get the upstream branch for this branch
      const { stdout: upstream } = await execAsync(
        `git rev-parse --abbrev-ref --symbolic-full-name "${branchName}@{u}"`,
        {
          cwd: repoPath,
          maxBuffer: 10 * 1024 * 1024,
          timeout: GIT_COMMAND_TIMEOUT_MS,
        }
      );

      if (!upstream.trim()) {
        return { hasRemote: false };
      }

      const [remoteName, ...remoteBranchParts] = upstream.trim().split('/');
      const remoteBranch = remoteBranchParts.join('/');

      // Get ahead/behind counts
      const { stdout: revList } = await execAsync(
        `git rev-list --left-right --count "${branchName}...${upstream.trim()}"`,
        {
          cwd: repoPath,
          maxBuffer: 10 * 1024 * 1024,
          timeout: GIT_COMMAND_TIMEOUT_MS,
        }
      );

      const [ahead, behind] = revList.trim().split('\t').map(Number);

      // Validate ahead/behind are valid numbers
      if (isNaN(ahead) || isNaN(behind)) {
        logger.warn(`Invalid ahead/behind counts for branch ${branchName}: ${revList.trim()}`);
        return {
          hasRemote: true,
          remoteName,
          branchName: remoteBranch,
        };
      }

      return {
        hasRemote: true,
        remoteName,
        branchName: remoteBranch,
        aheadBehind: { ahead, behind },
      };
    } catch {
      // No remote configured or command failed
      return { hasRemote: false };
    }
  }

  /**
   * Get git status porcelain output
   */
  private async getStatusOutput(repoPath: string): Promise<string> {
    try {
      const { stdout } = await execAsync('git status --porcelain', {
        cwd: repoPath,
        maxBuffer: 10 * 1024 * 1024,
        timeout: GIT_COMMAND_TIMEOUT_MS,
      });
      return stdout;
    } catch {
      return '';
    }
  }

  /**
   * Get stash count
   */
  private async getStashCount(repoPath: string): Promise<number> {
    try {
      const stashes = await listStash(repoPath);
      return stashes.length;
    } catch {
      return 0;
    }
  }

  /**
   * Get remote status for the current branch
   */
  private async getRemoteStatus(repoPath: string): Promise<RemoteStatus> {
    try {
      const currentBranch = await this.getCurrentBranch(repoPath);
      const branchStatus = await this.getBranchRemoteStatus(repoPath, currentBranch);
      return branchStatus ?? { hasRemote: false };
    } catch {
      return { hasRemote: false };
    }
  }

  /**
   * Check if repo is a worktree
   */
  private async checkIsWorktree(repoPath: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync('git rev-parse --is-inside-work-tree', {
        cwd: repoPath,
        maxBuffer: 10 * 1024 * 1024,
        timeout: GIT_COMMAND_TIMEOUT_MS,
      });
      // Check if .git file exists (worktree indicator) or if it's a regular repo
      return stdout.trim() === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Parse uncommitted changes from status output
   */
  private parseUncommittedChanges(statusOutput: string): UncommittedChanges {
    const files = parseGitStatus(statusOutput);

    let stagedCount = 0;
    let unstagedCount = 0;
    let untrackedCount = 0;
    let hasConflicts = false;

    for (const file of files) {
      const indexStatus = file.status; // In parseGitStatus, status is the primary status

      if (indexStatus === 'U') {
        hasConflicts = true;
      }

      // Check staging area status (first char in porcelain output)
      // For our FileStatus, the status field represents the primary status
      if (indexStatus !== '?' && file.path) {
        stagedCount++;
      }
      if (indexStatus !== ' ' && indexStatus !== '?' && file.path) {
        unstagedCount++;
      }
      if (indexStatus === '?' && file.path) {
        untrackedCount++;
      }
    }

    return {
      files,
      stagedCount,
      unstagedCount,
      untrackedCount,
      hasConflicts,
    };
  }

  /**
   * Notify listeners that git state has changed
   * Made async to properly handle state fetching when cache is invalid
   */
  async emitStateChange(repoPath: string, changes: GitStateChange[]): Promise<void> {
    const stateResult = this.getCachedState(repoPath);
    if (!stateResult) {
      // If no cached state, fetch fresh state
      const result = await this.getState(repoPath);
      if (result.state) {
        const payload: GitStateChangeEvent = {
          repoPath,
          state: result.state,
          changes,
        };
        this.eventEmitter.emit(GIT_STATE_CHANGED_EVENT, payload);
      }
      return;
    }

    const payload: GitStateChangeEvent = {
      repoPath,
      state: stateResult,
      changes,
    };

    this.eventEmitter.emit(GIT_STATE_CHANGED_EVENT, payload);
  }

  /**
   * Record a state change and emit event
   * Now properly async to ensure fresh state is fetched before emission
   */
  async recordChange(
    repoPath: string,
    changeType: GitStateChange['type'],
    details?: Record<string, unknown>
  ): Promise<void> {
    const change: GitStateChange = {
      type: changeType,
      timestamp: Date.now(),
      details,
    };

    // Invalidate cache so next fetch gets fresh data
    this.invalidateCache(repoPath);

    // Emit the change event (now async, will fetch fresh state if needed)
    await this.emitStateChange(repoPath, [change]);
  }

  /**
   * Record operation progress
   */
  recordProgress(
    repoPath: string,
    operation: string,
    currentStep: number,
    totalSteps: number,
    message: string,
    details?: string
  ): void {
    const state = this.getCachedState(repoPath);
    if (state) {
      state.operationProgress = {
        operation,
        currentStep,
        totalSteps,
        message,
        details,
      };

      this.eventEmitter.emit(GIT_OPERATION_PROGRESS_EVENT, {
        repoPath,
        operation,
        currentStep,
        totalSteps,
        message,
        details,
      });
    }
  }

  /**
   * Start polling for state changes on a repository
   */
  startPolling(repoPath: string): void {
    if (!this.enablePolling) {
      return;
    }

    // Don't start multiple polls for same repo
    if (this.pollingIntervals.has(repoPath)) {
      return;
    }

    const interval = setInterval(async () => {
      const oldState = this.getCachedState(repoPath);
      const result = await this.getState(repoPath);

      if (result.state && oldState) {
        const changes = this.detectChanges(oldState, result.state);
        if (changes.length > 0) {
          this.emitStateChange(repoPath, changes);
        }
      }
    }, this.options.pollingInterval);

    this.pollingIntervals.set(repoPath, interval);
  }

  /**
   * Stop polling for a repository
   */
  stopPolling(repoPath: string): void {
    const interval = this.pollingIntervals.get(repoPath);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(repoPath);
    }
  }

  /**
   * Detect differences between two states
   */
  private detectChanges(
    oldState: GitRepositoryState,
    newState: GitRepositoryState
  ): GitStateChange[] {
    const changes: GitStateChange[] = [];

    // Check for branch change
    if (oldState.currentBranch !== newState.currentBranch) {
      changes.push({
        type: 'branch-changed',
        timestamp: Date.now(),
        details: { from: oldState.currentBranch, to: newState.currentBranch },
      });
    }

    // Check for commit count changes (simplified - just checks branch name changed)
    // In real implementation, would compare HEAD commits

    // Check for stash changes
    if (oldState.stashCount !== newState.stashCount) {
      if (newState.stashCount > oldState.stashCount) {
        changes.push({
          type: 'stash-created',
          timestamp: Date.now(),
        });
      } else {
        changes.push({
          type: 'stash-dropped',
          timestamp: Date.now(),
        });
      }
    }

    // Check for uncommitted changes
    const oldChanges = oldState.uncommittedChanges.files.length;
    const newChanges = newState.uncommittedChanges.files.length;
    if (oldChanges !== newChanges) {
      if (newChanges > oldChanges) {
        changes.push({
          type: 'files-staged',
          timestamp: Date.now(),
        });
      } else {
        changes.push({
          type: 'changes-discarded',
          timestamp: Date.now(),
        });
      }
    }

    return changes;
  }

  /**
   * Clear all cache and stop all polling
   */
  destroy(): void {
    this.cache.clear();
    this.pendingStateRequests.clear();
    for (const interval of this.pollingIntervals.values()) {
      clearInterval(interval);
    }
    this.pollingIntervals.clear();
  }
}

// Singleton instance
let gitStateServiceInstance: GitStateService | null = null;

/**
 * Get or create the git state service singleton
 */
export function getGitStateService(
  eventEmitter: EventEmitter,
  options?: GitStateServiceOptions
): GitStateService {
  if (!gitStateServiceInstance) {
    gitStateServiceInstance = new GitStateService(eventEmitter, options);
  }
  return gitStateServiceInstance;
}

/**
 * Reset the git state service singleton (mainly for testing)
 */
export function resetGitStateService(): void {
  if (gitStateServiceInstance) {
    gitStateServiceInstance.destroy();
    gitStateServiceInstance = null;
  }
}
