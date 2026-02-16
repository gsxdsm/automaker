/**
 * POST /prs endpoint - Pull request operations via gh CLI
 */

import type { Request, Response } from 'express';
import {
  isGhInstalled,
  listPullRequests,
  getPullRequest,
  createPullRequest,
  closePullRequest,
  mergePullRequest,
  commentOnPullRequest,
  getPullRequestChecks,
  checkoutPullRequest,
  generatePRTitle,
  generatePRDescription,
  isGitRepo,
} from '@automaker/git-utils';
import { getErrorMessage, createLogError } from '../../common.js';
import { createLogger } from '@automaker/utils';

const logger = createLogger('GitRoutes');
const logError = createLogError(logger);

/**
 * GET /prs/check-gh - Check if gh CLI is installed
 */
export function createCheckGhHandler() {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      const installed = await isGhInstalled();
      res.json({ success: true, installed });
    } catch (error) {
      logError(error, 'Check gh CLI failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /prs/list - List pull requests
 */
export function createListPRsHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, state, limit, head, base } = req.body as {
        repoPath: string;
        state?: 'OPEN' | 'CLOSED' | 'MERGED' | 'ALL';
        limit?: number;
        head?: string;
        base?: string;
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

      const prs = await listPullRequests(repoPath, { state, limit, head, base });
      res.json({ success: true, prs });
    } catch (error) {
      logError(error, 'List PRs failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * GET /prs/get - Get details of a specific PR
 */
export function createGetPRHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, prNumber } = req.query as { repoPath?: string; prNumber?: string };

      if (!repoPath || !prNumber) {
        res.status(400).json({ success: false, error: 'repoPath and prNumber are required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      const pr = await getPullRequest(repoPath, parseInt(prNumber, 10));
      if (!pr) {
        res.status(404).json({ success: false, error: 'Pull request not found' });
        return;
      }

      res.json({ success: true, pr });
    } catch (error) {
      logError(error, 'Get PR failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /prs/create - Create a pull request
 */
export function createCreatePRHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, title, body, head, base, draft } = req.body as {
        repoPath: string;
        title: string;
        body?: string;
        head?: string;
        base?: string;
        draft?: boolean;
      };

      if (!repoPath || !title) {
        res.status(400).json({ success: false, error: 'repoPath and title are required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      const pr = await createPullRequest(repoPath, { title, body, head, base, draft });
      if (!pr) {
        res.status(400).json({ success: false, error: 'Failed to create pull request' });
        return;
      }

      res.json({ success: true, pr });
    } catch (error) {
      logError(error, 'Create PR failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /prs/close - Close a pull request
 */
export function createClosePRHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, prNumber } = req.body as { repoPath: string; prNumber: number };

      if (!repoPath || !prNumber) {
        res.status(400).json({ success: false, error: 'repoPath and prNumber are required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      const success = await closePullRequest(repoPath, prNumber);
      if (!success) {
        res.status(400).json({ success: false, error: 'Failed to close pull request' });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      logError(error, 'Close PR failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /prs/merge - Merge a pull request
 */
export function createMergePRHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, prNumber, mergeMethod, comment } = req.body as {
        repoPath: string;
        prNumber: number;
        mergeMethod?: 'merge' | 'squash' | 'rebase';
        comment?: string;
      };

      if (!repoPath || !prNumber) {
        res.status(400).json({ success: false, error: 'repoPath and prNumber are required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      const success = await mergePullRequest(repoPath, prNumber, { mergeMethod, comment });
      if (!success) {
        res.status(400).json({ success: false, error: 'Failed to merge pull request' });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      logError(error, 'Merge PR failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /prs/comment - Add a comment to a pull request
 */
export function createCommentPRHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, prNumber, comment } = req.body as {
        repoPath: string;
        prNumber: number;
        comment: string;
      };

      if (!repoPath || !prNumber || !comment) {
        res
          .status(400)
          .json({ success: false, error: 'repoPath, prNumber, and comment are required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      const success = await commentOnPullRequest(repoPath, prNumber, comment);
      if (!success) {
        res.status(400).json({ success: false, error: 'Failed to add comment' });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      logError(error, 'Comment on PR failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * GET /prs/checks - Get PR checks status
 */
export function createGetPRChecksHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, prNumber } = req.query as { repoPath?: string; prNumber?: string };

      if (!repoPath || !prNumber) {
        res.status(400).json({ success: false, error: 'repoPath and prNumber are required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      const checks = await getPullRequestChecks(repoPath, parseInt(prNumber, 10));
      if (!checks) {
        res.status(404).json({ success: false, error: 'Failed to get PR checks' });
        return;
      }

      res.json({ success: true, checks });
    } catch (error) {
      logError(error, 'Get PR checks failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /prs/checkout - Checkout a PR locally
 */
export function createCheckoutPRHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, prNumber } = req.body as { repoPath: string; prNumber: number };

      if (!repoPath || !prNumber) {
        res.status(400).json({ success: false, error: 'repoPath and prNumber are required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      await checkoutPullRequest(repoPath, prNumber);
      res.json({ success: true });
    } catch (error) {
      logError(error, 'Checkout PR failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /prs/generate-title - Generate PR title from commits
 */
export function createGeneratePRTitleHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, baseBranch } = req.body as { repoPath: string; baseBranch?: string };

      if (!repoPath) {
        res.status(400).json({ success: false, error: 'repoPath is required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      const title = await generatePRTitle(repoPath, baseBranch);
      res.json({ success: true, title });
    } catch (error) {
      logError(error, 'Generate PR title failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}

/**
 * POST /prs/generate-description - Generate PR description from commits and diffs
 */
export function createGeneratePRDescriptionHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { repoPath, baseBranch } = req.body as { repoPath: string; baseBranch?: string };

      if (!repoPath) {
        res.status(400).json({ success: false, error: 'repoPath is required' });
        return;
      }

      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        res.status(400).json({ success: false, error: 'Not a git repository' });
        return;
      }

      const description = await generatePRDescription(repoPath, baseBranch);
      res.json({ success: true, description });
    } catch (error) {
      logError(error, 'Generate PR description failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
