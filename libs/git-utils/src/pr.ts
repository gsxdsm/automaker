/**
 * Git pull request operations via gh CLI
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type { GitPullRequest } from './types.js';
import { buildGitCommand, MAX_BUFFER_SIZE } from './shell.js';

const execAsync = promisify(exec);

// Check result type for better error handling
interface CheckResult {
  name: string;
  status: string;
  conclusion?: string;
  databaseId?: number;
}

/**
 * Check if gh CLI is installed
 */
export async function isGhInstalled(): Promise<boolean> {
  try {
    await execAsync('gh --version');
    return true;
  } catch {
    return false;
  }
}

/**
 * List pull requests
 */
export async function listPullRequests(
  repoPath: string,
  options?: {
    state?: 'OPEN' | 'CLOSED' | 'MERGED' | 'ALL';
    limit?: number;
    head?: string;
    base?: string;
  }
): Promise<GitPullRequest[]> {
  try {
    const args = [
      'pr',
      'list',
      '--json',
      'number,title,state,author,url,headRefName,baseRefName,createdAt,mergedAt,closedAt',
    ];
    if (options?.state && options.state !== 'ALL') {
      args.push('--state', options.state.toLowerCase());
    }
    if (options?.limit) {
      args.push('--limit', String(options.limit));
    }
    if (options?.head) {
      args.push('--head', options.head);
    }
    if (options?.base) {
      args.push('--base', options.base);
    }

    const cmd = buildGitCommand('gh', args);
    const { stdout } = await execAsync(cmd, { cwd: repoPath });
    const prs = JSON.parse(stdout) as GitPullRequest[];
    return prs;
  } catch {
    // Silently return empty array on error (e.g., gh CLI not installed)
    return [];
  }
}

/**
 * Get details of a specific pull request
 */
export async function getPullRequest(
  repoPath: string,
  prNumber: number
): Promise<GitPullRequest | null> {
  try {
    const cmd = buildGitCommand('gh', [
      'pr',
      'view',
      String(prNumber),
      '--json',
      'number,title,state,author,url,headRefName,baseRefName,createdAt,mergedAt,closedAt',
    ]);
    const { stdout } = await execAsync(cmd, { cwd: repoPath });
    return JSON.parse(stdout) as GitPullRequest;
  } catch {
    return null;
  }
}

/**
 * Create a pull request
 */
export async function createPullRequest(
  repoPath: string,
  options: {
    title: string;
    body?: string;
    head?: string;
    base?: string;
    draft?: boolean;
  }
): Promise<GitPullRequest | null> {
  try {
    const args = ['pr', 'create', '--title', options.title];
    if (options.body) {
      args.push('--body', options.body);
    }
    if (options.head) {
      args.push('--head', options.head);
    }
    if (options.base) {
      args.push('--base', options.base);
    }
    if (options.draft) {
      args.push('--draft');
    }

    const cmd = buildGitCommand('gh', args);
    const { stdout } = await execAsync(cmd, { cwd: repoPath });
    // Output contains the PR URL, extract number from it
    const urlMatch = stdout.match(/pull\/(\d+)/);
    if (urlMatch) {
      return getPullRequest(repoPath, parseInt(urlMatch[1], 10));
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Close a pull request
 */
export async function closePullRequest(repoPath: string, prNumber: number): Promise<boolean> {
  try {
    const cmd = buildGitCommand('gh', ['pr', 'close', String(prNumber)]);
    await execAsync(cmd, { cwd: repoPath });
    return true;
  } catch {
    return false;
  }
}

/**
 * Merge a pull request
 */
export async function mergePullRequest(
  repoPath: string,
  prNumber: number,
  options?: {
    mergeMethod?: 'merge' | 'squash' | 'rebase';
    comment?: string;
  }
): Promise<boolean> {
  try {
    const args = ['pr', 'merge', String(prNumber)];
    if (options?.mergeMethod) {
      args.push(`--${options.mergeMethod}`);
    }
    if (options?.comment) {
      args.push('--body', options.comment);
    } else {
      args.push('--delete-branch', '--subject');
    }

    const cmd = buildGitCommand('gh', args);
    await execAsync(cmd, { cwd: repoPath });
    return true;
  } catch {
    return false;
  }
}

/**
 * Add a comment to a pull request
 */
export async function commentOnPullRequest(
  repoPath: string,
  prNumber: number,
  comment: string
): Promise<boolean> {
  try {
    const cmd = buildGitCommand('gh', ['pr', 'comment', String(prNumber), '--body', comment]);
    await execAsync(cmd, { cwd: repoPath });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get pull request checks status
 */
export async function getPullRequestChecks(
  repoPath: string,
  prNumber: number
): Promise<CheckResult[]> {
  try {
    const cmd = buildGitCommand('gh', [
      'pr',
      'checks',
      String(prNumber),
      '--json',
      'name,status,conclusion,databaseId',
    ]);
    const { stdout } = await execAsync(cmd, { cwd: repoPath, maxBuffer: MAX_BUFFER_SIZE });
    const checks = JSON.parse(stdout) as CheckResult[];
    return checks ?? [];
  } catch {
    // Return empty array on error instead of null for better type safety
    return [];
  }
}

/**
 * Checkout a pull request locally
 */
export async function checkoutPullRequest(repoPath: string, prNumber: number): Promise<void> {
  const cmd = buildGitCommand('gh', ['pr', 'checkout', String(prNumber)]);
  await execAsync(cmd, { cwd: repoPath, maxBuffer: MAX_BUFFER_SIZE });
}

/**
 * Generate PR description from commits and diffs
 * Uses git log and diff to create a summary
 */
export async function generatePRDescription(
  repoPath: string,
  baseBranch?: string
): Promise<string> {
  try {
    const currentBranch = await execAsync(buildGitCommand('git', ['branch', '--show-current']), {
      cwd: repoPath,
    });

    const targetBranch = baseBranch || 'main';
    const branchName = currentBranch.stdout.trim();

    // Get commit messages since the branch point
    const commitsCmd = buildGitCommand('git', [
      'log',
      `${targetBranch}..${branchName}`,
      '--pretty=format:- %s',
    ]);
    const { stdout: commits } = await execAsync(commitsCmd, { cwd: repoPath });

    // Get files changed
    const filesCmd = buildGitCommand('git', [
      'diff',
      '--name-only',
      `${targetBranch}...${branchName}`,
    ]);
    const { stdout: files } = await execAsync(filesCmd, { cwd: repoPath });

    // Get the number of commits and lines changed
    const statsCmd = buildGitCommand('git', [
      'diff',
      '--shortstat',
      `${targetBranch}...${branchName}`,
    ]);
    const { stdout: stats } = await execAsync(statsCmd, { cwd: repoPath });

    const fileList = files.trim().split('\n').filter(Boolean);
    const commitList = commits.trim().split('\n').filter(Boolean);

    let description = `## Summary\n\n`;
    description += `This PR includes changes from branch \`${branchName}\`.\n\n`;

    if (commitList.length > 0) {
      description += `## Changes\n\n`;
      description += commitList.slice(0, 10).join('\n') + '\n';
      if (commitList.length > 10) {
        description += `\n... and ${commitList.length - 10} more commits\n`;
      }
      description += `\n`;
    }

    if (stats.trim()) {
      description += `## Statistics\n\n${stats.trim()}\n\n`;
    }

    if (fileList.length > 0) {
      description += `## Files Changed\n\n`;
      fileList.slice(0, 20).forEach((file) => {
        description += `- \`${file}\`\n`;
      });
      if (fileList.length > 20) {
        description += `\n... and ${fileList.length - 20} more files\n`;
      }
    }

    return description;
  } catch {
    return '';
  }
}

/**
 * Generate PR title from the first commit
 */
export async function generatePRTitle(repoPath: string, baseBranch?: string): Promise<string> {
  try {
    const currentBranch = await execAsync(buildGitCommand('git', ['branch', '--show-current']), {
      cwd: repoPath,
    });

    const targetBranch = baseBranch || 'main';
    const branchName = currentBranch.stdout.trim();

    // Get the first commit message
    const cmd = buildGitCommand('git', [
      'log',
      `${targetBranch}..${branchName}`,
      '--pretty=format:%s',
      '-1',
    ]);
    const { stdout } = await execAsync(cmd, { cwd: repoPath });

    return stdout.trim() || `Merge ${branchName} into ${targetBranch}`;
  } catch {
    return 'Pull Request';
  }
}
