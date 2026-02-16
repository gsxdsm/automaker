/**
 * Git merge/rebase operations utilities
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import type { GitMergeResult, GitProgressCallback } from './types.js';
import { buildGitCommand, MAX_BUFFER_SIZE } from './shell.js';

const execAsync = promisify(exec);

// Constants for git stages
const GIT_STAGE_BASE = 1;
const GIT_STAGE_OURS = 2;
const GIT_STAGE_THEIRS = 3;

/**
 * Merge a branch into the current branch
 */
export async function mergeBranch(
  repoPath: string,
  branch: string,
  options?: { noCommit?: boolean; noFastForward?: boolean; squash?: boolean },
  progressCallback?: GitProgressCallback
): Promise<GitMergeResult> {
  try {
    if (progressCallback) {
      progressCallback({ stage: 'merge', message: `Merging ${branch}...` });
    }

    const args = ['merge'];
    if (options?.noCommit) args.push('--no-commit');
    if (options?.noFastForward) args.push('--no-ff');
    if (options?.squash) args.push('--squash');
    args.push(branch);

    const cmd = buildGitCommand('git', args);
    await execAsync(cmd, { cwd: repoPath, maxBuffer: MAX_BUFFER_SIZE });

    if (progressCallback) {
      progressCallback({ stage: 'merge', message: 'Merge complete', progress: 100, total: 100 });
    }

    return { success: true, merged: true, message: `Merged ${branch}` };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Check for merge conflicts
    if (errorMsg.includes('CONFLICT') || errorMsg.includes('Merge conflict')) {
      // Get list of conflicted files
      try {
        const { stdout: statusOutput } = await execAsync('git diff --name-only --diff-filter=U', {
          cwd: repoPath,
        });
        const conflicts = statusOutput.split('\n').filter(Boolean);
        return {
          success: false,
          merged: false,
          error: errorMsg,
          message: 'Merge resulted in conflicts',
          conflicts,
        };
      } catch {
        return {
          success: false,
          merged: false,
          error: errorMsg,
          message: 'Merge resulted in conflicts',
          conflicts: [],
        };
      }
    }

    return { success: false, merged: false, error: errorMsg };
  }
}

/**
 * Get merge preview using merge-base
 */
export async function getMergePreview(
  repoPath: string,
  branch: string
): Promise<{ success: boolean; diff?: string; files?: string[]; error?: string }> {
  try {
    // Get the merge-base diff
    const { stdout: diffOutput } = await execAsync(`git diff --no-color "${branch}"...HEAD`, {
      cwd: repoPath,
      maxBuffer: MAX_BUFFER_SIZE,
    });

    // Get list of changed files
    const { stdout: filesOutput } = await execAsync(`git diff --name-only "${branch}"...HEAD`, {
      cwd: repoPath,
      maxBuffer: MAX_BUFFER_SIZE,
    });

    const files = filesOutput.split('\n').filter(Boolean);

    return {
      success: true,
      diff: diffOutput,
      files,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Abort current merge
 */
export async function abortMerge(repoPath: string): Promise<void> {
  await execAsync('git merge --abort', { cwd: repoPath });
}

/**
 * Continue current merge after resolving conflicts
 */
export async function continueMerge(repoPath: string): Promise<GitMergeResult> {
  try {
    await execAsync('git commit', { cwd: repoPath, maxBuffer: MAX_BUFFER_SIZE });
    return { success: true, merged: true, message: 'Merge completed' };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { success: false, merged: false, error: errorMsg };
  }
}

/**
 * Rebase current branch onto another
 */
export async function rebaseBranch(
  repoPath: string,
  upstream: string,
  branch?: string,
  progressCallback?: GitProgressCallback
): Promise<GitMergeResult> {
  try {
    if (progressCallback) {
      progressCallback({ stage: 'rebase', message: `Rebasing onto ${upstream}...` });
    }

    const args = ['rebase', upstream];
    if (branch) {
      args.push(branch);
    }

    const cmd = buildGitCommand('git', args);
    await execAsync(cmd, { cwd: repoPath, maxBuffer: MAX_BUFFER_SIZE });

    if (progressCallback) {
      progressCallback({ stage: 'rebase', message: 'Rebase complete', progress: 100, total: 100 });
    }

    return { success: true, merged: true, message: 'Rebase successful' };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Check for conflicts
    if (errorMsg.includes('CONFLICT') || errorMsg.includes('conflict')) {
      try {
        const { stdout: statusOutput } = await execAsync('git diff --name-only --diff-filter=U', {
          cwd: repoPath,
        });
        const conflicts = statusOutput.split('\n').filter(Boolean);
        return {
          success: false,
          merged: false,
          error: errorMsg,
          message: 'Rebase resulted in conflicts',
          conflicts,
        };
      } catch {
        return {
          success: false,
          merged: false,
          error: errorMsg,
          message: 'Rebase resulted in conflicts',
          conflicts: [],
        };
      }
    }

    return { success: false, merged: false, error: errorMsg };
  }
}

/**
 * Get rebase preview
 */
export async function getRebasePreview(
  repoPath: string,
  upstream: string
): Promise<{ success: boolean; diff?: string; commits?: string[]; error?: string }> {
  try {
    // Get commits to be rebased
    const { stdout: logOutput } = await execAsync(`git log --oneline "${upstream}..HEAD"`, {
      cwd: repoPath,
      maxBuffer: MAX_BUFFER_SIZE,
    });

    const commits = logOutput.split('\n').filter(Boolean).reverse();

    // Get diff preview
    const { stdout: diffOutput } = await execAsync(`git diff --no-color "${upstream}...HEAD"`, {
      cwd: repoPath,
      maxBuffer: MAX_BUFFER_SIZE,
    });

    return {
      success: true,
      diff: diffOutput,
      commits,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Abort current rebase
 */
export async function abortRebase(repoPath: string): Promise<void> {
  await execAsync('git rebase --abort', { cwd: repoPath });
}

/**
 * Continue current rebase after resolving conflicts
 */
export async function continueRebase(repoPath: string): Promise<GitMergeResult> {
  try {
    await execAsync('git rebase --continue', { cwd: repoPath, maxBuffer: MAX_BUFFER_SIZE });
    return { success: true, merged: true, message: 'Rebase continued' };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { success: false, merged: false, error: errorMsg };
  }
}

/**
 * Skip current patch during rebase
 */
export async function skipRebasePatch(repoPath: string): Promise<GitMergeResult> {
  try {
    await execAsync('git rebase --skip', { cwd: repoPath });
    return { success: true, merged: true, message: 'Patch skipped' };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { success: false, merged: false, error: errorMsg };
  }
}

/**
 * Get conflict details for 3-way merge resolution
 * Returns the content of conflicted files from ours, theirs, and base perspectives
 */
export async function getConflictDetails(
  repoPath: string,
  conflictFiles: string[]
): Promise<{
  success: boolean;
  conflicts?: Array<{
    path: string;
    ours?: string;
    theirs?: string;
    base?: string;
    conflictMarkers?: string;
  }>;
  error?: string;
}> {
  try {
    const conflicts = await Promise.all(
      conflictFiles.map(async (filePath) => {
        try {
          // Helper function to get git show content for a specific stage
          const getStageContent = async (stage: number): Promise<string> => {
            try {
              const { stdout } = await execAsync(`git show :${stage}:"${filePath}"`, {
                cwd: repoPath,
                maxBuffer: MAX_BUFFER_SIZE,
              });
              return stdout;
            } catch {
              return `// No content available for stage ${stage}`;
            }
          };

          // Fetch all three stages in parallel for better performance
          const [oursContent, theirsContent, baseContent] = await Promise.all([
            getStageContent(GIT_STAGE_OURS),
            getStageContent(GIT_STAGE_THEIRS),
            getStageContent(GIT_STAGE_BASE),
          ]);

          // Read the file as it appears on disk (with conflict markers)
          const fullPath = join(repoPath, filePath);
          const diskContent = await readFile(fullPath, 'utf-8').catch(() => '');

          return {
            path: filePath,
            ours: oursContent,
            theirs: theirsContent,
            base: baseContent,
            conflictMarkers: diskContent,
          };
        } catch {
          return {
            path: filePath,
            ours: '// Error reading file',
            theirs: '// Error reading file',
            base: '// Error reading file',
          };
        }
      })
    );

    return {
      success: true,
      conflicts,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Resolve a conflict by choosing a side (ours or theirs)
 */
export async function resolveConflict(
  repoPath: string,
  filePath: string,
  choice: 'ours' | 'theirs'
): Promise<{ success: boolean; error?: string }> {
  try {
    const stage = choice === 'ours' ? '--ours' : '--theirs';
    await execAsync(`git checkout ${stage} -- "${filePath}"`, {
      cwd: repoPath,
      maxBuffer: MAX_BUFFER_SIZE,
    });
    await execAsync(`git add "${filePath}"`, { cwd: repoPath });
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMsg };
  }
}

/**
 * Apply manual resolution content to a conflicted file
 */
export async function applyManualResolution(
  repoPath: string,
  filePath: string,
  content: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const fullPath = join(repoPath, filePath);
    await writeFile(fullPath, content, 'utf-8');
    await execAsync(`git add "${filePath}"`, { cwd: repoPath });
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMsg };
  }
}
