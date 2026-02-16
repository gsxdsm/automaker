/**
 * POST /remotes endpoint - Manage git remotes
 */

import type { Request, Response } from 'express';
import {
  listRemotes,
  addRemote,
  removeRemote,
  updateRemoteUrl,
  fetchFromRemote,
  fetchAll,
  cloneRepository,
  getRemoteDefaultBranch,
  isGitRepo,
} from '@automaker/git-utils';
import { getErrorMessage, createLogError } from '../../common.js';
import { createLogger } from '@automaker/utils';

const logger = createLogger('GitRoutes');
const logError = createLogError(logger);

/**
 * GET /remotes/list - List all remotes
 */
export function createListRemotesHandler() {
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

      const remotes = await listRemotes(repoPath);
      res.json({ success: true, remotes });
    } catch (error) {
      logError(error, 'List remotes failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /remotes/add - Add a remote
 */
export function createAddRemoteHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, name, url } = req.body as { repoPath: string; name: string; url: string };

      if (!repoPath || !name || !url) {
        res.status(400).json({ success: false, error: 'repoPath, name, and url are required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      await addRemote(repoPath, name, url);
      res.json({ success: true });
    } catch (error) {
      logError(error, 'Add remote failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /remotes/remove - Remove a remote
 */
export function createRemoveRemoteHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, name } = req.body as { repoPath: string; name: string };

      if (!repoPath || !name) {
        res.status(400).json({ success: false, error: 'repoPath and name are required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      await removeRemote(repoPath, name);
      res.json({ success: true });
    } catch (error) {
      logError(error, 'Remove remote failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /remotes/update - Update a remote URL
 */
export function createUpdateRemoteHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, name, url } = req.body as { repoPath: string; name: string; url: string };

      if (!repoPath || !name || !url) {
        res.status(400).json({ success: false, error: 'repoPath, name, and url are required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      await updateRemoteUrl(repoPath, name, url);
      res.json({ success: true });
    } catch (error) {
      logError(error, 'Update remote failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /remotes/fetch - Fetch from a remote
 */
export function createFetchHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, remote } = req.body as { repoPath: string; remote?: string };

      if (!repoPath) {
        res.status(400).json({ success: false, error: 'repoPath is required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      if (remote) {
        await fetchFromRemote(repoPath, remote);
      } else {
        await fetchAll(repoPath);
      }

      res.json({ success: true });
    } catch (error) {
      logError(error, 'Fetch failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /remotes/clone - Clone a repository
 */
export function createCloneHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, url } = req.body as { repoPath: string; url: string };

      if (!repoPath || !url) {
        res.status(400).json({ success: false, error: 'repoPath and url are required' });
        return;
      }

      await cloneRepository(repoPath, url);
      res.json({ success: true });
    } catch (error) {
      logError(error, 'Clone failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * GET /remotes/default-branch - Get default branch of a remote
 */
export function createGetDefaultBranchHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, remote } = req.query as { repoPath?: string; remote?: string };

      if (!repoPath || !remote) {
        res.status(400).json({ success: false, error: 'repoPath and remote are required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      const branch = await getRemoteDefaultBranch(repoPath, remote);
      res.json({ success: true, branch });
    } catch (error) {
      logError(error, 'Get default branch failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
