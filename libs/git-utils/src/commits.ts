/**
 * Git commit operations utilities
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type { GitOperationResult } from './types.js';
import { buildGitCommand, escapeShellArgs, MAX_BUFFER_SIZE } from './shell.js';

const execAsync = promisify(exec);

/**
 * Stage files for commit
 */
export async function stageFiles(repoPath: string, paths?: string[]): Promise<void> {
  if (paths && paths.length > 0) {
    const escapedPaths = escapeShellArgs(paths);
    const files = escapedPaths.join(' ');
    await execAsync(`git add ${files}`, { cwd: repoPath, maxBuffer: MAX_BUFFER_SIZE });
  } else {
    await execAsync('git add -A', { cwd: repoPath });
  }
}

/**
 * Unstage files
 */
export async function unstageFiles(repoPath: string, paths: string[]): Promise<void> {
  const escapedPaths = escapeShellArgs(paths);
  const files = escapedPaths.join(' ');
  await execAsync(`git reset HEAD -- ${files}`, { cwd: repoPath, maxBuffer: MAX_BUFFER_SIZE });
}

/**
 * Commit staged changes
 */
export async function commitChanges(
  repoPath: string,
  message: string,
  options?: { allowEmpty?: boolean; amend?: boolean; noVerify?: boolean; signOff?: boolean }
): Promise<GitOperationResult> {
  try {
    const args = ['commit'];
    if (options?.allowEmpty) args.push('--allow-empty');
    if (options?.amend) args.push('--amend');
    if (options?.noVerify) args.push('--no-verify');
    if (options?.signOff) args.push('--signoff');
    args.push('-m', message);

    const cmd = buildGitCommand('git', args);
    await execAsync(cmd, { cwd: repoPath });
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMsg };
  }
}

/**
 * Amend the last commit with a new message
 */
export async function amendCommitMessage(
  repoPath: string,
  newMessage: string
): Promise<GitOperationResult> {
  return commitChanges(repoPath, newMessage, { amend: true });
}

/**
 * Discard changes to files
 */
export async function discardChanges(repoPath: string, paths: string[]): Promise<void> {
  const escapedPaths = escapeShellArgs(paths);
  const files = escapedPaths.join(' ');
  await execAsync(`git checkout -- ${files}`, { cwd: repoPath, maxBuffer: MAX_BUFFER_SIZE });
}

/**
 * Reset to a specific commit
 */
export async function resetToCommit(
  repoPath: string,
  commit: string,
  mode: 'soft' | 'mixed' | 'hard' = 'mixed'
): Promise<void> {
  const cmd = buildGitCommand('git', ['reset', `--${mode}`, commit]);
  await execAsync(cmd, { cwd: repoPath });
}
