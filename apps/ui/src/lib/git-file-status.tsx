/**
 * Git File Status Utilities
 *
 * Shared utilities for working with git file status indicators.
 */

import { File, FilePen, FilePlus, FileX } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** Git file status codes */
export type GitFileStatusCode = 'A' | 'D' | 'M' | 'U' | 'R' | 'C' | '?' | string;

/**
 * Get the color classes for a file status
 */
export function getFileStatusColor(status: GitFileStatusCode): string {
  const colorMap: Record<string, string> = {
    A: 'text-green-500 bg-green-500/20 border-green-500/30',
    '?': 'text-green-500 bg-green-500/20 border-green-500/30',
    D: 'text-red-500 bg-red-500/20 border-red-500/30',
    M: 'text-amber-500 bg-amber-500/20 border-amber-500/30',
    U: 'text-amber-500 bg-amber-500/20 border-amber-500/30',
    R: 'text-blue-500 bg-blue-500/20 border-blue-500/30',
    C: 'text-blue-500 bg-blue-500/20 border-blue-500/30',
  };
  return colorMap[status] ?? 'text-muted-foreground bg-muted';
}

/**
 * Get the human-readable label for a file status
 */
export function getFileStatusLabel(status: GitFileStatusCode): string {
  const labelMap: Record<string, string> = {
    A: 'Added',
    '?': 'Untracked',
    D: 'Deleted',
    M: 'Modified',
    U: 'Updated',
    R: 'Renamed',
    C: 'Copied',
  };
  return labelMap[status] ?? 'Changed';
}

/**
 * Get the icon component for a file status
 */
export function getFileStatusIcon(status: GitFileStatusCode): LucideIcon {
  const iconMap: Record<string, LucideIcon> = {
    A: FilePlus,
    '?': FilePlus,
    D: FileX,
    M: FilePen,
    U: FilePen,
    R: File,
    C: File,
  };
  return iconMap[status] ?? File;
}

/**
 * Constants for diff preview parsing
 */
export const DIFF_PREVIEW_MAX_LINES = 20;
export const DIFF_PREVIEW_NO_DIFF_MESSAGE = 'No diff available';
export const DIFF_PREVIEW_NO_PREVIEW_MESSAGE = 'No diff preview available';
export const DIFF_PREVIEW_TRUNCATED_MESSAGE = '\n... (truncated)';
