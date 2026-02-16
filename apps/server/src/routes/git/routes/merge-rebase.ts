/**
 * POST /merge-rebase endpoint - Merge and rebase operations
 */

import type { Request, Response } from 'express';
import {
  mergeBranch,
  abortMerge,
  continueMerge,
  getMergePreview,
  rebaseBranch,
  abortRebase,
  continueRebase,
  skipRebasePatch,
  getRebasePreview,
  getConflictDetails,
  resolveConflict,
  applyManualResolution,
  isGitRepo,
} from '@automaker/git-utils';
import { getErrorMessage, createLogError } from '../../common.js';
import { createLogger } from '@automaker/utils';

const logger = createLogger('GitRoutes');
const logError = createLogError(logger);

/**
 * POST /merge-rebase/merge - Merge a branch
 */
export function createMergeHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, branch, noCommit, noFastForward, squash } = req.body as {
        repoPath: string;
        branch: string;
        noCommit?: boolean;
        noFastForward?: boolean;
        squash?: boolean;
      };

      if (!repoPath || !branch) {
        res.status(400).json({ success: false, error: 'repoPath and branch are required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      const result = await mergeBranch(repoPath, branch, { noCommit, noFastForward, squash });

      if (result.success) {
        res.json({ success: true, message: result.message });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          message: result.message,
          conflicts: result.conflicts,
        });
      }
    } catch (error) {
      logError(error, 'Merge failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /merge-rebase/abort-merge - Abort current merge
 */
export function createAbortMergeHandler() {
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

      await abortMerge(repoPath);
      res.json({ success: true });
    } catch (error) {
      logError(error, 'Abort merge failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /merge-rebase/continue-merge - Continue current merge
 */
export function createContinueMergeHandler() {
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

      const result = await continueMerge(repoPath);
      if (result.success) {
        res.json({ success: true, message: result.message });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error) {
      logError(error, 'Continue merge failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /merge-rebase/rebase - Rebase current branch
 */
export function createRebaseHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, upstream, branch } = req.body as {
        repoPath: string;
        upstream: string;
        branch?: string;
      };

      if (!repoPath || !upstream) {
        res.status(400).json({ success: false, error: 'repoPath and upstream are required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      const result = await rebaseBranch(repoPath, upstream, branch);

      if (result.success) {
        res.json({ success: true, message: result.message });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          message: result.message,
          conflicts: result.conflicts,
        });
      }
    } catch (error) {
      logError(error, 'Rebase failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /merge-rebase/abort-rebase - Abort current rebase
 */
export function createAbortRebaseHandler() {
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

      await abortRebase(repoPath);
      res.json({ success: true });
    } catch (error) {
      logError(error, 'Abort rebase failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /merge-rebase/continue-rebase - Continue current rebase
 */
export function createContinueRebaseHandler() {
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

      const result = await continueRebase(repoPath);
      if (result.success) {
        res.json({ success: true, message: result.message });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error) {
      logError(error, 'Continue rebase failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /merge-rebase/skip-rebase-patch - Skip current patch during rebase
 */
export function createSkipRebasePatchHandler() {
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

      const result = await skipRebasePatch(repoPath);
      if (result.success) {
        res.json({ success: true, message: result.message });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error) {
      logError(error, 'Skip rebase patch failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /merge-rebase/merge-preview - Get merge preview
 */
export function createMergePreviewHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, branch } = req.body as { repoPath: string; branch: string };

      if (!repoPath || !branch) {
        res.status(400).json({ success: false, error: 'repoPath and branch are required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      const result = await getMergePreview(repoPath, branch);
      res.json(result);
    } catch (error) {
      logError(error, 'Merge preview failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /merge-rebase/rebase-preview - Get rebase preview
 */
export function createRebasePreviewHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, upstream } = req.body as { repoPath: string; upstream: string };

      if (!repoPath || !upstream) {
        res.status(400).json({ success: false, error: 'repoPath and upstream are required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      const result = await getRebasePreview(repoPath, upstream);
      res.json(result);
    } catch (error) {
      logError(error, 'Rebase preview failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /merge-rebase/conflict-details - Get conflict details for 3-way merge
 */
export function createConflictDetailsHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, conflictFiles } = req.body as {
        repoPath: string;
        conflictFiles: string[];
      };

      if (!repoPath || !conflictFiles || !Array.isArray(conflictFiles)) {
        res.status(400).json({ success: false, error: 'repoPath and conflictFiles are required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      const result = await getConflictDetails(repoPath, conflictFiles);
      res.json(result);
    } catch (error) {
      logError(error, 'Get conflict details failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /merge-rebase/resolve-conflict - Resolve a conflict by choosing a side
 */
export function createResolveConflictHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, filePath, choice } = req.body as {
        repoPath: string;
        filePath: string;
        choice: 'ours' | 'theirs';
      };

      if (!repoPath || !filePath || !choice) {
        res
          .status(400)
          .json({ success: false, error: 'repoPath, filePath, and choice are required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      const result = await resolveConflict(repoPath, filePath, choice);
      res.json(result);
    } catch (error) {
      logError(error, 'Resolve conflict failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /merge-rebase/apply-manual-resolution - Apply manual resolution content
 */
export function createApplyManualResolutionHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, filePath, content } = req.body as {
        repoPath: string;
        filePath: string;
        content: string;
      };

      if (!repoPath || !filePath || content === undefined) {
        res
          .status(400)
          .json({ success: false, error: 'repoPath, filePath, and content are required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      const result = await applyManualResolution(repoPath, filePath, content);
      res.json(result);
    } catch (error) {
      logError(error, 'Apply manual resolution failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
