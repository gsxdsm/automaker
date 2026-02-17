/**
 * POST /checkout-remote-branch endpoint - Checkout a remote branch
 *
 * Handles the full workflow for switching to a remote branch:
 * 1. Fetches latest from the remote
 * 2. Checks if a local tracking branch already exists
 *    - If it exists, checks it out
 *    - If not, creates a new local branch tracking the remote and pulls latest
 * 3. Optionally stashes uncommitted changes before switching (if stashChanges is true)
 *
 * Note: Git repository validation is handled by the requireValidWorktree middleware.
 */

import type { Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getErrorMessage, logError } from '../common.js';

const execAsync = promisify(exec);

/**
 * Shell-escape a branch name to prevent command injection.
 */
function escapeBranchName(branchName: string): string {
  return `'${branchName.replace(/'/g, "'\\''")}'`;
}

/**
 * Parse a remote branch name like "origin/feature-branch" into remote and local branch parts
 */
function parseRemoteBranch(remoteBranchName: string): {
  remote: string;
  localBranch: string;
} | null {
  const slashIndex = remoteBranchName.indexOf('/');
  if (slashIndex === -1) return null;
  return {
    remote: remoteBranchName.substring(0, slashIndex),
    localBranch: remoteBranchName.substring(slashIndex + 1),
  };
}

/**
 * Check if a local branch exists
 */
async function localBranchExists(cwd: string, branchName: string): Promise<boolean> {
  try {
    await execAsync(`git rev-parse --verify refs/heads/${escapeBranchName(branchName)}`, {
      cwd,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check for uncommitted changes
 */
async function hasUncommittedChanges(cwd: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync('git status --porcelain', { cwd });
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Get a summary of uncommitted changes for user feedback
 */
async function getChangesSummary(cwd: string): Promise<string> {
  try {
    const { stdout } = await execAsync('git status --short', { cwd });
    const lines = stdout.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return '';
    if (lines.length <= 5) return lines.join(', ');
    return `${lines.slice(0, 5).join(', ')} and ${lines.length - 5} more files`;
  } catch {
    return 'unknown changes';
  }
}

export function createCheckoutRemoteBranchHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        worktreePath,
        remoteBranchName,
        stashChanges = false,
      } = req.body as {
        worktreePath: string;
        remoteBranchName: string;
        stashChanges?: boolean;
      };

      if (!worktreePath) {
        res.status(400).json({
          success: false,
          error: 'worktreePath required',
        });
        return;
      }

      if (!remoteBranchName) {
        res.status(400).json({
          success: false,
          error: 'remoteBranchName required',
        });
        return;
      }

      // Parse the remote branch name (e.g., "origin/feature-branch")
      const parsed = parseRemoteBranch(remoteBranchName);
      if (!parsed) {
        res.status(400).json({
          success: false,
          error: `Invalid remote branch name: '${remoteBranchName}'. Expected format: remote/branch-name`,
        });
        return;
      }

      const { remote, localBranch } = parsed;

      // Step 1: Get current branch
      const { stdout: currentBranchOutput } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: worktreePath,
      });
      const previousBranch = currentBranchOutput.trim();

      // If already on the target local branch, just pull latest
      if (previousBranch === localBranch) {
        try {
          await execAsync(`git pull ${escapeBranchName(remote)} ${escapeBranchName(localBranch)}`, {
            cwd: worktreePath,
            timeout: 30000,
          });
        } catch {
          // Pull may fail if offline, that's ok
        }
        res.json({
          success: true,
          result: {
            previousBranch,
            currentBranch: localBranch,
            message: `Already on branch '${localBranch}', pulled latest changes`,
            isNewLocalBranch: false,
            stashed: false,
          },
        });
        return;
      }

      // Step 2: Fetch latest from remote
      try {
        await execAsync(`git fetch ${escapeBranchName(remote)}`, {
          cwd: worktreePath,
          timeout: 30000,
        });
      } catch (fetchError) {
        logError(fetchError, 'Fetch failed during remote branch checkout');
        res.status(500).json({
          success: false,
          error: `Failed to fetch from remote '${remote}': ${getErrorMessage(fetchError)}`,
          code: 'FETCH_FAILED',
        });
        return;
      }

      // Step 3: Verify the remote branch still exists after fetch
      try {
        await execAsync(
          `git rev-parse --verify refs/remotes/${escapeBranchName(remoteBranchName)}`,
          { cwd: worktreePath }
        );
      } catch {
        res.status(400).json({
          success: false,
          error: `Remote branch '${remoteBranchName}' no longer exists. It may have been deleted.`,
          code: 'REMOTE_BRANCH_NOT_FOUND',
        });
        return;
      }

      // Step 4: Check for uncommitted changes
      const hasChanges = await hasUncommittedChanges(worktreePath);
      let stashRef: string | null = null;
      let changesSummary = '';

      if (hasChanges) {
        if (!stashChanges) {
          changesSummary = await getChangesSummary(worktreePath);
          res.status(409).json({
            success: false,
            error: `You have uncommitted changes (${changesSummary}). Stash your changes before switching branches.`,
            code: 'UNCOMMITTED_CHANGES',
            changesSummary,
          });
          return;
        }

        // Stash changes
        changesSummary = await getChangesSummary(worktreePath);
        try {
          await execAsync(
            `git stash push -m 'automaker: checkout-remote ${remoteBranchName}' --include-untracked`,
            { cwd: worktreePath }
          );
          // Get the stash reference
          const { stdout: stashListOutput } = await execAsync('git stash list -n1', {
            cwd: worktreePath,
          });
          const match = stashListOutput.trim().match(/^(stash@\{\d+\})/);
          stashRef = match ? match[1] : 'stash@{0}';
        } catch (stashError) {
          logError(stashError, 'Stash failed during remote branch checkout');
          res.status(500).json({
            success: false,
            error: `Failed to stash changes: ${getErrorMessage(stashError)}`,
          });
          return;
        }
      }

      // Step 5: Check if local branch already exists
      const localExists = await localBranchExists(worktreePath, localBranch);
      let isNewLocalBranch = false;

      try {
        if (localExists) {
          // Checkout existing local branch
          await execAsync(`git checkout ${escapeBranchName(localBranch)}`, {
            cwd: worktreePath,
          });
          // Pull latest changes
          try {
            await execAsync(
              `git pull ${escapeBranchName(remote)} ${escapeBranchName(localBranch)}`,
              {
                cwd: worktreePath,
                timeout: 30000,
              }
            );
          } catch {
            // Pull may fail, that's ok - we're already on the branch
          }
        } else {
          // Create new local branch tracking the remote
          isNewLocalBranch = true;
          await execAsync(
            `git checkout -b ${escapeBranchName(localBranch)} ${escapeBranchName(remoteBranchName)}`,
            { cwd: worktreePath }
          );
        }
      } catch (checkoutError) {
        logError(checkoutError, 'Remote branch checkout failed');

        // Try to restore stash if we created one
        if (stashRef) {
          try {
            await execAsync('git stash pop', { cwd: worktreePath });
          } catch (restoreError) {
            logError(restoreError, 'Failed to restore stash after failed checkout');
          }
        }

        res.status(500).json({
          success: false,
          error: `Failed to checkout branch '${localBranch}': ${getErrorMessage(checkoutError)}`,
        });
        return;
      }

      // Step 6: Get the actual current branch after checkout
      const { stdout: newBranchOutput } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: worktreePath,
      });
      const currentBranch = newBranchOutput.trim();

      // Step 7: Pop stash if we created one
      let stashApplied = false;
      let stashApplyError: string | null = null;
      let stashPreserved = false;

      if (stashRef) {
        try {
          await execAsync('git stash pop', { cwd: worktreePath });
          stashApplied = true;
        } catch (applyError) {
          logError(applyError, 'Stash pop failed after remote branch checkout');
          stashApplyError = getErrorMessage(applyError);
          stashPreserved = true;
          // Stash is preserved, user can resolve conflicts manually
        }
      }

      // Build response message
      let message: string;
      if (isNewLocalBranch) {
        message = `Created local branch '${localBranch}' tracking '${remoteBranchName}'`;
      } else {
        message = `Switched to branch '${localBranch}' and pulled latest changes`;
      }

      if (stashApplied) {
        message += '. Your stashed changes have been restored.';
      } else if (stashPreserved) {
        message +=
          '. Your changes were stashed but could not be automatically applied due to conflicts. Run "git stash pop" to apply and resolve conflicts manually.';
      }

      res.json({
        success: true,
        result: {
          previousBranch,
          currentBranch,
          remoteBranch: remoteBranchName,
          localBranch,
          isNewLocalBranch,
          message,
          stashed: !!stashRef,
          stashApplied,
          stashPreserved,
          stashRef: stashPreserved ? stashRef : undefined,
          stashError: stashApplyError,
        },
      });
    } catch (error) {
      logError(error, 'Checkout remote branch failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
