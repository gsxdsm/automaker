/**
 * Shared types for Git Branch Management
 */

/**
 * Branch data from the Git API
 */
export interface GitBranchData {
  name: string;
  current: boolean;
  detached: boolean;
  tracking?: string;
  commit?: string;
  message?: string;
  ahead?: number;
  behind?: number;
  hasUncommittedChanges?: boolean;
  isRemote?: boolean;
}

/**
 * Remote filter options
 */
export type RemoteFilter = 'all' | 'local' | 'remote';

/**
 * Remote filter values as constants
 */
export const REMOTE_FILTERS = {
  ALL: 'all',
  LOCAL: 'local',
  REMOTE: 'remote',
} as const satisfies Record<string, RemoteFilter>;

/**
 * Branch group name constants
 */
export const BRANCH_GROUP_LOCAL = 'local';

/**
 * Get display label for branch group
 */
export function getBranchGroupLabel(groupName: string): string {
  if (groupName === BRANCH_GROUP_LOCAL) return 'Local Branches';
  return groupName.charAt(0).toUpperCase() + groupName.slice(1);
}
