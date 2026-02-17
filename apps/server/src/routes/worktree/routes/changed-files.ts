/**
 * POST /changed-files endpoint - Get list of changed files in a worktree with their status
 *
 * Returns detailed file status information including the git status code
 * for each file (modified, added, deleted, untracked, etc.)
 */

import type { Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getErrorMessage, logError } from '../common.js';

const execAsync = promisify(exec);

export interface ChangedFile {
  /** The file path relative to the worktree root */
  path: string;
  /** Git status code (M=modified, A=added, D=deleted, ??=untracked, R=renamed, etc.) */
  status: string;
  /** Human-readable status label */
  statusLabel: string;
}

function getStatusLabel(status: string): string {
  switch (status.trim()) {
    case 'M':
      return 'Modified';
    case 'A':
      return 'Added';
    case 'D':
      return 'Deleted';
    case '??':
      return 'Untracked';
    case 'R':
      return 'Renamed';
    case 'C':
      return 'Copied';
    case 'U':
      return 'Unmerged';
    case 'MM':
      return 'Modified (staged & unstaged)';
    case 'AM':
      return 'Added & Modified';
    default:
      return 'Changed';
  }
}

export function createChangedFilesHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { worktreePath } = req.body as {
        worktreePath: string;
      };

      if (!worktreePath) {
        res.status(400).json({
          success: false,
          error: 'worktreePath required',
        });
        return;
      }

      const { stdout: status } = await execAsync('git status --porcelain', {
        cwd: worktreePath,
      });

      if (!status.trim()) {
        res.json({
          success: true,
          files: [],
        });
        return;
      }

      const files: ChangedFile[] = status
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          // Git status --porcelain format: XY filename
          // First two characters are the status, then a space, then the filename
          const statusCode = line.substring(0, 2).trim();
          let filePath = line.substring(3);

          // Handle renamed files: "R  old -> new"
          if (statusCode.startsWith('R') && filePath.includes(' -> ')) {
            filePath = filePath.split(' -> ')[1];
          }

          return {
            path: filePath,
            status: statusCode,
            statusLabel: getStatusLabel(statusCode),
          };
        });

      res.json({
        success: true,
        files,
      });
    } catch (error) {
      logError(error, 'Get changed files failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
