/**
 * POST /stash endpoint - Git stash operations
 */

import type { Request, Response } from 'express';
import {
  listStash,
  saveStash,
  applyStash,
  popStash,
  dropStash,
  clearStash,
  showStash,
  getStash,
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
 * GET /stash/list - List all stash entries
 */
export function createListStashHandler() {
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

      const stashes = await listStash(repoPath);
      res.json({ success: true, stashes });
    } catch (error) {
      logError(error, 'List stash failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /stash/save - Save changes to stash
 */
export function createSaveStashHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, message, includeUntracked } = req.body as {
        repoPath: string;
        message?: string;
        includeUntracked?: boolean;
      };

      if (!repoPath) {
        res.status(400).json({ success: false, error: 'repoPath is required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      await saveStash(repoPath, message, includeUntracked);
      res.json({ success: true });

      // Emit state change (fire and forget)
      if (gitStateService) {
        gitStateService.recordChange(repoPath, 'stash-created', { message }).catch((err) => {
          logger.error('Failed to record git state change:', err);
        });
      }
    } catch (error) {
      logError(error, 'Save stash failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /stash/apply - Apply a stash entry
 */
export function createApplyStashHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, index } = req.body as { repoPath: string; index?: number };

      if (!repoPath) {
        res.status(400).json({ success: false, error: 'repoPath is required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      await applyStash(repoPath, index);
      res.json({ success: true });

      // Emit state change (fire and forget)
      if (gitStateService) {
        gitStateService.recordChange(repoPath, 'stash-applied', { index }).catch((err) => {
          logger.error('Failed to record git state change:', err);
        });
      }
    } catch (error) {
      logError(error, 'Apply stash failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /stash/pop - Pop a stash entry
 */
export function createPopStashHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, index } = req.body as { repoPath: string; index?: number };

      if (!repoPath) {
        res.status(400).json({ success: false, error: 'repoPath is required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      await popStash(repoPath, index);
      res.json({ success: true });

      // Emit state change (fire and forget)
      if (gitStateService) {
        gitStateService
          .recordChange(repoPath, 'stash-applied', { index, popped: true })
          .catch((err) => {
            logger.error('Failed to record git state change:', err);
          });
      }
    } catch (error) {
      logError(error, 'Pop stash failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /stash/drop - Drop a stash entry
 */
export function createDropStashHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, index } = req.body as { repoPath: string; index: number };

      if (!repoPath || index === undefined) {
        res.status(400).json({ success: false, error: 'repoPath and index are required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      await dropStash(repoPath, index);
      res.json({ success: true });

      // Emit state change (fire and forget)
      if (gitStateService) {
        gitStateService.recordChange(repoPath, 'stash-dropped', { index }).catch((err) => {
          logger.error('Failed to record git state change:', err);
        });
      }
    } catch (error) {
      logError(error, 'Drop stash failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /stash/clear - Clear all stash entries
 */
export function createClearStashHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath } = req.body as { repoPath: string };

      if (!repoPath) {
        res.status(400).json({ success: false, error: 'repoPath is required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      await clearStash(repoPath);
      res.json({ success: true });
    } catch (error) {
      logError(error, 'Clear stash failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /stash/show - Show the diff of a stash entry
 */
export function createShowStashHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, index } = req.body as { repoPath: string; index?: number };

      if (!repoPath) {
        res.status(400).json({ success: false, error: 'repoPath is required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      const diff = await showStash(repoPath, index);
      res.json({ success: true, diff });
    } catch (error) {
      logError(error, 'Show stash failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * GET /stash/get - Get a specific stash entry
 */
export function createGetStashHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, index } = req.query as { repoPath?: string; index?: string };

      if (!repoPath || index === undefined) {
        res.status(400).json({ success: false, error: 'repoPath and index are required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      const stash = await getStash(repoPath, parseInt(index, 10));
      if (!stash) {
        res.status(404).json({ success: false, error: 'Stash not found' });
        return;
      }

      res.json({ success: true, stash });
    } catch (error) {
      logError(error, 'Get stash failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
