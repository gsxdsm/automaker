/**
 * Git state routes - API endpoints for querying git repository state
 */

import type { Request, Response } from 'express';
import { GitStateService } from '../../../services/git-state-service.js';
import { isGitRepo } from '@automaker/git-utils';
import { getErrorMessage, createLogError } from '../../common.js';
import { createLogger } from '@automaker/utils';

const logger = createLogger('GitRoutes');
const logError = createLogError(logger);

/**
 * GET /state - Get current git state for a repository
 */
export function createGetStateHandler(gitStateService: GitStateService) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, forceRefresh } = req.query as { repoPath?: string; forceRefresh?: string };

      if (!repoPath) {
        res.status(400).json({ success: false, error: 'repoPath is required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      // Force cache refresh if requested
      if (forceRefresh === 'true') {
        gitStateService.invalidateCache(repoPath);
      }

      const result = await gitStateService.getState(repoPath);

      if (result.state) {
        res.json({
          success: true,
          state: result.state,
          cached: result.cached,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'Failed to get git state',
        });
      }
    } catch (error) {
      logError(error, 'Get git state failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * GET /state/cached - Get cached git state without fetching if available
 */
export function createGetCachedStateHandler(gitStateService: GitStateService) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath } = req.query as { repoPath?: string };

      if (!repoPath) {
        res.status(400).json({ success: false, error: 'repoPath is required' });
        return;
      }

      const state = gitStateService.getCachedState(repoPath);

      if (state) {
        res.json({
          success: true,
          state,
          cached: true,
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'No cached state available',
        });
      }
    } catch (error) {
      logError(error, 'Get cached git state failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /state/invalidate - Invalidate cache for a repository
 */
export function createInvalidateCacheHandler(gitStateService: GitStateService) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath } = req.body as { repoPath: string };

      if (!repoPath) {
        res.status(400).json({ success: false, error: 'repoPath is required' });
        return;
      }

      gitStateService.invalidateCache(repoPath);

      res.json({ success: true });
    } catch (error) {
      logError(error, 'Invalidate cache failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /state/polling/start - Start polling for state changes
 */
export function createStartPollingHandler(gitStateService: GitStateService) {
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

      gitStateService.startPolling(repoPath);

      res.json({ success: true });
    } catch (error) {
      logError(error, 'Start polling failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /state/polling/stop - Stop polling for a repository
 */
export function createStopPollingHandler(gitStateService: GitStateService) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath } = req.body as { repoPath: string };

      if (!repoPath) {
        res.status(400).json({ success: false, error: 'repoPath is required' });
        return;
      }

      gitStateService.stopPolling(repoPath);

      res.json({ success: true });
    } catch (error) {
      logError(error, 'Stop polling failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
