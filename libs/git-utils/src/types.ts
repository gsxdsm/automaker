/**
 * Git utilities types and constants
 */

// Binary file extensions to skip
export const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.bmp',
  '.ico',
  '.webp',
  '.svg',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.zip',
  '.tar',
  '.gz',
  '.rar',
  '.7z',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.mp3',
  '.mp4',
  '.wav',
  '.avi',
  '.mov',
  '.mkv',
  '.ttf',
  '.otf',
  '.woff',
  '.woff2',
  '.eot',
  '.db',
  '.sqlite',
  '.sqlite3',
  '.pyc',
  '.pyo',
  '.class',
  '.o',
  '.obj',
]);

// Status map for git status codes
// Git porcelain format uses XY where X=staging area, Y=working tree
export const GIT_STATUS_MAP: Record<string, string> = {
  M: 'Modified',
  A: 'Added',
  D: 'Deleted',
  R: 'Renamed',
  C: 'Copied',
  U: 'Updated',
  '?': 'Untracked',
  '!': 'Ignored',
  ' ': 'Unmodified',
};

/**
 * File status interface for git status results
 */
export interface FileStatus {
  status: string;
  path: string;
  statusText: string;
}

/**
 * Git branch information
 */
export interface GitBranch {
  name: string;
  current: boolean;
  detached: boolean;
  tracking?: string;
  commit?: string;
  message?: string;
  ahead?: number;
  behind?: number;
  hasUncommittedChanges?: boolean;
  isRemote?: boolean;
}

/**
 * Git commit information
 */
export interface GitCommit {
  hash: string;
  shortHash: string;
  author: string;
  authorEmail: string;
  date: string;
  message: string;
  refs?: string;
}

/**
 * File change information for a commit
 */
export interface CommitFileChange {
  path: string;
  status: 'M' | 'A' | 'D' | 'R' | 'C';
  additions: number;
  deletions: number;
}

/**
 * Enhanced commit information with file stats
 */
export interface GitCommitWithStats extends GitCommit {
  fileCount: number;
  insertionCount: number;
  deletionCount: number;
  parents: string[];
  parentCount: number;
}

/**
 * Commit graph node for visualization
 */
export interface CommitGraphNode {
  commit: GitCommitWithStats;
  column: number;
  parents: string[];
  children: string[];
}

/**
 * Git remote information
 */
export interface GitRemote {
  name: string;
  fetchUrl?: string;
  pushUrl?: string;
}

/**
 * Git stash entry
 */
export interface GitStash {
  index: number;
  ref: string;
  hash: string;
  message: string;
}

/**
 * Git pull/push result
 */
export interface GitOperationResult {
  success: boolean;
  message?: string;
  conflicts?: string[];
  error?: string;
}

/**
 * Git merge/rebase result
 */
export interface GitMergeResult extends GitOperationResult {
  merged?: boolean;
}

/**
 * Pull request information (from gh CLI)
 */
export interface GitPullRequest {
  number: number;
  title: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  author: string;
  url: string;
  headRefName: string;
  baseRefName: string;
  createdAt: string;
  mergedAt?: string;
  closedAt?: string;
}

/**
 * Progress callback for long-running operations
 */
export type GitProgressCallback = (data: {
  stage?: string;
  progress?: number;
  total?: number;
  message?: string;
}) => void;
