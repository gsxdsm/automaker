/**
 * POST /push-pull endpoint - Push and pull operations
 */

import type { Request, Response } from 'express';
import {
  pullChanges,
  pushChanges,
  pullWithRebase,
  pushToUpstream,
  forcePush,
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
 * POST /push-pull/pull - Pull changes from remote
 */
export function createPullHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, remote, branch, noCommit, rebase } = req.body as {
        repoPath: string;
        remote?: string;
        branch?: string;
        noCommit?: boolean;
        rebase?: boolean;
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

      if (rebase) {
        const result = await pullWithRebase(repoPath, remote, branch);
        if (result.success) {
          res.json({ success: true, message: result.message });
          // Emit state change (fire and forget)
          if (gitStateService) {
            gitStateService
              .recordChange(repoPath, 'pull-completed', { remote, branch, rebase: true })
              .catch((err) => {
                logger.error('Failed to record git state change:', err);
              });
          }
        } else {
          res
            .status(400)
            .json({ success: false, error: result.error, conflicts: result.conflicts });
        }
      } else {
        const result = await pullChanges(repoPath, remote, branch, { noCommit });
        if (result.success) {
          res.json({ success: true, message: result.message });
          // Emit state change (fire and forget)
          if (gitStateService) {
            gitStateService
              .recordChange(repoPath, 'pull-completed', { remote, branch, rebase: false })
              .catch((err) => {
                logger.error('Failed to record git state change:', err);
              });
          }
        } else {
          res
            .status(400)
            .json({ success: false, error: result.error, conflicts: result.conflicts });
        }
      }
    } catch (error) {
      logError(error, 'Pull failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /push-pull/push - Push changes to remote
 */
export function createPushHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, remote, branch, force, setUpstream } = req.body as {
        repoPath: string;
        remote?: string;
        branch?: string;
        force?: boolean;
        setUpstream?: boolean;
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

      let result;
      if (force) {
        result = await forcePush(repoPath, remote, branch);
      } else if (setUpstream) {
        const pushRemote = remote || 'origin';
        const pushBranch = branch;
        if (!pushBranch) {
          res
            .status(400)
            .json({ success: false, error: 'branch is required when setUpstream is true' });
          return;
        }
        result = await pushToUpstream(repoPath, pushRemote, pushBranch);
      } else {
        result = await pushChanges(repoPath, remote, branch);
      }

      if (result.success) {
        res.json({ success: true, message: result.message });
        // Emit state change (fire and forget)
        if (gitStateService) {
          gitStateService
            .recordChange(repoPath, 'push-completed', { remote, branch, force })
            .catch((err) => {
              logger.error('Failed to record git state change:', err);
            });
        }
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error) {
      logError(error, 'Push failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
