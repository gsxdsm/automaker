/**
 * @automaker/git-utils
 * Git operations utilities for AutoMaker
 */

// Export types and constants
export {
  BINARY_EXTENSIONS,
  GIT_STATUS_MAP,
  type FileStatus,
  type GitBranch,
  type GitCommit,
  type GitRemote,
  type GitStash,
  type GitOperationResult,
  type GitMergeResult,
  type GitPullRequest,
  type GitProgressCallback,
  type CommitFileChange,
  type GitCommitWithStats,
  type CommitGraphNode,
} from './types.js';

// Export status utilities
export { isGitRepo, parseGitStatus } from './status.js';

// Export diff utilities
export {
  generateSyntheticDiffForNewFile,
  appendUntrackedFileDiffs,
  listAllFilesInDirectory,
  generateDiffsForNonGitDirectory,
  getGitRepositoryDiffs,
} from './diff.js';

// Export branch utilities
export {
  listBranches,
  createBranch,
  checkoutBranch,
  createAndCheckoutBranch,
  deleteBranch,
  renameBranch,
  renameCurrentBranch,
  getCurrentBranch,
} from './branches.js';

// Export commit utilities
export {
  stageFiles,
  unstageFiles,
  commitChanges,
  amendCommitMessage,
  discardChanges,
  resetToCommit,
} from './commits.js';

// Export history utilities
export {
  getCommitHistory,
  getCommit,
  getCommitDiff,
  getFileHistory,
  getCommitCount,
  getCommitHistoryWithStats,
  getCommitFiles,
} from './history.js';

// Export remote utilities
export {
  listRemotes,
  addRemote,
  removeRemote,
  updateRemoteUrl,
  fetchFromRemote,
  fetchAll,
  cloneRepository,
  getRemoteDefaultBranch,
} from './remotes.js';

// Export stash utilities
export {
  listStash,
  saveStash,
  applyStash,
  popStash,
  dropStash,
  clearStash,
  showStash,
  getStash,
} from './stash.js';

// Export push/pull utilities
export {
  pullChanges,
  pushChanges,
  pullWithRebase,
  pushToUpstream,
  forcePush,
} from './push-pull.js';

// Export merge/rebase utilities
export {
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
} from './merge-rebase.js';

// Export PR utilities
export {
  isGhInstalled,
  listPullRequests,
  getPullRequest,
  createPullRequest,
  closePullRequest,
  mergePullRequest,
  commentOnPullRequest,
  getPullRequestChecks,
  checkoutPullRequest,
  generatePRDescription,
  generatePRTitle,
} from './pr.js';

// Export shell utilities
export { escapeShellArg, escapeShellArgs, buildGitCommand, MAX_BUFFER_SIZE } from './shell.js';
