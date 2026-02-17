/**
 * POST /stash-and-switch endpoint - Stash changes and switch branches
 *
 * This endpoint handles switching branches when there are uncommitted changes:
 * 1. Stashes current changes (git stash push -m "automaker: switch-branch")
 * 2. Switches to the target branch
 * 3. Applies the stash back (git stash pop)
 *
 * If the stash apply fails (e.g., merge conflicts), the stash is preserved
 * and the user is informed so they can resolve conflicts manually.
 *
 * Note: Git repository validation is handled by the requireValidWorktree middleware.
 */

import type { Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getErrorMessage, logError } from '../common.js';

const execAsync = promisify(exec);

const REMOTE_BRANCH_PATTERN = /^[a-zA-Z0-9_-]+\/.+$/;

/**
 * Regular expression pattern for identifying our stash entries.
 * We use a consistent message format: "automaker: switch-branch"
 */
const STASH_MESSAGE_PREFIX = 'automaker: switch-branch';

/**
 * Maximum number of changed files to show in summary before truncating
 */
const MAX_FILES_IN_SUMMARY = 5;

/**
 * Shell-escape a branch name to prevent command injection.
 * Branch names can contain characters that have special meaning in shell.
 */
function escapeBranchName(branchName: string): string {
  // Single quotes within single-quoted strings are represented as '\'' (end quote, escaped quote, start quote)
  return `'${branchName.replace(/'/g, "'\\''")}'`;
}

/**
 * Get a summary of uncommitted changes for user feedback
 */
async function getChangesSummary(cwd: string): Promise<string> {
  try {
    const { stdout } = await execAsync('git status --short', { cwd });
    const trimmed = stdout.trim();
    if (!trimmed) return '';
    const lines = trimmed.split('\n').filter(Boolean);
    if (lines.length === 0) return '';
    if (lines.length <= MAX_FILES_IN_SUMMARY) return lines.join(', ');
    return `${lines.slice(0, MAX_FILES_IN_SUMMARY).join(', ')} and ${lines.length - MAX_FILES_IN_SUMMARY} more files`;
  } catch {
    return 'unknown changes';
  }
}

/**
 * Get the most recent stash entry that matches our message prefix
 */
async function getLatestStashRef(cwd: string): Promise<string | null> {
  try {
    // Use --grep with proper shell quoting for the search pattern
    const { stdout } = await execAsync(`git stash list --grep='${STASH_MESSAGE_PREFIX}' -n1`, {
      cwd,
    });
    const trimmed = stdout.trim();
    if (!trimmed) return null;
    // Match stash@{0} style references
    const match = trimmed.match(/^stash@\{(\d+)\}/);
    return match ? `stash@{${match[1]}}` : null;
  } catch {
    return null;
  }
}

export function createStashAndSwitchHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { worktreePath, branchName } = req.body as {
        worktreePath: string;
        branchName: string;
      };

      if (!worktreePath) {
        res.status(400).json({
          success: false,
          error: 'worktreePath required',
        });
        return;
      }

      if (!branchName) {
        res.status(400).json({
          success: false,
          error: 'branchName required',
        });
        return;
      }

      // Get current branch
      const { stdout: currentBranchOutput } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: worktreePath,
      });
      const previousBranch = currentBranchOutput.trim();

      if (previousBranch === branchName) {
        res.json({
          success: true,
          result: {
            previousBranch,
            currentBranch: branchName,
            message: `Already on branch '${branchName}'`,
            stashed: false,
          },
        });
        return;
      }

      // Determine if this is a remote branch
      const isRemoteBranch = REMOTE_BRANCH_PATTERN.test(branchName);

      // Escape branch name for shell commands to prevent injection
      const escapedBranchName = escapeBranchName(branchName);

      // Validate the branch exists
      try {
        await execAsync(`git rev-parse --verify ${escapedBranchName}`, {
          cwd: worktreePath,
        });
      } catch {
        const errorPrefix = isRemoteBranch ? 'Remote branch' : 'Branch';
        res.status(400).json({
          success: false,
          error: `${errorPrefix} '${branchName}' does not exist`,
        });
        return;
      }

      // Check if there are uncommitted changes
      const { stdout: status } = await execAsync('git status --porcelain', {
        cwd: worktreePath,
      });
      const hasChanges = status.trim().length > 0;

      let stashRef: string | null = null;
      let changesSummary = '';

      if (hasChanges) {
        changesSummary = await getChangesSummary(worktreePath);

        // Get the current stash count to find our new stash later
        const { stdout: stashListBefore } = await execAsync('git stash list', {
          cwd: worktreePath,
        });
        const stashListBeforeTrimmed = stashListBefore.trim();
        const stashCountBefore = stashListBeforeTrimmed
          ? stashListBeforeTrimmed.split('\n').filter(Boolean).length
          : 0;

        // Create a stash with a recognizable message
        try {
          await execAsync(`git stash push -m '${STASH_MESSAGE_PREFIX}' --include-untracked`, {
            cwd: worktreePath,
          });

          // Get the stash reference by finding the new stash
          const { stdout: stashListAfter } = await execAsync('git stash list', {
            cwd: worktreePath,
          });
          const stashListAfterTrimmed = stashListAfter.trim();

          if (stashListAfterTrimmed) {
            const stashEntries = stashListAfterTrimmed.split('\n').filter(Boolean);
            if (stashEntries.length > stashCountBefore) {
              // Match stash@{0} style references
              const match = stashEntries[stashCountBefore].match(/^(stash@\{\d+\})/);
              stashRef = match ? match[1] : null;
            }
          }

          if (!stashRef) {
            // Fallback: try to find by our message prefix
            stashRef = await getLatestStashRef(worktreePath);
          }
        } catch (stashError) {
          logError(stashError, 'Stash creation failed');
          res.status(500).json({
            success: false,
            error: `Failed to stash changes: ${getErrorMessage(stashError)}`,
          });
          return;
        }
      }

      // Switch to the target branch
      try {
        await execAsync(`git checkout ${escapedBranchName}`, { cwd: worktreePath });
      } catch (checkoutError) {
        logError(checkoutError, 'Branch checkout failed after stash');

        // If checkout fails, try to restore the stash
        if (stashRef) {
          try {
            await execAsync(`git stash pop ${stashRef}`, { cwd: worktreePath });
          } catch (restoreError) {
            logError(restoreError, 'Failed to restore stash after failed checkout');
          }
        }

        res.status(500).json({
          success: false,
          error: `Failed to switch to branch '${branchName}': ${getErrorMessage(checkoutError)}`,
        });
        return;
      }

      // Get the actual current branch after checkout
      const { stdout: newBranchOutput } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: worktreePath,
      });
      const currentBranch = newBranchOutput.trim();

      // Try to apply the stash if we created one
      let stashApplied = false;
      let stashApplyError: string | null = null;

      if (stashRef) {
        try {
          await execAsync(`git stash pop ${stashRef}`, { cwd: worktreePath });
          stashApplied = true;
        } catch (applyError) {
          logError(applyError, 'Stash apply failed - preserving stash');
          stashApplyError = getErrorMessage(applyError);
          // The stash is preserved, user can resolve conflicts manually
        }
      }

      // Build response
      if (stashApplied) {
        res.json({
          success: true,
          result: {
            previousBranch,
            currentBranch,
            message: `Stashed changes (${changesSummary}), switched to branch '${branchName}', and restored changes`,
            stashed: true,
            stashApplied: true,
            stashPreserved: false,
          },
        });
      } else if (stashRef) {
        // Stash was created but not applied (likely due to conflicts)
        res.json({
          success: true,
          result: {
            previousBranch,
            currentBranch,
            message: `Switched to branch '${branchName}'. Your changes were stashed but could not be automatically applied due to conflicts. Run "git stash pop" to apply and resolve conflicts manually.`,
            stashed: true,
            stashApplied: false,
            stashPreserved: true,
            stashRef,
            stashError: stashApplyError,
          },
        });
      } else {
        // No changes to stash
        res.json({
          success: true,
          result: {
            previousBranch,
            currentBranch,
            message: isRemoteBranch
              ? `Created local branch '${currentBranch}' tracking '${branchName}'`
              : `Switched to branch '${branchName}'`,
            stashed: false,
          },
        });
      }
    } catch (error) {
      logError(error, 'Stash and switch failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
