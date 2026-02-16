/**
 * Shared types for git view components
 */

export interface StashEntry {
  index: number;
  ref: string;
  hash: string;
  message: string;
}
