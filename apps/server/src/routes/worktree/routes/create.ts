/**
 * POST /create endpoint - Create a new git worktree
 *
 * This endpoint handles worktree creation with proper checks:
 * 1. First checks if git already has a worktree for the branch (anywhere)
 * 2. If found, returns the existing worktree (no error)
 * 3. Only creates a new worktree if none exists for the branch
 */

import type { Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import * as secureFs from '../../../lib/secure-fs.js';
import type { EventEmitter } from '../../../lib/events.js';
import { isGitRepo } from '@automaker/git-utils';
import {
  getErrorMessage,
  logError,
  normalizePath,
  ensureInitialCommit,
  isValidBranchName,
  execGitCommand,
  formatBranchName,
  copyFilesToWorktree,
  runPostCreationActions,
} from '../common.js';
import { trackBranch } from './branch-tracking.js';
import { createLogger } from '@automaker/utils';
import { runInitScript } from '../../../services/init-script-service.js';

const logger = createLogger('Worktree');

const execAsync = promisify(exec);

/**
 * Find an existing worktree for a given branch by checking git worktree list
 */
async function findExistingWorktreeForBranch(
  projectPath: string,
  branchName: string
): Promise<{ path: string; branch: string } | null> {
  try {
    const { stdout } = await execAsync('git worktree list --porcelain', {
      cwd: projectPath,
    });

    const lines = stdout.split('\n');
    let currentPath: string | null = null;
    let currentBranch: string | null = null;

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        currentPath = line.slice(9);
      } else if (line.startsWith('branch ')) {
        currentBranch = line.slice(7).replace('refs/heads/', '');
      } else if (line === '' && currentPath && currentBranch) {
        // End of a worktree entry
        if (currentBranch === branchName) {
          // Resolve to absolute path - git may return relative paths
          // Critical for cross-platform compatibility (Windows, macOS, Linux)
          const resolvedPath = path.isAbsolute(currentPath)
            ? path.resolve(currentPath)
            : path.resolve(projectPath, currentPath);
          return { path: resolvedPath, branch: currentBranch };
        }
        currentPath = null;
        currentBranch = null;
      }
    }

    // Check the last entry (if file doesn't end with newline)
    if (currentPath && currentBranch && currentBranch === branchName) {
      // Resolve to absolute path for cross-platform compatibility
      const resolvedPath = path.isAbsolute(currentPath)
        ? path.resolve(currentPath)
        : path.resolve(projectPath, currentPath);
      return { path: resolvedPath, branch: currentBranch };
    }

    return null;
  } catch {
    return null;
  }
}

export function createCreateHandler(events: EventEmitter) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        projectPath,
        branchName,
        baseBranch,
        branchTemplate,
        issueNumber,
        customPath,
        fileCopySettings,
        postCreationActions,
      } = req.body as {
        projectPath: string;
        branchName: string;
        baseBranch?: string;
        branchTemplate?: string;
        issueNumber?: string;
        customPath?: string;
        fileCopySettings?: { copyEnvFile?: boolean; customFiles?: string[] };
        postCreationActions?: { installDependencies?: boolean; runSetupScript?: boolean };
      };

      if (!projectPath || !branchName) {
        res.status(400).json({
          success: false,
          error: 'projectPath and branchName required',
        });
        return;
      }

      // Format branch name with template and issue number if provided
      const formattedBranchName = branchTemplate
        ? formatBranchName(branchTemplate, branchName, issueNumber)
        : branchName;

      // Validate formatted branch name to prevent command injection
      if (!isValidBranchName(formattedBranchName)) {
        res.status(400).json({
          success: false,
          error:
            'Invalid branch name. Branch names must contain only letters, numbers, dots, hyphens, underscores, and forward slashes.',
        });
        return;
      }

      // Validate base branch if provided
      if (baseBranch && !isValidBranchName(baseBranch) && baseBranch !== 'HEAD') {
        res.status(400).json({
          success: false,
          error:
            'Invalid base branch name. Branch names must contain only letters, numbers, dots, hyphens, underscores, and forward slashes.',
        });
        return;
      }

      if (!(await isGitRepo(projectPath))) {
        res.status(400).json({
          success: false,
          error: 'Not a git repository',
        });
        return;
      }

      // Ensure the repository has at least one commit so worktree commands referencing HEAD succeed
      // Pass git identity env vars so commits work without global git config
      const gitEnv = {
        GIT_AUTHOR_NAME: 'Automaker',
        GIT_AUTHOR_EMAIL: 'automaker@localhost',
        GIT_COMMITTER_NAME: 'Automaker',
        GIT_COMMITTER_EMAIL: 'automaker@localhost',
      };
      await ensureInitialCommit(projectPath, gitEnv);

      // First, check if git already has a worktree for this branch (anywhere)
      const existingWorktree = await findExistingWorktreeForBranch(
        projectPath,
        formattedBranchName
      );
      if (existingWorktree) {
        // Worktree already exists, return it as success (not an error)
        // This handles manually created worktrees or worktrees from previous runs
        logger.info(
          `Found existing worktree for branch "${formattedBranchName}" at: ${existingWorktree.path}`
        );

        // Track the branch so it persists in the UI
        await trackBranch(projectPath, formattedBranchName);

        res.json({
          success: true,
          worktree: {
            path: normalizePath(existingWorktree.path),
            branch: formattedBranchName,
            isNew: false, // Not newly created
          },
        });
        return;
      }

      // Determine worktree path
      const sanitizedName = formattedBranchName
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .replace(/^\/+|\/+$/g, ''); // Remove leading/trailing slashes
      const worktreesDir = path.join(projectPath, '.worktrees');
      const worktreePath = customPath
        ? path.join(worktreesDir, customPath)
        : path.join(worktreesDir, sanitizedName);

      // Create worktrees directory if it doesn't exist
      await secureFs.mkdir(worktreesDir, { recursive: true });

      // Check if branch exists (using array arguments to prevent injection)
      let branchExists = false;
      try {
        await execGitCommand(['rev-parse', '--verify', formattedBranchName], projectPath);
        branchExists = true;
      } catch {
        // Branch doesn't exist
      }

      // Create worktree (using array arguments to prevent injection)
      if (branchExists) {
        // Use existing branch
        await execGitCommand(['worktree', 'add', worktreePath, formattedBranchName], projectPath);
      } else {
        // Create new branch from base or HEAD
        const base = baseBranch || 'HEAD';
        await execGitCommand(
          ['worktree', 'add', '-b', formattedBranchName, worktreePath, base],
          projectPath
        );
      }

      // Copy files to worktree if requested
      await copyFilesToWorktree(projectPath, worktreePath, fileCopySettings);

      // Note: We intentionally do NOT symlink .automaker to worktrees
      // Features and config are always accessed from the main project path
      // This avoids symlink loop issues when activating worktrees

      // Track the branch so it persists in the UI even after worktree is removed
      await trackBranch(projectPath, formattedBranchName);

      // Resolve to absolute path for cross-platform compatibility
      // normalizePath converts to forward slashes for API consistency
      const absoluteWorktreePath = path.resolve(worktreePath);

      // Respond immediately (non-blocking)
      res.json({
        success: true,
        worktree: {
          path: normalizePath(absoluteWorktreePath),
          branch: formattedBranchName,
          isNew: !branchExists,
        },
      });

      // Run post-creation actions asynchronously after response
      (async () => {
        try {
          // Run init script if requested (or by default)
          if (postCreationActions?.runSetupScript !== false) {
            // runInitScript internally checks if script exists and hasn't already run
            await runInitScript({
              projectPath,
              worktreePath: absoluteWorktreePath,
              branch: formattedBranchName,
              emitter: events,
            });
          }

          // Run other post-creation actions
          await runPostCreationActions(absoluteWorktreePath, postCreationActions || {});
        } catch (err) {
          logger.error(`Post-creation actions failed for ${formattedBranchName}:`, err);
        }
      })().catch((err) => {
        logger.error(`Post-creation async error for ${formattedBranchName}:`, err);
      });
    } catch (error) {
      logError(error, 'Create worktree failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
