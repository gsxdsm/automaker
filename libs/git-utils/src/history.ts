/**
 * Git history/log operations utilities
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type { GitCommit, CommitFileChange, GitCommitWithStats } from './types.js';
import { buildGitCommand, MAX_BUFFER_SIZE } from './shell.js';

const execAsync = promisify(exec);

// Git log format indices
const LOG_FORMAT = {
  HASH: 0,
  SHORT_HASH: 1,
  AUTHOR: 2,
  AUTHOR_EMAIL: 3,
  DATE: 4,
  MESSAGE: 5,
  REFS_RAW: 6,
  PARENTS: 7,
} as const;

// Diff stat parsing constants
const BINARY_FILE_INDICATOR = '-' as const;
const MIN_TAB_PARTS = 3 as const;

/**
 * Get commit history for the repository
 */
export async function getCommitHistory(
  repoPath: string,
  options?: {
    limit?: number;
    offset?: number;
    author?: string;
    since?: string;
    until?: string;
    path?: string;
  }
): Promise<GitCommit[]> {
  let cmd = 'git log --pretty=format:"%H|%h|%an|%ae|%ai|%s%d"';

  if (options?.limit) {
    cmd += ` -n ${options.limit}`;
  }
  if (options?.offset) {
    cmd += ` --skip=${options.offset}`;
  }
  if (options?.author) {
    cmd += ` --author=${JSON.stringify(options.author)}`;
  }
  if (options?.since) {
    cmd += ` --since=${JSON.stringify(options.since)}`;
  }
  if (options?.until) {
    cmd += ` --until=${JSON.stringify(options.until)}`;
  }
  if (options?.path) {
    cmd += ` -- ${JSON.stringify(options.path)}`;
  }

  const { stdout } = await execAsync(cmd, { cwd: repoPath, maxBuffer: MAX_BUFFER_SIZE });

  const commits: GitCommit[] = [];
  const lines = stdout.split('\n').filter(Boolean);

  for (const line of lines) {
    const parts = line.split('|');
    const hash = parts[0];
    const shortHash = parts[1];
    const author = parts[2];
    const authorEmail = parts[3];
    const date = parts[4];
    const message = parts
      .slice(5)
      .join('|')
      .replace(/\([^)]*\)/g, '')
      .trim(); // Remove refs

    // Extract refs from original line
    const refsMatch = line.match(/\(([^)]+)\)/);
    const refs = refsMatch ? refsMatch[1] : undefined;

    commits.push({
      hash,
      shortHash,
      author,
      authorEmail,
      date,
      message,
      refs,
    });
  }

  return commits;
}

/**
 * Get details of a specific commit
 */
export async function getCommit(repoPath: string, hash: string): Promise<GitCommit | null> {
  try {
    const { stdout } = await execAsync(
      `git show --pretty=format:"%H|%h|%an|%ae|%ai|%s%d" --no-patch ${hash}`,
      { cwd: repoPath, maxBuffer: MAX_BUFFER_SIZE }
    );

    const parts = stdout.split('|');
    const refsMatch = stdout.match(/\(([^)]+)\)/);

    return {
      hash: parts[0],
      shortHash: parts[1],
      author: parts[2],
      authorEmail: parts[3],
      date: parts[4],
      message: parts
        .slice(5)
        .join('|')
        .replace(/\([^)]*\)/g, '')
        .trim(),
      refs: refsMatch ? refsMatch[1] : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Get the diff for a specific commit
 */
export async function getCommitDiff(repoPath: string, hash: string): Promise<string> {
  const { stdout } = await execAsync(`git show ${hash}`, {
    cwd: repoPath,
    maxBuffer: MAX_BUFFER_SIZE,
  });
  return stdout;
}

/**
 * Get file history
 */
export async function getFileHistory(
  repoPath: string,
  filePath: string,
  limit?: number
): Promise<GitCommit[]> {
  return getCommitHistory(repoPath, { path: filePath, limit });
}

/**
 * Get commit count
 */
export async function getCommitCount(repoPath: string, branch?: string): Promise<number> {
  const ref = branch || 'HEAD';
  const { stdout } = await execAsync(`git rev-list --count ${ref}`, { cwd: repoPath });
  return parseInt(stdout.trim(), 10);
}

/**
 * Parse commit information from a log line
 */
function parseCommitLine(line: string): GitCommitWithStats | null {
  const parts = line.split('|');
  if (parts.length <= LOG_FORMAT.PARENTS) return null;

  const parentHashes = parts[LOG_FORMAT.PARENTS]
    ? parts[LOG_FORMAT.PARENTS].split(' ').filter(Boolean)
    : [];
  const refsMatch = line.match(/\(([^)]+)\)/);
  const refs = refsMatch ? refsMatch[1] : undefined;

  return {
    hash: parts[LOG_FORMAT.HASH],
    shortHash: parts[LOG_FORMAT.SHORT_HASH],
    author: parts[LOG_FORMAT.AUTHOR],
    authorEmail: parts[LOG_FORMAT.AUTHOR_EMAIL],
    date: parts[LOG_FORMAT.DATE],
    message: parts[LOG_FORMAT.MESSAGE].replace(/\([^)]*\)/g, '').trim(),
    refs,
    parents: parentHashes,
    parentCount: parentHashes.length,
    fileCount: 0,
    insertionCount: 0,
    deletionCount: 0,
  };
}

/**
 * Get commit history with file statistics
 */
export async function getCommitHistoryWithStats(
  repoPath: string,
  options?: {
    limit?: number;
    offset?: number;
    author?: string;
    since?: string;
    until?: string;
    path?: string;
    branch?: string;
  }
): Promise<GitCommitWithStats[]> {
  const branch = options?.branch || 'HEAD';
  let cmd = `git log --numstat --pretty=format:"COMMIT_START|%H|%h|%an|%ae|%ai|%s%d|%P" ${branch}`;

  if (options?.limit) {
    cmd += ` -n ${options.limit}`;
  }
  if (options?.offset) {
    cmd += ` --skip=${options.offset}`;
  }
  if (options?.author) {
    cmd += ` --author=${JSON.stringify(options.author)}`;
  }
  if (options?.since) {
    cmd += ` --since=${JSON.stringify(options.since)}`;
  }
  if (options?.until) {
    cmd += ` --until=${JSON.stringify(options.until)}`;
  }
  if (options?.path) {
    cmd += ` -- ${JSON.stringify(options.path)}`;
  }

  const { stdout } = await execAsync(cmd, { cwd: repoPath, maxBuffer: MAX_BUFFER_SIZE });

  const commits: GitCommitWithStats[] = [];
  const lines = stdout.split('\n');

  let currentCommit: GitCommitWithStats | null = null;

  for (const line of lines) {
    if (line.startsWith('COMMIT_START|')) {
      // Save previous commit
      if (currentCommit) {
        commits.push(currentCommit);
      }

      // Parse new commit header
      currentCommit = parseCommitLine(line);
    } else if (currentCommit && line.trim()) {
      // Parse file stats
      const fileParts = line.split('\t');
      if (fileParts.length >= MIN_TAB_PARTS) {
        const additions =
          fileParts[0] === BINARY_FILE_INDICATOR ? 0 : parseInt(fileParts[0], 10) || 0;
        const deletions =
          fileParts[1] === BINARY_FILE_INDICATOR ? 0 : parseInt(fileParts[1], 10) || 0;
        currentCommit.insertionCount += additions;
        currentCommit.deletionCount += deletions;
        currentCommit.fileCount++;
      }
    }
  }

  // Save last commit
  if (currentCommit) {
    commits.push(currentCommit);
  }

  return commits;
}

/**
 * Get file changes for a specific commit
 */
export async function getCommitFiles(repoPath: string, hash: string): Promise<CommitFileChange[]> {
  try {
    const { stdout } = await execAsync(`git diff-tree --numstat -r ${hash}`, {
      cwd: repoPath,
      maxBuffer: MAX_BUFFER_SIZE,
    });

    const files: CommitFileChange[] = [];
    const lines = stdout.split('\n').filter(Boolean);

    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length >= MIN_TAB_PARTS) {
        const additions = parts[0] === BINARY_FILE_INDICATOR ? 0 : parseInt(parts[0], 10) || 0;
        const deletions = parts[1] === BINARY_FILE_INDICATOR ? 0 : parseInt(parts[1], 10) || 0;
        const path = parts[2];

        // Determine status based on additions/deletions
        let status: 'M' | 'A' | 'D' | 'R' | 'C' = 'M';
        if (additions > 0 && deletions === 0) {
          status = 'A';
        } else if (additions === 0 && deletions > 0) {
          status = 'D';
        }

        files.push({
          path,
          status,
          additions,
          deletions,
        });
      }
    }

    return files;
  } catch (error) {
    throw new Error(
      `Failed to get files for commit ${hash}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
