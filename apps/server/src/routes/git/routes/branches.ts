/**
 * POST /branches endpoint - List, create, checkout, delete, rename branches
 */

import type { Request, Response } from 'express';
import {
  listBranches,
  createBranch,
  checkoutBranch,
  createAndCheckoutBranch,
  deleteBranch,
  renameBranch,
  renameCurrentBranch,
  getCurrentBranch,
  isGitRepo,
} from '@automaker/git-utils';
import { getErrorMessage, createLogError } from '../../common.js';
import { createLogger } from '@automaker/utils';
import type { GitStateService } from '../../../services/git-state-service.js';

const logger = createLogger('GitRoutes');
const logError = createLogError(logger);

// Global state service reference (set during route creation)
let gitStateService: GitStateService | undefined;

export function setGitStateService(service: GitStateService | undefined): void {
  gitStateService = service;
}

/**
 * GET /branches - List all branches
 */
export function createListBranchesHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath } = req.query as { repoPath?: string };

      if (!repoPath) {
        res.status(400).json({ success: false, error: 'repoPath is required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      const branches = await listBranches(repoPath);
      res.json({ success: true, branches });
    } catch (error) {
      logError(error, 'List branches failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /branches/create - Create a new branch
 */
export function createCreateBranchHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, branchName, startPoint } = req.body as {
        repoPath: string;
        branchName: string;
        startPoint?: string;
      };

      if (!repoPath || !branchName) {
        res.status(400).json({ success: false, error: 'repoPath and branchName are required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      await createBranch(repoPath, branchName, startPoint);
      res.json({ success: true });

      // Emit state change (fire and forget, but log errors)
      if (gitStateService) {
        gitStateService.recordChange(repoPath, 'branch-created', { branchName }).catch((err) => {
          logger.error('Failed to record git state change:', err);
        });
      }
    } catch (error) {
      logError(error, 'Create branch failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /branches/checkout - Checkout a branch
 */
export function createCheckoutBranchHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, branchName } = req.body as { repoPath: string; branchName: string };

      if (!repoPath || !branchName) {
        res.status(400).json({ success: false, error: 'repoPath and branchName are required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      await checkoutBranch(repoPath, branchName);
      res.json({ success: true });

      // Emit state change for branch switch (fire and forget)
      if (gitStateService) {
        gitStateService
          .recordChange(repoPath, 'branch-changed', { to: branchName })
          .catch((err) => {
            logger.error('Failed to record git state change:', err);
          });
      }
    } catch (error) {
      logError(error, 'Checkout branch failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /branches/create-and-checkout - Create and checkout a new branch
 */
export function createCreateAndCheckoutBranchHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, branchName, startPoint } = req.body as {
        repoPath: string;
        branchName: string;
        startPoint?: string;
      };

      if (!repoPath || !branchName) {
        res.status(400).json({ success: false, error: 'repoPath and branchName are required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      await createAndCheckoutBranch(repoPath, branchName, startPoint);
      res.json({ success: true });

      // Emit state changes for branch creation and switch (fire and forget)
      if (gitStateService) {
        gitStateService.recordChange(repoPath, 'branch-created', { branchName }).catch((err) => {
          logger.error('Failed to record git state change:', err);
        });
        gitStateService
          .recordChange(repoPath, 'branch-changed', { to: branchName })
          .catch((err) => {
            logger.error('Failed to record git state change:', err);
          });
      }
    } catch (error) {
      logError(error, 'Create and checkout branch failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /branches/delete - Delete a branch
 */
export function createDeleteBranchHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, branchName, force } = req.body as {
        repoPath: string;
        branchName: string;
        force?: boolean;
      };

      if (!repoPath || !branchName) {
        res.status(400).json({ success: false, error: 'repoPath and branchName are required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      await deleteBranch(repoPath, branchName, force);
      res.json({ success: true });

      // Emit state change (fire and forget)
      if (gitStateService) {
        gitStateService.recordChange(repoPath, 'branch-deleted', { branchName }).catch((err) => {
          logger.error('Failed to record git state change:', err);
        });
      }
    } catch (error) {
      logError(error, 'Delete branch failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /branches/rename - Rename a branch
 */
export function createRenameBranchHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, oldName, newName } = req.body as {
        repoPath: string;
        oldName?: string;
        newName: string;
      };

      if (!repoPath || !newName) {
        res.status(400).json({ success: false, error: 'repoPath and newName are required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      if (oldName) {
        await renameBranch(repoPath, oldName, newName);
      } else {
        await renameCurrentBranch(repoPath, newName);
      }

      res.json({ success: true });
    } catch (error) {
      logError(error, 'Rename branch failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * GET /branches/current - Get current branch name
 */
export function createGetCurrentBranchHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath } = req.query as { repoPath?: string };

      if (!repoPath) {
        res.status(400).json({ success: false, error: 'repoPath is required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      const branch = await getCurrentBranch(repoPath);
      res.json({ success: true, branch });
    } catch (error) {
      logError(error, 'Get current branch failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
