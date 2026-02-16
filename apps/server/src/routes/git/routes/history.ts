/**
 * POST /history endpoint - Get commit history and details
 */

import type { Request, Response } from 'express';
import {
  getCommitHistory,
  getCommit,
  getCommitDiff,
  getFileHistory,
  getCommitCount,
  isGitRepo,
} from '@automaker/git-utils';
import { getErrorMessage, createLogError } from '../../common.js';
import { createLogger } from '@automaker/utils';

const logger = createLogger('GitRoutes');
const logError = createLogError(logger);

/**
 * POST /history/log - Get commit history
 */
export function createHistoryLogHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, limit, offset, author, since, until, path } = req.body as {
        repoPath: string;
        limit?: number;
        offset?: number;
        author?: string;
        since?: string;
        until?: string;
        path?: string;
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

      const commits = await getCommitHistory(repoPath, {
        limit,
        offset,
        author,
        since,
        until,
        path,
      });
      res.json({ success: true, commits });
    } catch (error) {
      logError(error, 'Get commit history failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * GET /history/commit - Get details of a specific commit
 */
export function createGetCommitHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, hash } = req.query as { repoPath?: string; hash?: string };

      if (!repoPath || !hash) {
        res.status(400).json({ success: false, error: 'repoPath and hash are required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      const commit = await getCommit(repoPath, hash);
      if (!commit) {
        res.status(404).json({ success: false, error: 'Commit not found' });
        return;
      }

      res.json({ success: true, commit });
    } catch (error) {
      logError(error, 'Get commit failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /history/diff - Get diff for a specific commit
 */
export function createGetCommitDiffHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, hash } = req.body as { repoPath: string; hash: string };

      if (!repoPath || !hash) {
        res.status(400).json({ success: false, error: 'repoPath and hash are required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      const diff = await getCommitDiff(repoPath, hash);
      res.json({ success: true, diff });
    } catch (error) {
      logError(error, 'Get commit diff failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /history/file - Get file history
 */
export function createGetFileHistoryHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, path, limit } = req.body as {
        repoPath: string;
        path: string;
        limit?: number;
      };

      if (!repoPath || !path) {
        res.status(400).json({ success: false, error: 'repoPath and path are required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      const commits = await getFileHistory(repoPath, path, limit);
      res.json({ success: true, commits });
    } catch (error) {
      logError(error, 'Get file history failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * GET /history/count - Get commit count
 */
export function createGetCommitCountHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, branch } = req.query as { repoPath?: string; branch?: string };

      if (!repoPath) {
        res.status(400).json({ success: false, error: 'repoPath is required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      const count = await getCommitCount(repoPath, branch);
      res.json({ success: true, count });
    } catch (error) {
      logError(error, 'Get commit count failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
