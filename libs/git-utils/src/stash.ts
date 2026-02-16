/**
 * Git stash operations utilities
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type { GitStash } from './types.js';
import { buildGitCommand, MAX_BUFFER_SIZE } from './shell.js';

const execAsync = promisify(exec);

/**
 * List all stash entries
 */
export async function listStash(repoPath: string): Promise<GitStash[]> {
  try {
    const { stdout } = await execAsync('git stash list', {
      cwd: repoPath,
      maxBuffer: MAX_BUFFER_SIZE,
    });
    const stashes: GitStash[] = [];

    const lines = stdout.split('\n').filter(Boolean);
    for (const line of lines) {
      // Format: stash@{n}: <message>
      const match = line.match(/^stash@\{(\d+)\}: (.+)$/);
      if (match) {
        const index = parseInt(match[1], 10);
        const message = match[2];
        const ref = `stash@{${index}}`; // Fixed: was `stash@{index}`

        // Get the commit hash for this stash
        const { stdout: hashOutput } = await execAsync(`git rev-parse ${ref}`, { cwd: repoPath });
        const hash = hashOutput.trim();

        stashes.push({
          index,
          ref,
          hash,
          message,
        });
      }
    }

    return stashes;
  } catch {
    return [];
  }
}

/**
 * Save changes to stash
 */
export async function saveStash(
  repoPath: string,
  message?: string,
  includeUntracked?: boolean
): Promise<void> {
  const args = ['stash', 'push'];
  if (includeUntracked) args.push('-u');
  if (message) args.push('-m', message);

  const cmd = buildGitCommand('git', args);
  await execAsync(cmd, { cwd: repoPath });
}

/**
 * Apply a stash entry (keeps it in the list)
 */
export async function applyStash(repoPath: string, index?: number): Promise<void> {
  const ref = index !== undefined ? `stash@{${index}}` : 'stash';
  const cmd = buildGitCommand('git', ['stash', 'apply', ref]);
  await execAsync(cmd, { cwd: repoPath, maxBuffer: MAX_BUFFER_SIZE });
}

/**
 * Pop a stash entry (removes it from the list)
 */
export async function popStash(repoPath: string, index?: number): Promise<void> {
  const ref = index !== undefined ? `stash@{${index}}` : 'stash';
  const cmd = buildGitCommand('git', ['stash', 'pop', ref]);
  await execAsync(cmd, { cwd: repoPath, maxBuffer: MAX_BUFFER_SIZE });
}

/**
 * Drop a stash entry
 */
export async function dropStash(repoPath: string, index: number): Promise<void> {
  const ref = `stash@{${index}}`;
  const cmd = buildGitCommand('git', ['stash', 'drop', ref]);
  await execAsync(cmd, { cwd: repoPath });
}

/**
 * Clear all stash entries
 */
export async function clearStash(repoPath: string): Promise<void> {
  await execAsync('git stash clear', { cwd: repoPath });
}

/**
 * Show the diff of a stash entry
 */
export async function showStash(repoPath: string, index?: number): Promise<string> {
  const ref = index !== undefined ? `stash@{${index}}` : 'stash';
  const { stdout } = await execAsync(`git stash show -p ${ref}`, {
    cwd: repoPath,
    maxBuffer: MAX_BUFFER_SIZE,
  });
  return stdout;
}

/**
 * Get a specific stash entry
 */
export async function getStash(repoPath: string, index: number): Promise<GitStash | null> {
  const stashes = await listStash(repoPath);
  return stashes.find((s) => s.index === index) || null;
}
