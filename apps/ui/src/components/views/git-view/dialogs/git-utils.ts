/**
 * Git utility functions for dialogs
 */

/**
 * Extract the branch name from a remote branch reference
 * e.g., "origin/main" -> "main"
 */
export function extractRemoteBranchName(remoteBranch: string, remote: string): string {
  return remoteBranch.replace(`${remote}/`, '');
}

/**
 * Format a remote name with URL for display
 */
export function formatRemoteForDisplay(name: string, url?: string): string {
  return url ? `${name} (${url})` : name;
}

/**
 * Validate git remote URL format
 * Supports HTTPS and SSH URLs
 */
export function isValidGitUrl(url: string): boolean {
  if (!url.trim()) return false;

  // HTTPS URL pattern
  const httpsPattern = /^https?:\/\/.+\.git$/;
  // SSH URL pattern (git@github.com:user/repo.git or ssh://git@github.com/user/repo.git)
  // Note: Escape hyphen in character class to avoid range interpretation
  const sshPattern = /^(ssh:\/\/)?[\w-]+@[\w.+\-]+[:/][\w.\-]+\/[\w.\-]+\.git$/;

  return httpsPattern.test(url) || sshPattern.test(url);
}

/**
 * Check if an error message indicates merge conflicts
 */
export function isMergeConflictError(errorMsg: string): boolean {
  const conflictIndicators = ['CONFLICT', 'Merge conflict', 'conflict:', 'content conflict'];
  return conflictIndicators.some((indicator) =>
    errorMsg.toLowerCase().includes(indicator.toLowerCase())
  );
}

/**
 * Sanitize remote name (git remote names have specific rules)
 */
export function sanitizeRemoteName(name: string): string {
  return name.trim().replace(/\s+/g, '-');
}

/**
 * Constants for toast messages
 */
export const GIT_TOAST_MESSAGES = {
  // Success messages
  PULL_SUCCESS: (remote: string) => ({
    title: 'Pull successful',
    description: `Fetched and merged changes from ${remote}`,
  }),
  PUSH_SUCCESS: (branch: string, remote: string) => ({
    title: 'Push successful',
    description: `Pushed ${branch || 'current branch'} to ${remote}`,
  }),
  FETCH_SUCCESS: (remote: string) => ({
    title: 'Fetched from remote',
    description: `Updated references from ${remote}`,
  }),
  REMOTE_ADDED: (name: string) => ({
    title: 'Remote added',
    description: `Added remote "${name}"`,
  }),
  REMOTE_UPDATED: (name: string) => ({
    title: 'Remote updated',
    description: `Updated remote "${name}"`,
  }),
  REMOTE_REMOVED: (name: string) => ({
    title: 'Remote removed',
    description: `Removed remote "${name}"`,
  }),
  TRACKING_CONFIGURED: (branch: string, remoteBranch: string) => ({
    title: 'Branch tracking configured',
    description: `"${branch}" now tracks "${remoteBranch}"`,
  }),

  // Error messages
  PULL_CONFLICTS: {
    title: 'Pull resulted in merge conflicts',
    description: 'Please resolve conflicts before continuing',
  },
  PULL_FAILED: (error: string) => ({
    title: 'Failed to pull changes',
    description: error,
  }),
  PUSH_FAILED: (error: string) => ({
    title: 'Failed to push changes',
    description: error,
  }),
  FETCH_FAILED: (error: string) => ({
    title: 'Failed to fetch',
    description: error,
  }),
  REMOTE_SAVE_FAILED: (error: string) => ({
    title: 'Failed to save remote',
    description: error,
  }),
  REMOTE_REMOVE_FAILED: (error: string) => ({
    title: 'Failed to remove remote',
    description: error,
  }),
  REMOTE_EXISTS: (name: string) => ({
    title: 'Remote already exists',
    description: `A remote named "${name}" already exists`,
  }),
  TRACKING_FAILED: (error: string) => ({
    title: 'Failed to set branch tracking',
    description: error,
  }),
  VALIDATION_ERROR_REQUIRED: 'Name and URL are required',
  VALIDATION_ERROR_INVALID_URL: 'Please enter a valid Git URL (HTTPS or SSH)',
  VALIDATION_ERROR_SELECT_REMOTE: 'Please select a remote',
  VALIDATION_ERROR_SELECT_BRANCHES: 'Please select both a remote and a branch',
} as const;
