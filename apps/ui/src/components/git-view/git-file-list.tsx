/**
 * Git File List with Keyboard Shortcuts
 *
 * Displays git status files with keyboard navigation support.
 * Supports staging/unstaging files, viewing diffs, and navigation.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  File,
  FileDiff,
  FilePlus,
  GitPullRequest,
  XCircle,
  CheckCircle2,
  FileIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useGitKeyboardShortcutsStore } from '@/store/git-keyboard-shortcuts-store';
import type { KeyboardMode } from '@/lib/git-keyboard-shortcuts';

export interface GitFile {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
  staged: boolean;
  oldPath?: string; // For renamed files
}

interface GitFileListProps {
  files: GitFile[];
  onStageToggle: (file: GitFile) => void;
  onViewDiff: (file: GitFile) => void;
  mode?: KeyboardMode;
  disabled?: boolean;
  emptyMessage?: string;
  /** Unique identifier for this file list instance to prevent state conflicts */
  listId?: string;
}

// Default timeout for double-key sequences in vim mode (ms)
const VIM_DOUBLE_KEY_TIMEOUT = 500;

// Status icons and colors
const STATUS_CONFIG = {
  modified: {
    icon: FileDiff,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    label: 'M',
  },
  added: {
    icon: FilePlus,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    label: 'A',
  },
  deleted: {
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    label: 'D',
  },
  renamed: {
    icon: GitPullRequest,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    label: 'R',
  },
  untracked: {
    icon: File,
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/10',
    label: 'U',
  },
};

export function GitFileList({
  files,
  onStageToggle,
  onViewDiff,
  mode = 'standard',
  disabled = false,
  emptyMessage = 'No changes',
  listId = 'default',
}: GitFileListProps) {
  // Local selection state to avoid conflicts when multiple file lists exist
  const [localSelectedIndex, setLocalSelectedIndex] = useState(-1);
  const lastKeyRef = useRef<string | null>(null);
  const lastKeyTimeRef = useRef<number>(0);

  // Use displayed files directly from props
  const displayedFiles = files;

  // Handle file click
  const handleFileClick = useCallback(
    (index: number, file: GitFile) => {
      if (disabled) return;
      setLocalSelectedIndex(index);
      onViewDiff(file);
    },
    [disabled, onViewDiff]
  );

  // Handle stage toggle
  const handleStageToggle = useCallback(
    (file: GitFile, event?: React.MouseEvent) => {
      if (disabled) return;
      event?.stopPropagation();
      onStageToggle(file);
    },
    [disabled, onStageToggle]
  );

  // Handle keyboard navigation
  const handleNavigateUp = useCallback(() => {
    if (disabled) return;
    setLocalSelectedIndex((prev) => Math.max(-1, prev - 1));
  }, [disabled]);

  const handleNavigateDown = useCallback(() => {
    if (disabled) return;
    setLocalSelectedIndex((prev) => Math.min(displayedFiles.length - 1, prev + 1));
  }, [disabled, displayedFiles.length]);

  const handleGotoTop = useCallback(() => {
    if (disabled) return;
    setLocalSelectedIndex(0);
  }, [disabled]);

  const handleGotoBottom = useCallback(() => {
    if (disabled) return;
    setLocalSelectedIndex(displayedFiles.length - 1);
  }, [disabled, displayedFiles.length]);

  // Handle stage/unstage for selected file
  const handleStageToggleSelected = useCallback(() => {
    if (disabled || localSelectedIndex < 0 || localSelectedIndex >= displayedFiles.length) {
      return;
    }
    handleStageToggle(displayedFiles[localSelectedIndex]);
  }, [disabled, localSelectedIndex, displayedFiles, handleStageToggle]);

  // Handle view diff for selected file
  const handleViewDiffSelected = useCallback(() => {
    if (disabled || localSelectedIndex < 0 || localSelectedIndex >= displayedFiles.length) {
      return;
    }
    onViewDiff(displayedFiles[localSelectedIndex]);
  }, [disabled, localSelectedIndex, displayedFiles, onViewDiff]);

  // Reset selection when files change significantly
  useEffect(() => {
    setLocalSelectedIndex(-1);
  }, [files.length, listId]);

  // Register keyboard shortcuts
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if in input
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        return;
      }

      // Handle vim double-key sequences (gg for goto bottom)
      if (mode === 'vim' && e.key === 'g') {
        const now = Date.now();
        const isDoubleKey =
          lastKeyRef.current === 'g' && now - lastKeyTimeRef.current < VIM_DOUBLE_KEY_TIMEOUT;

        lastKeyRef.current = 'g';
        lastKeyTimeRef.current = now;

        if (isDoubleKey) {
          e.preventDefault();
          handleGotoBottom();
          lastKeyRef.current = null;
          lastKeyTimeRef.current = 0;
          return;
        }
        // Wait to see if second 'g' is pressed
        return;
      }

      // Handle G (Shift+g) for goto top
      if (mode === 'vim' && e.key === 'G') {
        e.preventDefault();
        handleGotoTop();
        return;
      }

      // Standard mode: arrow keys for navigation
      if (mode === 'standard') {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          handleNavigateUp();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          handleNavigateDown();
        } else if (e.key === ' ') {
          e.preventDefault();
          handleStageToggleSelected();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          handleViewDiffSelected();
        }
      }
      // Vim mode
      else if (mode === 'vim') {
        if (e.key === 'k') {
          e.preventDefault();
          handleNavigateUp();
        } else if (e.key === 'j') {
          e.preventDefault();
          handleNavigateDown();
        } else if (e.key === 's') {
          e.preventDefault();
          handleStageToggleSelected();
        } else if (e.key === 'd') {
          e.preventDefault();
          handleViewDiffSelected();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    disabled,
    mode,
    handleNavigateUp,
    handleNavigateDown,
    handleGotoTop,
    handleGotoBottom,
    handleStageToggleSelected,
    handleViewDiffSelected,
  ]);

  // Empty state
  if (displayedFiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileIcon className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Keyboard hints */}
      {!disabled && (
        <div className="flex items-center gap-3 px-3 py-2 text-xs text-muted-foreground border-b border-border bg-muted/20">
          {mode === 'standard' ? (
            <>
              <span>
                <kbd className="px-1.5 py-0.5 bg-background border border-border rounded font-mono">
                  ↑↓
                </kbd>{' '}
                Navigate
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-background border border-border rounded font-mono">
                  Space
                </kbd>{' '}
                Stage
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-background border border-border rounded font-mono">
                  Enter
                </kbd>{' '}
                Diff
              </span>
            </>
          ) : (
            <>
              <span>
                <kbd className="px-1.5 py-0.5 bg-background border border-border rounded font-mono">
                  jk
                </kbd>{' '}
                Navigate
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-background border border-border rounded font-mono">
                  s
                </kbd>{' '}
                Stage
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-background border border-border rounded font-mono">
                  d
                </kbd>{' '}
                Diff
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-background border border-border rounded font-mono">
                  gg
                </kbd>{' '}
                Bottom
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-background border border-border rounded font-mono">
                  G
                </kbd>{' '}
                Top
              </span>
            </>
          )}
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {displayedFiles.map((file, index) => {
          const status = STATUS_CONFIG[file.status];
          const StatusIcon = status.icon;
          const isSelected = index === localSelectedIndex;

          return (
            <div
              key={file.path}
              className={cn(
                'flex items-center gap-2 px-3 py-2 border-b border-border transition-colors cursor-pointer group',
                isSelected && 'bg-accent/50',
                !disabled && 'hover:bg-accent/30'
              )}
              onClick={() => handleFileClick(index, file)}
            >
              {/* Status indicator */}
              <div
                className={cn(
                  'flex items-center justify-center w-6 h-6 rounded text-xs font-semibold',
                  status.bgColor,
                  status.color
                )}
                title={file.status}
              >
                <StatusIcon className="h-3.5 w-3.5" />
              </div>

              {/* File path */}
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    'text-sm truncate',
                    file.staged ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {file.path}
                </p>
                {file.oldPath && (
                  <p className="text-xs text-muted-foreground truncate">was: {file.oldPath}</p>
                )}
              </div>

              {/* Stage status */}
              {file.staged && <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />}

              {/* Stage toggle button */}
              {!disabled && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => handleStageToggle(file, e)}
                  title={file.staged ? 'Unstage' : 'Stage'}
                >
                  {file.staged ? (
                    <XCircle className="h-3.5 w-3.5" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
