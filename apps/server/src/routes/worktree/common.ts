/**
 * Common utilities for worktree routes
 */

import { createLogger } from '@automaker/utils';
import { spawnProcess } from '@automaker/platform';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import * as secureFs from '../../lib/secure-fs.js';
import { copyFile } from 'fs/promises';
import { getErrorMessage as getErrorMessageShared, createLogError } from '../common.js';

const logger = createLogger('Worktree');
export const execAsync = promisify(exec);

// ============================================================================
// Secure Command Execution
// ============================================================================

/**
 * Execute git command with array arguments to prevent command injection.
 * Uses spawnProcess from @automaker/platform for secure, cross-platform execution.
 *
 * @param args - Array of git command arguments (e.g., ['worktree', 'add', path])
 * @param cwd - Working directory to execute the command in
 * @returns Promise resolving to stdout output
 * @throws Error with stderr message if command fails
 *
 * @example
 * ```typescript
 * // Safe: no injection possible
 * await execGitCommand(['branch', '-D', branchName], projectPath);
 *
 * // Instead of unsafe:
 * // await execAsync(`git branch -D ${branchName}`, { cwd });
 * ```
 */
export async function execGitCommand(args: string[], cwd: string): Promise<string> {
  const result = await spawnProcess({
    command: 'git',
    args,
    cwd,
  });

  // spawnProcess returns { stdout, stderr, exitCode }
  if (result.exitCode === 0) {
    return result.stdout;
  } else {
    const errorMessage = result.stderr || `Git command failed with code ${result.exitCode}`;
    throw new Error(errorMessage);
  }
}

// ============================================================================
// Constants
// ============================================================================

/** Maximum allowed length for git branch names */
export const MAX_BRANCH_NAME_LENGTH = 250;

// ============================================================================
// Extended PATH configuration for Electron apps
// ============================================================================

const pathSeparator = process.platform === 'win32' ? ';' : ':';
const additionalPaths: string[] = [];

if (process.platform === 'win32') {
  // Windows paths
  if (process.env.LOCALAPPDATA) {
    additionalPaths.push(`${process.env.LOCALAPPDATA}\\Programs\\Git\\cmd`);
  }
  if (process.env.PROGRAMFILES) {
    additionalPaths.push(`${process.env.PROGRAMFILES}\\Git\\cmd`);
  }
  if (process.env['ProgramFiles(x86)']) {
    additionalPaths.push(`${process.env['ProgramFiles(x86)']}\\Git\\cmd`);
  }
} else {
  // Unix/Mac paths
  additionalPaths.push(
    '/opt/homebrew/bin', // Homebrew on Apple Silicon
    '/usr/local/bin', // Homebrew on Intel Mac, common Linux location
    '/home/linuxbrew/.linuxbrew/bin', // Linuxbrew
    `${process.env.HOME}/.local/bin` // pipx, other user installs
  );
}

const extendedPath = [process.env.PATH, ...additionalPaths.filter(Boolean)]
  .filter(Boolean)
  .join(pathSeparator);

/**
 * Environment variables with extended PATH for executing shell commands.
 * Electron apps don't inherit the user's shell PATH, so we need to add
 * common tool installation locations.
 */
export const execEnv = {
  ...process.env,
  PATH: extendedPath,
};

// ============================================================================
// Validation utilities
// ============================================================================

/**
 * Validate branch name to prevent command injection.
 * Git branch names cannot contain: space, ~, ^, :, ?, *, [, \, or control chars.
 * We also reject shell metacharacters for safety.
 */
export function isValidBranchName(name: string): boolean {
  return /^[a-zA-Z0-9._\-/]+$/.test(name) && name.length < MAX_BRANCH_NAME_LENGTH;
}

/**
 * Check if gh CLI is available on the system
 */
export async function isGhCliAvailable(): Promise<boolean> {
  try {
    const checkCommand = process.platform === 'win32' ? 'where gh' : 'command -v gh';
    await execAsync(checkCommand, { env: execEnv });
    return true;
  } catch {
    return false;
  }
}

export const AUTOMAKER_INITIAL_COMMIT_MESSAGE = 'chore: automaker initial commit';

/**
 * Normalize path separators to forward slashes for cross-platform consistency.
 * This ensures paths from `path.join()` (backslashes on Windows) match paths
 * from git commands (which may use forward slashes).
 */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

/**
 * Check if a git repository has at least one commit (i.e., HEAD exists)
 * Returns false for freshly initialized repos with no commits
 */
export async function hasCommits(repoPath: string): Promise<boolean> {
  try {
    await execAsync('git rev-parse --verify HEAD', { cwd: repoPath });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if an error is ENOENT (file/path not found or spawn failed)
 * These are expected in test environments with mock paths
 */
export function isENOENT(error: unknown): boolean {
  return error !== null && typeof error === 'object' && 'code' in error && error.code === 'ENOENT';
}

/**
 * Check if a path is a mock/test path that doesn't exist
 */
export function isMockPath(worktreePath: string): boolean {
  return worktreePath.startsWith('/mock/') || worktreePath.includes('/mock/');
}

/**
 * Conditionally log worktree errors - suppress ENOENT for mock paths
 * to reduce noise in test output
 */
export function logWorktreeError(error: unknown, message: string, worktreePath?: string): void {
  // Don't log ENOENT errors for mock paths (expected in tests)
  if (isENOENT(error) && worktreePath && isMockPath(worktreePath)) {
    return;
  }
  logError(error, message);
}

// Re-export shared utilities
export { getErrorMessageShared as getErrorMessage };
export const logError = createLogError(logger);

/**
 * Ensure the repository has at least one commit so git commands that rely on HEAD work.
 * Returns true if an empty commit was created, false if the repo already had commits.
 * @param repoPath - Path to the git repository
 * @param env - Optional environment variables to pass to git (e.g., GIT_AUTHOR_NAME, GIT_AUTHOR_EMAIL)
 */
export async function ensureInitialCommit(
  repoPath: string,
  env?: Record<string, string>
): Promise<boolean> {
  try {
    await execAsync('git rev-parse --verify HEAD', { cwd: repoPath });
    return false;
  } catch {
    try {
      await execAsync(`git commit --allow-empty -m "${AUTOMAKER_INITIAL_COMMIT_MESSAGE}"`, {
        cwd: repoPath,
        env: { ...process.env, ...env },
      });
      logger.info(`[Worktree] Created initial empty commit to enable worktrees in ${repoPath}`);
      return true;
    } catch (error) {
      const reason = getErrorMessageShared(error);
      throw new Error(
        `Failed to create initial git commit. Please commit manually and retry. ${reason}`
      );
    }
  }
}

// ============================================================================
// Branch Name Formatting
// ============================================================================

/**
 * Format branch name with template prefix and optional issue number
 * @param template - Branch template prefix (e.g., 'feature/', 'bugfix/')
 * @param branchName - The base branch name
 * @param issueNumber - Optional issue/PR number to include
 * @returns Formatted branch name
 *
 * @example
 * formatBranchName('feature/', 'user-auth', '123') // 'feature/123-user-auth'
 * formatBranchName('bugfix/', 'login-error') // 'bugfix/login-error'
 */
export function formatBranchName(
  template: string,
  branchName: string,
  issueNumber?: string
): string {
  // Ensure template ends with /
  const prefix = template.endsWith('/') ? template : `${template}/`;
  const sanitizedBranch = branchName.trim().replace(/\s+/g, '-');

  if (issueNumber && issueNumber.trim()) {
    return `${prefix}${issueNumber.trim()}-${sanitizedBranch}`;
  }
  return `${prefix}${sanitizedBranch}`;
}

// ============================================================================
// File Copy Utilities for Worktrees
// ============================================================================

/**
 * Copy specified files from main project to worktree
 * @param projectPath - Path to the main project
 * @param worktreePath - Path to the worktree
 * @param fileCopySettings - Settings for which files to copy
 */
export async function copyFilesToWorktree(
  projectPath: string,
  worktreePath: string,
  fileCopySettings: { copyEnvFile?: boolean; customFiles?: string[] } = {}
): Promise<void> {
  const { copyEnvFile = true, customFiles = [] } = fileCopySettings;
  const copiedFiles: string[] = [];

  try {
    // Copy .env file if requested and it exists
    if (copyEnvFile) {
      const envPath = path.join(projectPath, '.env');
      try {
        await secureFs.access(envPath);
        const envDestPath = path.join(worktreePath, '.env');
        await copyFile(envPath, envDestPath);
        copiedFiles.push('.env');
        logger.info(`[Worktree] Copied .env to worktree`);
      } catch {
        // .env doesn't exist, skip silently
      }
    }

    // Copy custom files if specified
    for (const file of customFiles) {
      // Security check: prevent path traversal
      const resolvedFile = path.resolve(projectPath, file);
      if (!resolvedFile.startsWith(projectPath)) {
        logger.warn(`[Worktree] Skipping file outside project path: ${file}`);
        continue;
      }

      try {
        await secureFs.access(resolvedFile);
        const destPath = path.join(worktreePath, path.basename(file));
        await copyFile(resolvedFile, destPath);
        copiedFiles.push(file);
        logger.info(`[Worktree] Copied ${file} to worktree`);
      } catch {
        // File doesn't exist, skip silently
      }
    }

    if (copiedFiles.length > 0) {
      logger.info(
        `[Worktree] Copied ${copiedFiles.length} file(s) to worktree: ${copiedFiles.join(', ')}`
      );
    }
  } catch (error) {
    logger.error(`[Worktree] Error copying files to worktree:`, error);
    // Don't throw - file copy failures shouldn't prevent worktree creation
  }
}

// ============================================================================
// Post-Creation Actions
// ============================================================================

/**
 * Run post-creation actions for a worktree
 * @param worktreePath - Path to the worktree
 * @param actions - Actions to run
 */
export async function runPostCreationActions(
  worktreePath: string,
  actions: { installDependencies?: boolean; runSetupScript?: boolean }
): Promise<void> {
  const { installDependencies = false, runSetupScript: runScript = false } = actions;

  if (!installDependencies && !runScript) {
    return;
  }

  logger.info(`[Worktree] Running post-creation actions for ${worktreePath}`);

  // Detect package manager
  let packageManager: string | null = null;
  if (installDependencies) {
    const managers = ['pnpm', 'yarn', 'npm'];
    for (const manager of managers) {
      try {
        const lockFile = path.join(
          worktreePath,
          manager === 'npm' ? 'package-lock.json' : `${manager}-lock.yaml`
        );
        await secureFs.access(lockFile);
        packageManager = manager;
        break;
      } catch {
        // Check next
      }
    }
    // Fallback: check if package.json exists
    if (!packageManager) {
      try {
        await secureFs.access(path.join(worktreePath, 'package.json'));
        packageManager = 'npm'; // default to npm
      } catch {
        // Not a node project
      }
    }
  }

  // Install dependencies
  if (installDependencies && packageManager) {
    try {
      logger.info(`[Worktree] Installing dependencies with ${packageManager}...`);
      const result = await spawnProcess({
        command: packageManager,
        args: ['install', '--silent'],
        cwd: worktreePath,
      });
      if (result.exitCode === 0) {
        logger.info(`[Worktree] Dependencies installed successfully`);
      } else {
        logger.warn(`[Worktree] Dependency installation failed: ${result.stderr}`);
      }
    } catch (error) {
      logger.error(`[Worktree] Error installing dependencies:`, error);
    }
  }

  // Run setup script - this is handled by the init-script-service
  // The create.ts handler already calls runInitScript, so we just log here
  if (runScript) {
    logger.info(`[Worktree] Setup script will be executed by init-script-service`);
  }
}
