/**
 * SplitDiffViewer Component
 *
 * A comprehensive diff viewer component supporting:
 * - Unified and side-by-side diff modes
 * - Syntax highlighting for code
 * - Line numbers
 * - Expand/collapse unchanged regions
 * - Navigation between changes
 * - Mobile-optimized with swipe gestures
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  GitCommit,
  ArrowLeft,
  ArrowRight,
  Columns,
  FileText,
  X,
  Copy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { SplitDiffPane } from './split-diff-pane';
import {
  parseUnifiedDiff,
  convertToSideBySide,
  type DiffFile,
  type DiffHunk,
  type DiffLine,
  type DiffViewMode,
  type ParsedDiff,
  type DiffPosition,
} from '@/lib/diff-parser';
import { useDiffViewer } from '@/hooks/use-diff-viewer';
import { toast } from 'sonner';

// Constants for gesture detection
const SWIPE_THRESHOLD = 50;

export interface SplitDiffViewerProps {
  /** The diff content in unified format */
  diff: string;
  /** Optional parsed diff data (to avoid re-parsing) */
  parsedDiff?: ParsedDiff;
  /** Initial view mode */
  initialMode?: DiffViewMode;
  /** Whether to show the header */
  showHeader?: boolean;
  /** Optional CSS class name */
  className?: string;
  /** Callback when diff is copied */
  onCopy?: (diff: string) => void;
  /** Repository path (for syntax highlighting) */
  repoPath?: string;
  /** Commit hash (for display) */
  commitHash?: string;
  /** Commit message (for display) */
  commitMessage?: string;
}

export function SplitDiffViewer({
  diff,
  parsedDiff: externalParsedDiff,
  initialMode = 'unified',
  showHeader = true,
  className,
  onCopy,
  repoPath,
  commitHash,
  commitMessage,
}: SplitDiffViewerProps) {
  // Parse diff
  const parsedDiff = useMemo(() => {
    return externalParsedDiff || parseUnifiedDiff(diff);
  }, [diff, externalParsedDiff]);

  // Use diff viewer hook
  const {
    viewMode,
    expandedFiles,
    expandedHunks,
    currentPosition,
    currentFile,
    totalChanges,
    currentChangeIndex,
    toggleFile,
    toggleHunk,
    expandAllFiles,
    collapseAllFiles,
    toggleViewMode,
    goToNextChange,
    goToPreviousChange,
    setCurrentPosition,
  } = useDiffViewer(parsedDiff, { initialMode });

  // Swipe gesture state for mobile
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  // Handle touch start for swipe gestures
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  // Handle touch end for swipe gestures
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const deltaX = e.changedTouches[0].clientX - touchStartX.current;
      const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartY.current);

      // Only handle horizontal swipes that exceed threshold
      if (Math.abs(deltaX) > SWIPE_THRESHOLD && Math.abs(deltaX) > deltaY) {
        if (!currentFile) return;

        const currentIndex = parsedDiff.files.findIndex((f) => f.newPath === currentFile.newPath);

        if (deltaX > 0 && currentIndex > 0) {
          // Swipe right - go to previous file
          const prevFile = parsedDiff.files[currentIndex - 1];
          toggleFile(prevFile.newPath);
          setCurrentPosition({
            fileIndex: currentIndex - 1,
            hunkIndex: 0,
            lineIndex: 0,
          });
        } else if (deltaX < 0 && currentIndex < parsedDiff.files.length - 1) {
          // Swipe left - go to next file
          const nextFile = parsedDiff.files[currentIndex + 1];
          toggleFile(nextFile.newPath);
          setCurrentPosition({
            fileIndex: currentIndex + 1,
            hunkIndex: 0,
            lineIndex: 0,
          });
        }
      }
    },
    [currentFile, parsedDiff.files, toggleFile, setCurrentPosition]
  );

  // Handle copy diff
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(diff);
    toast.success('Diff copied to clipboard');
    onCopy?.(diff);
  }, [diff, onCopy]);

  // Check if a line is the current active line
  const isLineActive = useCallback(
    (fileIndex: number, hunkIndex: number, lineIndex: number) => {
      return (
        currentPosition &&
        currentPosition.fileIndex === fileIndex &&
        currentPosition.hunkIndex === hunkIndex &&
        currentPosition.lineIndex === lineIndex
      );
    },
    [currentPosition]
  );

  // Handle line click
  const handleLineClick = useCallback(
    (fileIndex: number, hunkIndex: number, line: DiffLine, lineIndex: number) => {
      setCurrentPosition({ fileIndex, hunkIndex, lineIndex });
    },
    [setCurrentPosition]
  );

  if (parsedDiff.files.length === 0) {
    return (
      <div className={cn('h-full flex items-center justify-center', className)}>
        <div className="text-center text-muted-foreground">
          <GitCommit className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-sm">No diff to display</p>
          <p className="text-xs mt-1">This commit may not have any file changes</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn('h-full flex flex-col bg-background', className)}
      data-testid="split-diff-viewer"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      {showHeader && (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/20 shrink-0">
          <GitCommit className="h-4 w-4 text-brand-500 shrink-0" />
          {commitHash && (
            <span className="font-mono text-sm text-muted-foreground">
              {commitHash.slice(0, 8)}
            </span>
          )}
          {commitMessage && <span className="flex-1 text-sm truncate">{commitMessage}</span>}
          <div className="flex items-center gap-2">
            {/* Navigation */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={goToPreviousChange}
              disabled={currentChangeIndex <= 0}
              title="Previous change"
              data-testid="previous-change-button"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground min-w-[60px] text-center">
              {totalChanges > 0 ? currentChangeIndex + 1 : 0} / {totalChanges}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={goToNextChange}
              disabled={currentChangeIndex >= totalChanges - 1}
              title="Next change"
              data-testid="next-change-button"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>

            {/* View mode toggle */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 gap-1.5"
              onClick={toggleViewMode}
              title={`Switch to ${viewMode === 'unified' ? 'side-by-side' : 'unified'} view`}
              data-testid="view-mode-toggle"
            >
              <Columns className="h-3.5 w-3.5" />
              <span className="text-xs">{viewMode === 'unified' ? 'Split' : 'Unified'}</span>
            </Button>

            {/* Expand/collapse all */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={expandAllFiles}
              title="Expand all files"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={collapseAllFiles}
              title="Collapse all files"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>

            {/* Copy */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 gap-1.5"
              onClick={handleCopy}
              title="Copy diff"
            >
              <Copy className="h-3.5 w-3.5" />
              <span className="text-xs">Copy</span>
            </Button>
          </div>
        </div>
      )}

      {/* Diff content */}
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-border">
          {parsedDiff.files.map((file, fileIndex) => {
            const isExpanded = expandedFiles.has(file.newPath);
            const fileHunks = expandedHunks.get(file.newPath) || new Set<number>();

            return (
              <div
                key={file.newPath}
                className="border border-border rounded-lg overflow-hidden m-2"
                data-testid={`diff-file-${fileIndex}`}
              >
                {/* File header */}
                <button
                  onClick={() => toggleFile(file.newPath)}
                  className="w-full px-3 py-2 flex items-center gap-2 text-left bg-card hover:bg-accent/50 transition-colors"
                  data-testid={`diff-file-header-${fileIndex}`}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 text-sm font-mono truncate text-foreground">
                    {file.newPath}
                  </span>
                  {file.isNew && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                      new
                    </span>
                  )}
                  {file.isDeleted && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                      deleted
                    </span>
                  )}
                  {file.isRenamed && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                      renamed
                    </span>
                  )}
                  {file.additions > 0 && (
                    <span className="text-xs text-green-400">+{file.additions}</span>
                  )}
                  {file.deletions > 0 && (
                    <span className="text-xs text-red-400">-{file.deletions}</span>
                  )}
                </button>

                {/* File content */}
                {isExpanded && (
                  <div
                    className={cn(
                      'bg-background',
                      viewMode === 'split' ? 'grid grid-cols-2 divide-x divide-border' : ''
                    )}
                  >
                    {file.hunks.map((hunk, hunkIndex) => {
                      const isHunkExpanded = fileHunks.has(hunkIndex);
                      const sideBySide = convertToSideBySide(hunk);

                      return (
                        <div key={hunkIndex}>
                          {/* Hunk header */}
                          <button
                            onClick={() => toggleHunk(file.newPath, hunkIndex)}
                            className="w-full px-3 py-1 flex items-center gap-2 text-left bg-muted/30 hover:bg-muted/50 transition-colors text-xs"
                            data-testid={`diff-hunk-header-${fileIndex}-${hunkIndex}`}
                          >
                            {isHunkExpanded ? (
                              <ChevronDown className="w-3 h-3 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="w-3 h-3 text-muted-foreground" />
                            )}
                            <span className="font-mono text-muted-foreground">{hunk.header}</span>
                          </button>

                          {/* Hunk content */}
                          {isHunkExpanded && (
                            <div
                              className={cn(
                                viewMode === 'split'
                                  ? 'grid grid-cols-2 divide-x divide-border'
                                  : ''
                              )}
                            >
                              {viewMode === 'unified' ? (
                                <SplitDiffPane
                                  lines={hunk.lines}
                                  language={file.language}
                                  showLineNumbers
                                  onLineClick={(line, lineIndex) =>
                                    handleLineClick(fileIndex, hunkIndex, line, lineIndex)
                                  }
                                  activeLineIndex={
                                    currentPosition?.fileIndex === fileIndex &&
                                    currentPosition?.hunkIndex === hunkIndex
                                      ? currentPosition.lineIndex
                                      : undefined
                                  }
                                />
                              ) : (
                                <>
                                  {/* Left pane (old) - deletions and context */}
                                  <SplitDiffPane
                                    lines={sideBySide.leftLines}
                                    side="left"
                                    language={file.language}
                                    showLineNumbers
                                    onLineClick={(line, lineIndex) =>
                                      handleLineClick(fileIndex, hunkIndex, line, lineIndex)
                                    }
                                    activeLineIndex={
                                      currentPosition?.fileIndex === fileIndex &&
                                      currentPosition?.hunkIndex === hunkIndex
                                        ? currentPosition.lineIndex
                                        : undefined
                                    }
                                  />
                                  {/* Right pane (new) - additions and context */}
                                  <SplitDiffPane
                                    lines={sideBySide.rightLines}
                                    side="right"
                                    language={file.language}
                                    showLineNumbers
                                    onLineClick={(line, lineIndex) =>
                                      handleLineClick(fileIndex, hunkIndex, line, lineIndex)
                                    }
                                    activeLineIndex={
                                      currentPosition?.fileIndex === fileIndex &&
                                      currentPosition?.hunkIndex === hunkIndex
                                        ? currentPosition.lineIndex
                                        : undefined
                                    }
                                  />
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
