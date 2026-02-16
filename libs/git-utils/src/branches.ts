/**
 * Git branch operations utilities
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type { GitBranch } from './types.js';
import { escapeShellArg, buildGitCommand, MAX_BUFFER_SIZE } from './shell.js';

const execAsync = promisify(exec);

/**
 * Parse ahead/behind counts from git branch -vv output
 * The format is: [branchname: ahead 2, behind 1]
 */
function parseAheadBehind(branchInfo: string): { ahead?: number; behind?: number } {
  const match = branchInfo.match(/\[([^:]+):(?:\s+ahead (\d+))?(?:\s+behind (\d+))?\]/);
  if (match) {
    const ahead = match[2] ? parseInt(match[2], 10) : undefined;
    const behind = match[3] ? parseInt(match[3], 10) : undefined;
    return { ahead, behind };
  }
  return {};
}

/**
 * Get ahead/behind counts for a specific branch relative to its tracking branch
 */
export async function getBranchAheadBehind(
  repoPath: string,
  branchName: string
): Promise<{ ahead?: number; behind?: number }> {
  try {
    const { stdout } = await execAsync(`git rev-list --left-right --count ${branchName}...@{u}`, {
      cwd: repoPath,
    });
    const [ahead, behind] = stdout.trim().split('\t').map(Number);
    return { ahead, behind };
  } catch {
    // Branch doesn't have a tracking branch
    return {};
  }
}

/**
 * Check if the working tree has uncommitted changes for a specific branch
 */
export async function branchHasUncommittedChanges(
  repoPath: string,
  branchName: string
): Promise<boolean> {
  try {
    // First save current branch
    const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', {
      cwd: repoPath,
    });

    // If we're checking a different branch, we need to check its ref directly
    if (currentBranch.trim() !== branchName) {
      // Check if there are any differences between working tree and the branch
      const { stdout } = await execAsync(`git diff --name-only ${branchName}`, {
        cwd: repoPath,
      });
      return stdout.trim().length > 0;
    }

    // For current branch, use git status
    const { stdout } = await execAsync('git status --porcelain', {
      cwd: repoPath,
    });
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * List all branches in the repository with enhanced information
 */
export async function listBranches(repoPath: string, includeRemote = false): Promise<GitBranch[]> {
  const { stdout } = await execAsync(
    'git branch -vv --format="%(refname:short)|%(HEAD)|%(upstream:short)|%(objectname)|%(contents:subject)|%(if:equals=[HEAD])%(refname:short)%(else)%(if:equals=[no branch])%(refname:short)%(end)%(end)"',
    { cwd: repoPath, maxBuffer: MAX_BUFFER_SIZE }
  );

  const branches: GitBranch[] = [];
  const lines = stdout.split('\n').filter(Boolean);

  // Check if HEAD is detached once, not in the loop
  let isDetached = false;
  try {
    const { stdout: symbolicRef } = await execAsync('git symbolic-ref -q HEAD', {
      cwd: repoPath,
    });
    isDetached = !symbolicRef;
  } catch {
    // Command fails when HEAD is detached
    isDetached = true;
  }

  // Get current branch for checking uncommitted changes
  let currentBranchName = '';
  try {
    const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', {
      cwd: repoPath,
    });
    currentBranchName = currentBranch.trim();
  } catch {
    // Ignore error
  }

  for (const line of lines) {
    const parts = line.split('|');
    const name = parts[0] || '';
    const isCurrent = parts[1] === '*';
    const tracking = parts[2] || undefined;
    const commit = parts[3] || undefined;
    const message = parts[4] || undefined;

    // Determine if this is a remote branch
    const isRemote = name.includes('/');

    // Parse ahead/behind from the tracking info in the branch output
    // The format includes [upstream: ahead N, behind M] in the verbose output
    let ahead: number | undefined;
    let behind: number | undefined;

    if (tracking && !isRemote) {
      try {
        const counts = await getBranchAheadBehind(repoPath, name);
        ahead = counts.ahead;
        behind = counts.behind;
      } catch {
        // Ignore errors for ahead/behind
      }
    }

    // Check for uncommitted changes (only for local branches)
    let hasUncommittedChanges: boolean | undefined;
    if (!isRemote && isCurrent) {
      try {
        const { stdout: statusOutput } = await execAsync('git status --porcelain', {
          cwd: repoPath,
        });
        hasUncommittedChanges = statusOutput.trim().length > 0;
      } catch {
        hasUncommittedChanges = false;
      }
    }

    branches.push({
      name,
      current: isCurrent,
      detached: isDetached && isCurrent,
      tracking,
      commit,
      message,
      ahead,
      behind,
      hasUncommittedChanges,
      isRemote,
    });
  }

  // If includeRemote is true, also fetch remote branches
  if (includeRemote) {
    try {
      const { stdout: remoteBranches } = await execAsync(
        'git branch -r --format="%(refname:short)"',
        {
          cwd: repoPath,
          maxBuffer: MAX_BUFFER_SIZE,
        }
      );

      const remoteLines = remoteBranches.split('\n').filter(Boolean);
      for (const remoteBranch of remoteLines) {
        // Skip HEAD reference
        if (remoteBranch.endsWith('/HEAD')) continue;

        // Check if already in list
        if (!branches.find((b) => b.name === remoteBranch)) {
          branches.push({
            name: remoteBranch,
            current: false,
            detached: false,
            isRemote: true,
          });
        }
      }
    } catch {
      // Ignore errors fetching remote branches
    }
  }

  return branches;
}

/**
 * Create a new branch
 */
export async function createBranch(
  repoPath: string,
  branchName: string,
  startPoint?: string
): Promise<void> {
  const args = ['branch', branchName];
  if (startPoint) {
    args.push(startPoint);
  }
  const cmd = buildGitCommand('git', args);
  await execAsync(cmd, { cwd: repoPath });
}

/**
 * Checkout a branch
 */
export async function checkoutBranch(repoPath: string, branchName: string): Promise<void> {
  const cmd = buildGitCommand('git', ['checkout', branchName]);
  await execAsync(cmd, { cwd: repoPath });
}

/**
 * Create and checkout a new branch
 */
export async function createAndCheckoutBranch(
  repoPath: string,
  branchName: string,
  startPoint?: string
): Promise<void> {
  const args = ['checkout', '-b', branchName];
  if (startPoint) {
    args.push(startPoint);
  }
  const cmd = buildGitCommand('git', args);
  await execAsync(cmd, { cwd: repoPath });
}

/**
 * Delete a branch
 */
export async function deleteBranch(
  repoPath: string,
  branchName: string,
  force?: boolean
): Promise<void> {
  const forceFlag = force ? '-D' : '-d';
  const cmd = buildGitCommand('git', ['branch', forceFlag, branchName]);
  await execAsync(cmd, { cwd: repoPath });
}

/**
 * Rename a branch
 */
export async function renameBranch(
  repoPath: string,
  oldName: string,
  newName: string
): Promise<void> {
  const cmd = buildGitCommand('git', ['branch', '-m', oldName, newName]);
  await execAsync(cmd, { cwd: repoPath });
}

/**
 * Rename current branch
 */
export async function renameCurrentBranch(repoPath: string, newName: string): Promise<void> {
  const cmd = buildGitCommand('git', ['branch', '-m', newName]);
  await execAsync(cmd, { cwd: repoPath });
}

/**
 * Get current branch name
 */
export async function getCurrentBranch(repoPath: string): Promise<string> {
  const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: repoPath });
  return stdout.trim();
}
