/**
 * POST /checkout-branch endpoint - Create and checkout a new branch
 *
 * Note: Git repository validation (isGitRepo, hasCommits) is handled by
 * the requireValidWorktree middleware in index.ts.
 * Path validation (ALLOWED_ROOT_DIRECTORY) is handled by validatePathParams
 * middleware in index.ts.
 */

import type { Request, Response } from 'express';
import path from 'path';
import { stat } from 'fs/promises';
import { getErrorMessage, logError, isValidBranchName, execGitCommand } from '../common.js';

export function createCheckoutBranchHandler() {
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

      // Validate branch name using shared allowlist: /^[a-zA-Z0-9._\-/]+$/
      if (!isValidBranchName(branchName)) {
        res.status(400).json({
          success: false,
          error:
            'Invalid branch name. Must contain only letters, numbers, dots, dashes, underscores, or slashes.',
        });
        return;
      }

      // Resolve and validate worktreePath to prevent traversal attacks.
      // The validatePathParams middleware checks against ALLOWED_ROOT_DIRECTORY,
      // but we also resolve the path and verify it exists as a directory.
      const resolvedPath = path.resolve(worktreePath);
      try {
        const stats = await stat(resolvedPath);
        if (!stats.isDirectory()) {
          res.status(400).json({
            success: false,
            error: 'worktreePath is not a directory',
          });
          return;
        }
      } catch {
        res.status(400).json({
          success: false,
          error: 'worktreePath does not exist or is not accessible',
        });
        return;
      }

      // Get current branch for reference (using argument array to avoid shell injection)
      const currentBranchOutput = await execGitCommand(
        ['rev-parse', '--abbrev-ref', 'HEAD'],
        resolvedPath
      );
      const currentBranch = currentBranchOutput.trim();

      // Check if branch already exists
      try {
        await execGitCommand(['rev-parse', '--verify', branchName], resolvedPath);
        // Branch exists
        res.status(400).json({
          success: false,
          error: `Branch '${branchName}' already exists`,
        });
        return;
      } catch {
        // Branch doesn't exist, good to create
      }

      // Create and checkout the new branch (using argument array to avoid shell injection)
      await execGitCommand(['checkout', '-b', branchName], resolvedPath);

      res.json({
        success: true,
        result: {
          previousBranch: currentBranch,
          newBranch: branchName,
          message: `Created and checked out branch '${branchName}'`,
        },
      });
    } catch (error) {
      logError(error, 'Checkout branch failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
