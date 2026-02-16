/**
 * Git routes - HTTP API for git operations (non-worktree)
 */

import { Router } from 'express';
import { validatePathParams } from '../../middleware/validate-paths.js';
import { createDiffsHandler } from './routes/diffs.js';
import { createFileDiffHandler } from './routes/file-diff.js';
import { GitStateService } from '../../services/git-state-service.js';

// Branch operations
import {
  createListBranchesHandler,
  createCreateBranchHandler,
  createCheckoutBranchHandler,
  createCreateAndCheckoutBranchHandler,
  createDeleteBranchHandler,
  createRenameBranchHandler,
  createGetCurrentBranchHandler,
} from './routes/branches.js';

// Commit operations
import {
  createStageFilesHandler,
  createUnstageFilesHandler,
  createCommitHandler,
  createDiscardChangesHandler,
  createResetHandler,
} from './routes/commits.js';

// History operations
import {
  createHistoryLogHandler,
  createGetCommitHandler,
  createGetCommitDiffHandler,
  createGetFileHistoryHandler,
  createGetCommitCountHandler,
} from './routes/history.js';

// Remote operations
import {
  createListRemotesHandler,
  createAddRemoteHandler,
  createRemoveRemoteHandler,
  createUpdateRemoteHandler,
  createFetchHandler,
  createCloneHandler,
  createGetDefaultBranchHandler,
} from './routes/remotes.js';

// Stash operations
import {
  createListStashHandler,
  createSaveStashHandler,
  createApplyStashHandler,
  createPopStashHandler,
  createDropStashHandler,
  createClearStashHandler,
  createShowStashHandler,
  createGetStashHandler,
} from './routes/stash.js';

// Push/Pull operations
import { createPullHandler, createPushHandler } from './routes/push-pull.js';

// Merge/Rebase operations
import {
  createMergeHandler,
  createAbortMergeHandler,
  createContinueMergeHandler,
  createRebaseHandler,
  createAbortRebaseHandler,
  createContinueRebaseHandler,
  createSkipRebasePatchHandler,
} from './routes/merge-rebase.js';

// Pull request operations
import {
  createCheckGhHandler,
  createListPRsHandler,
  createGetPRHandler,
  createCreatePRHandler,
  createClosePRHandler,
  createMergePRHandler,
  createCommentPRHandler,
  createGetPRChecksHandler,
  createCheckoutPRHandler,
  createGeneratePRTitleHandler,
  createGeneratePRDescriptionHandler,
} from './routes/prs.js';

// State management operations
import {
  createGetStateHandler,
  createGetCachedStateHandler,
  createInvalidateCacheHandler,
  createStartPollingHandler,
  createStopPollingHandler,
} from './routes/state.js';

// Import setGitStateService functions from handlers
import { setGitStateService as setBranchService } from './routes/branches.js';
import { setGitStateService as setCommitService } from './routes/commits.js';
import { setGitStateService as setStashService } from './routes/stash.js';
import { setGitStateService as setPushPullService } from './routes/push-pull.js';

export function createGitRoutes(gitStateService?: GitStateService): Router {
  const router = Router();

  // Set the git state service reference in route handlers that need to emit events
  if (gitStateService) {
    setBranchService(gitStateService);
    setCommitService(gitStateService);
    setStashService(gitStateService);
    setPushPullService(gitStateService);
  }

  // Existing routes
  router.post('/diffs', validatePathParams('projectPath'), createDiffsHandler());
  router.post('/file-diff', validatePathParams('projectPath', 'filePath'), createFileDiffHandler());

  // Branch operations
  router.post('/diffs', validatePathParams('projectPath'), createDiffsHandler());
  router.post('/file-diff', validatePathParams('projectPath', 'filePath'), createFileDiffHandler());

  // Branch operations
  router.get('/branches', createListBranchesHandler());
  router.post('/branches/create', createCreateBranchHandler());
  router.post('/branches/checkout', createCheckoutBranchHandler());
  router.post('/branches/create-and-checkout', createCreateAndCheckoutBranchHandler());
  router.post('/branches/delete', createDeleteBranchHandler());
  router.post('/branches/rename', createRenameBranchHandler());
  router.get('/branches/current', createGetCurrentBranchHandler());

  // Commit operations
  router.post('/commits/stage', createStageFilesHandler());
  router.post('/commits/unstage', createUnstageFilesHandler());
  router.post('/commits/create', createCommitHandler());
  router.post('/commits/discard', createDiscardChangesHandler());
  router.post('/commits/reset', createResetHandler());

  // History operations
  router.post('/history/log', createHistoryLogHandler());
  router.get('/history/commit', createGetCommitHandler());
  router.post('/history/diff', createGetCommitDiffHandler());
  router.post('/history/file', createGetFileHistoryHandler());
  router.get('/history/count', createGetCommitCountHandler());

  // Remote operations
  router.get('/remotes/list', createListRemotesHandler());
  router.post('/remotes/add', createAddRemoteHandler());
  router.post('/remotes/remove', createRemoveRemoteHandler());
  router.post('/remotes/update', createUpdateRemoteHandler());
  router.post('/remotes/fetch', createFetchHandler());
  router.post('/remotes/clone', createCloneHandler());
  router.get('/remotes/default-branch', createGetDefaultBranchHandler());

  // Stash operations
  router.get('/stash/list', createListStashHandler());
  router.post('/stash/save', createSaveStashHandler());
  router.post('/stash/apply', createApplyStashHandler());
  router.post('/stash/pop', createPopStashHandler());
  router.post('/stash/drop', createDropStashHandler());
  router.post('/stash/clear', createClearStashHandler());
  router.post('/stash/show', createShowStashHandler());
  router.get('/stash/get', createGetStashHandler());

  // Push/Pull operations
  router.post('/push-pull/pull', createPullHandler());
  router.post('/push-pull/push', createPushHandler());

  // Merge/Rebase operations
  router.post('/merge-rebase/merge', createMergeHandler());
  router.post('/merge-rebase/abort-merge', createAbortMergeHandler());
  router.post('/merge-rebase/continue-merge', createContinueMergeHandler());
  router.post('/merge-rebase/rebase', createRebaseHandler());
  router.post('/merge-rebase/abort-rebase', createAbortRebaseHandler());
  router.post('/merge-rebase/continue-rebase', createContinueRebaseHandler());
  router.post('/merge-rebase/skip-rebase-patch', createSkipRebasePatchHandler());

  // Pull request operations
  router.get('/prs/check-gh', createCheckGhHandler());
  router.post('/prs/list', createListPRsHandler());
  router.get('/prs/get', createGetPRHandler());
  router.post('/prs/create', createCreatePRHandler());
  router.post('/prs/close', createClosePRHandler());
  router.post('/prs/merge', createMergePRHandler());
  router.post('/prs/comment', createCommentPRHandler());
  router.get('/prs/checks', createGetPRChecksHandler());
  router.post('/prs/checkout', createCheckoutPRHandler());
  router.post('/prs/generate-title', createGeneratePRTitleHandler());
  router.post('/prs/generate-description', createGeneratePRDescriptionHandler());

  // State management routes (if service is provided)
  if (gitStateService) {
    router.get('/state', createGetStateHandler(gitStateService));
    router.get('/state/cached', createGetCachedStateHandler(gitStateService));
    router.post('/state/invalidate', createInvalidateCacheHandler(gitStateService));
    router.post('/state/polling/start', createStartPollingHandler(gitStateService));
    router.post('/state/polling/stop', createStopPollingHandler(gitStateService));
  }

  return router;
}
