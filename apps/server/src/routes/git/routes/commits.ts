/**
 * POST /commits endpoint - Stage, unstage, commit operations
 */

import type { Request, Response } from 'express';
import {
  stageFiles,
  unstageFiles,
  commitChanges,
  discardChanges,
  resetToCommit,
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
 * POST /commits/stage - Stage files for commit
 */
export function createStageFilesHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, paths } = req.body as { repoPath: string; paths?: string[] };

      if (!repoPath) {
        res.status(400).json({ success: false, error: 'repoPath is required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      await stageFiles(repoPath, paths);
      res.json({ success: true });

      // Emit state change (fire and forget)
      if (gitStateService) {
        gitStateService.recordChange(repoPath, 'files-staged', { paths }).catch((err) => {
          logger.error('Failed to record git state change:', err);
        });
      }
    } catch (error) {
      logError(error, 'Stage files failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /commits/unstage - Unstage files
 */
export function createUnstageFilesHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, paths } = req.body as { repoPath: string; paths: string[] };

      if (!repoPath || !paths || !Array.isArray(paths)) {
        res.status(400).json({ success: false, error: 'repoPath and paths (array) are required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      await unstageFiles(repoPath, paths);
      res.json({ success: true });

      // Emit state change (fire and forget)
      if (gitStateService) {
        gitStateService.recordChange(repoPath, 'files-unstaged', { paths }).catch((err) => {
          logger.error('Failed to record git state change:', err);
        });
      }
    } catch (error) {
      logError(error, 'Unstage files failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /commits/create - Create a commit
 */
export function createCommitHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, message, allowEmpty, amend, noVerify, signOff } = req.body as {
        repoPath: string;
        message: string;
        allowEmpty?: boolean;
        amend?: boolean;
        noVerify?: boolean;
        signOff?: boolean;
      };

      if (!repoPath || !message) {
        res.status(400).json({ success: false, error: 'repoPath and message are required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      const result = await commitChanges(repoPath, message, {
        allowEmpty,
        amend,
        noVerify,
        signOff,
      });

      if (result.success) {
        res.json({ success: true });

        // Emit state change (fire and forget)
        if (gitStateService) {
          const changeType = amend ? 'commit-amended' : 'commit-created';
          gitStateService.recordChange(repoPath, changeType, { message }).catch((err) => {
            logger.error('Failed to record git state change:', err);
          });
        }
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error) {
      logError(error, 'Create commit failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /commits/discard - Discard changes to files
 */
export function createDiscardChangesHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, paths } = req.body as { repoPath: string; paths: string[] };

      if (!repoPath || !paths || !Array.isArray(paths)) {
        res.status(400).json({ success: false, error: 'repoPath and paths (array) are required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      await discardChanges(repoPath, paths);
      res.json({ success: true });

      // Emit state change (fire and forget)
      if (gitStateService) {
        gitStateService.recordChange(repoPath, 'changes-discarded', { paths }).catch((err) => {
          logger.error('Failed to record git state change:', err);
        });
      }
    } catch (error) {
      logError(error, 'Discard changes failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /commits/reset - Reset to a specific commit
 */
export function createResetHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, commit, mode } = req.body as {
        repoPath: string;
        commit: string;
        mode?: 'soft' | 'mixed' | 'hard';
      };

      if (!repoPath || !commit) {
        res.status(400).json({ success: false, error: 'repoPath and commit are required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      await resetToCommit(repoPath, commit, mode || 'mixed');
      res.json({ success: true });
    } catch (error) {
      logError(error, 'Reset failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
