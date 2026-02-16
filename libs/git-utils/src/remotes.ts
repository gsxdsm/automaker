/**
 * Git remote operations utilities
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type { GitRemote, GitProgressCallback } from './types.js';
import { buildGitCommand, MAX_BUFFER_SIZE } from './shell.js';

const execAsync = promisify(exec);

/**
 * List all remotes
 */
export async function listRemotes(repoPath: string): Promise<GitRemote[]> {
  try {
    const { stdout } = await execAsync('git remote -v', {
      cwd: repoPath,
      maxBuffer: MAX_BUFFER_SIZE,
    });
    const remotes = new Map<string, GitRemote>();

    const lines = stdout.split('\n').filter(Boolean);
    for (const line of lines) {
      const match = line.match(/^(\S+)\s+(\S+)\s+\((\w+)\)$/);
      if (match) {
        const [, name, url, type] = match;
        if (!remotes.has(name)) {
          remotes.set(name, { name });
        }
        const remote = remotes.get(name)!;
        if (type === 'fetch') {
          remote.fetchUrl = url;
        } else if (type === 'push') {
          remote.pushUrl = url;
        }
      }
    }

    return Array.from(remotes.values());
  } catch {
    return [];
  }
}

/**
 * Add a remote
 */
export async function addRemote(repoPath: string, name: string, url: string): Promise<void> {
  const cmd = buildGitCommand('git', ['remote', 'add', name, url]);
  await execAsync(cmd, { cwd: repoPath });
}

/**
 * Remove a remote
 */
export async function removeRemote(repoPath: string, name: string): Promise<void> {
  const cmd = buildGitCommand('git', ['remote', 'remove', name]);
  await execAsync(cmd, { cwd: repoPath });
}

/**
 * Update a remote URL
 */
export async function updateRemoteUrl(repoPath: string, name: string, url: string): Promise<void> {
  const cmd = buildGitCommand('git', ['remote', 'set-url', name, url]);
  await execAsync(cmd, { cwd: repoPath });
}

/**
 * Fetch from a remote
 */
export async function fetchFromRemote(
  repoPath: string,
  remote: string,
  progressCallback?: GitProgressCallback
): Promise<void> {
  if (progressCallback) {
    progressCallback({ stage: 'fetch', message: `Fetching from ${remote}...` });
  }

  const cmd = buildGitCommand('git', ['fetch', remote]);
  await execAsync(cmd, { cwd: repoPath, maxBuffer: MAX_BUFFER_SIZE });

  if (progressCallback) {
    progressCallback({ stage: 'fetch', message: 'Fetch complete', progress: 100, total: 100 });
  }
}

/**
 * Fetch all remotes
 */
export async function fetchAll(
  repoPath: string,
  progressCallback?: GitProgressCallback
): Promise<void> {
  if (progressCallback) {
    progressCallback({ stage: 'fetch', message: 'Fetching from all remotes...' });
  }

  await execAsync('git fetch --all', { cwd: repoPath, maxBuffer: MAX_BUFFER_SIZE });

  if (progressCallback) {
    progressCallback({ stage: 'fetch', message: 'Fetch complete', progress: 100, total: 100 });
  }
}

/**
 * Clone a repository
 */
export async function cloneRepository(
  repoPath: string,
  url: string,
  progressCallback?: GitProgressCallback
): Promise<void> {
  if (progressCallback) {
    progressCallback({ stage: 'clone', message: 'Cloning repository...', progress: 0, total: 100 });
  }

  const cmd = buildGitCommand('git', ['clone', url, repoPath]);
  await execAsync(cmd, { maxBuffer: MAX_BUFFER_SIZE });

  if (progressCallback) {
    progressCallback({ stage: 'clone', message: 'Clone complete', progress: 100, total: 100 });
  }
}

/**
 * Get default branch of a remote
 */
export async function getRemoteDefaultBranch(repoPath: string, remote: string): Promise<string> {
  try {
    // Try to get the symbolic reference for the remote's HEAD
    const { stdout } = await execAsync(`git symbolic-ref refs/remotes/${remote}/HEAD`, {
      cwd: repoPath,
    });
    const branch = stdout.trim().replace(`refs/remotes/${remote}/`, '');
    return branch;
  } catch {
    // Fallback to 'main' or 'master'
    const { stdout: branches } = await execAsync(
      `git branch -r --list ${remote}/main ${remote}/master`,
      {
        cwd: repoPath,
      }
    );
    if (branches.includes(`${remote}/main`)) {
      return 'main';
    }
    return 'master';
  }
}
