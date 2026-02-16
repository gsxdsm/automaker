/**
 * Git push/pull operations utilities
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type { GitOperationResult, GitProgressCallback } from './types.js';
import { buildGitCommand, MAX_BUFFER_SIZE } from './shell.js';

const execAsync = promisify(exec);

/**
 * Pull changes from remote
 */
export async function pullChanges(
  repoPath: string,
  remote?: string,
  branch?: string,
  options?: { noCommit?: boolean; rebase?: boolean },
  progressCallback?: GitProgressCallback
): Promise<GitOperationResult> {
  try {
    if (progressCallback) {
      progressCallback({ stage: 'pull', message: 'Pulling changes...' });
    }

    const args = ['pull'];
    if (options?.noCommit) args.push('--no-commit');
    if (options?.rebase) args.push('--rebase');
    if (remote && branch) {
      args.push(remote, branch);
    }

    const cmd = buildGitCommand('git', args);
    await execAsync(cmd, { cwd: repoPath, maxBuffer: MAX_BUFFER_SIZE });

    if (progressCallback) {
      progressCallback({ stage: 'pull', message: 'Pull complete', progress: 100, total: 100 });
    }

    return { success: true, message: 'Pull successful' };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Check for merge conflicts
    if (errorMsg.includes('CONFLICT') || errorMsg.includes('Merge conflict')) {
      return {
        success: false,
        error: errorMsg,
        message: 'Pull resulted in merge conflicts',
        conflicts: [],
      };
    }

    return { success: false, error: errorMsg };
  }
}

/**
 * Push changes to remote
 */
export async function pushChanges(
  repoPath: string,
  remote?: string,
  branch?: string,
  options?: { force?: boolean; setUpstream?: boolean },
  progressCallback?: GitProgressCallback
): Promise<GitOperationResult> {
  try {
    if (progressCallback) {
      progressCallback({ stage: 'push', message: 'Pushing changes...' });
    }

    const args = ['push'];
    if (options?.force) args.push('--force');
    if (options?.setUpstream) args.push('--set-upstream');
    if (remote && branch) {
      args.push(remote, branch);
    }

    const cmd = buildGitCommand('git', args);
    await execAsync(cmd, { cwd: repoPath, maxBuffer: MAX_BUFFER_SIZE });

    if (progressCallback) {
      progressCallback({ stage: 'push', message: 'Push complete', progress: 100, total: 100 });
    }

    return { success: true, message: 'Push successful' };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMsg };
  }
}

/**
 * Pull with rebase
 */
export async function pullWithRebase(
  repoPath: string,
  remote?: string,
  branch?: string,
  progressCallback?: GitProgressCallback
): Promise<GitOperationResult> {
  return pullChanges(repoPath, remote, branch, { rebase: true }, progressCallback);
}

/**
 * Push to upstream (set upstream if not set)
 */
export async function pushToUpstream(
  repoPath: string,
  remote: string,
  branch: string,
  progressCallback?: GitProgressCallback
): Promise<GitOperationResult> {
  return pushChanges(repoPath, remote, branch, { setUpstream: true }, progressCallback);
}

/**
 * Force push
 */
export async function forcePush(
  repoPath: string,
  remote?: string,
  branch?: string,
  progressCallback?: GitProgressCallback
): Promise<GitOperationResult> {
  return pushChanges(repoPath, remote, branch, { force: true }, progressCallback);
}
