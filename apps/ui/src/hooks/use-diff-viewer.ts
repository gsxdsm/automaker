/**
 * useDiffViewer Hook
 *
 * React hook for managing diff viewing state including:
 * - Diff view mode (unified vs split)
 * - File expansion state
 * - Current position/navigation
 * - Collapsed regions
 */

import { useState, useCallback, useMemo } from 'react';
import type { DiffFile, DiffHunk, DiffViewMode, ParsedDiff } from '@/lib/diff-parser';
import {
  findNextChange,
  findPreviousChange,
  findFirstChange,
  findLastChange,
  isChangeLine,
} from '@/lib/diff-parser';

export interface DiffPosition {
  fileIndex: number;
  hunkIndex: number;
  lineIndex: number;
}

export interface DiffComment {
  id: string;
  fileIndex: number;
  hunkIndex: number;
  lineIndex: number;
  content: string;
  author: string;
  timestamp: Date;
}

export interface UseDiffViewerOptions {
  /** Initial diff view mode */
  initialMode?: DiffViewMode;
  /** Number of context lines to show when collapsing */
  contextLines?: number;
  /** Whether to collapse unchanged regions by default */
  collapseByDefault?: boolean;
}

export function useDiffViewer(diff: ParsedDiff | null, options: UseDiffViewerOptions = {}) {
  const {
    initialMode = 'unified',
    // Note: contextLines and collapseByDefault are reserved for future use
    // with the collapseUnchangedRegions function
    contextLines = 3,
    collapseByDefault = false,
  } = options;

  // View mode
  const [viewMode, setViewMode] = useState<DiffViewMode>(initialMode);

  // Expanded files state (set of file paths that are expanded)
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  // Expanded hunks state (map of file path -> set of hunk indices)
  const [expandedHunks, setExpandedHunks] = useState<Map<string, Set<number>>>(new Map());

  // Current position for navigation
  const [currentPosition, setCurrentPosition] = useState<DiffPosition | null>(null);

  // Comments state
  const [comments, setComments] = useState<DiffComment[]>([]);

  /**
   * Helper function to expand a file and hunk
   */
  const expandFileAndHunk = useCallback(
    (fileIndex: number, hunkIndex: number) => {
      if (!diff) return;
      const file = diff.files[fileIndex];
      const filePath = file.newPath;

      setExpandedFiles((existing) => {
        const next = new Set(existing);
        next.add(filePath);
        return next;
      });

      setExpandedHunks((existing) => {
        const next = new Map(existing);
        const fileHunks = next.get(filePath) || new Set<number>();
        fileHunks.add(hunkIndex);
        next.set(filePath, fileHunks);
        return next;
      });
    },
    [diff]
  );

  /**
   * Toggle a file's expanded state
   */
  const toggleFile = useCallback((filePath: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  }, []);

  /**
   * Toggle a hunk's expanded state
   */
  const toggleHunk = useCallback((filePath: string, hunkIndex: number) => {
    setExpandedHunks((prev) => {
      const next = new Map(prev);
      const fileHunks = next.get(filePath) || new Set<number>();
      if (fileHunks.has(hunkIndex)) {
        fileHunks.delete(hunkIndex);
      } else {
        fileHunks.add(hunkIndex);
      }
      next.set(filePath, fileHunks);
      return next;
    });
  }, []);

  /**
   * Expand all files
   */
  const expandAllFiles = useCallback(() => {
    if (!diff) return;
    setExpandedFiles(new Set(diff.files.map((f) => f.newPath)));
  }, [diff]);

  /**
   * Collapse all files
   */
  const collapseAllFiles = useCallback(() => {
    setExpandedFiles(new Set());
  }, []);

  /**
   * Expand all hunks for a file
   */
  const expandAllHunks = useCallback(
    (filePath: string) => {
      if (!diff) return;
      const file = diff.files.find((f) => f.newPath === filePath);
      if (!file) return;

      setExpandedHunks((prev) => {
        const next = new Map(prev);
        const allHunks = new Set(file.hunks.map((_, i) => i));
        next.set(filePath, allHunks);
        return next;
      });
    },
    [diff]
  );

  /**
   * Collapse all hunks for a file
   */
  const collapseAllHunks = useCallback((filePath: string) => {
    setExpandedHunks((prev) => {
      const next = new Map(prev);
      next.delete(filePath);
      return next;
    });
  }, []);

  /**
   * Toggle view mode
   */
  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => (prev === 'unified' ? 'split' : 'unified'));
  }, []);

  /**
   * Navigate to next change
   */
  const goToNextChange = useCallback(() => {
    if (!diff) return null;

    let next;

    if (currentPosition) {
      next = findNextChange(
        diff.files,
        currentPosition.fileIndex,
        currentPosition.hunkIndex,
        currentPosition.lineIndex
      );
    } else {
      // Start from the beginning if no position set
      next = findFirstChange(diff.files);
    }

    if (next) {
      setCurrentPosition(next);
      expandFileAndHunk(next.fileIndex, next.hunkIndex);
      return next;
    }

    // Wrap around to beginning
    const wrapped = findFirstChange(diff.files);
    if (wrapped) {
      setCurrentPosition(wrapped);
      expandFileAndHunk(wrapped.fileIndex, wrapped.hunkIndex);
      return wrapped;
    }

    return null;
  }, [diff, currentPosition, expandFileAndHunk]);

  /**
   * Navigate to previous change
   */
  const goToPreviousChange = useCallback(() => {
    if (!diff) return null;

    let prev;

    if (currentPosition) {
      prev = findPreviousChange(
        diff.files,
        currentPosition.fileIndex,
        currentPosition.hunkIndex,
        currentPosition.lineIndex
      );
    } else {
      // Start from the end if no position set
      prev = findLastChange(diff.files);
    }

    if (prev) {
      setCurrentPosition(prev);
      expandFileAndHunk(prev.fileIndex, prev.hunkIndex);
      return prev;
    }

    // Wrap around to end
    const wrapped = findLastChange(diff.files);
    if (wrapped) {
      setCurrentPosition(wrapped);
      expandFileAndHunk(wrapped.fileIndex, wrapped.hunkIndex);
      return wrapped;
    }

    return null;
  }, [diff, currentPosition, expandFileAndHunk]);

  /**
   * Add a comment
   */
  const addComment = useCallback(
    (fileIndex: number, hunkIndex: number, lineIndex: number, content: string, author: string) => {
      const newComment: DiffComment = {
        id: `${fileIndex}-${hunkIndex}-${lineIndex}-${Date.now()}`,
        fileIndex,
        hunkIndex,
        lineIndex,
        content,
        author,
        timestamp: new Date(),
      };
      setComments((prev) => [...prev, newComment]);
      return newComment;
    },
    []
  );

  /**
   * Delete a comment
   */
  const deleteComment = useCallback((commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  }, []);

  /**
   * Get comments for a specific line
   */
  const getCommentsForLine = useCallback(
    (fileIndex: number, hunkIndex: number, lineIndex: number) => {
      return comments.filter(
        (c) => c.fileIndex === fileIndex && c.hunkIndex === hunkIndex && c.lineIndex === lineIndex
      );
    },
    [comments]
  );

  /**
   * Get current file
   */
  const currentFile = useMemo(() => {
    if (!diff || !currentPosition) return null;
    return diff.files[currentPosition.fileIndex] || null;
  }, [diff, currentPosition]);

  /**
   * Get current hunk
   */
  const currentHunk = useMemo(() => {
    if (!currentFile || !currentPosition) return null;
    return currentFile.hunks[currentPosition.hunkIndex] || null;
  }, [currentFile, currentPosition]);

  /**
   * Count total changes
   */
  const totalChanges = useMemo(() => {
    if (!diff) return 0;
    return diff.files.reduce(
      (sum, file) =>
        sum +
        file.hunks.reduce((hunkSum, hunk) => hunkSum + hunk.lines.filter(isChangeLine).length, 0),
      0
    );
  }, [diff]);

  /**
   * Get change index of current position
   */
  const currentChangeIndex = useMemo(() => {
    if (!diff || !currentPosition) return -1;

    let count = 0;
    for (let f = 0; f < currentPosition.fileIndex; f++) {
      const file = diff.files[f];
      for (const hunk of file.hunks) {
        count += hunk.lines.filter(isChangeLine).length;
      }
    }

    const currentFile = diff.files[currentPosition.fileIndex];
    for (let h = 0; h < currentPosition.hunkIndex; h++) {
      const hunk = currentFile.hunks[h];
      count += hunk.lines.filter(isChangeLine).length;
    }

    const currentHunk = currentFile.hunks[currentPosition.hunkIndex];
    for (let i = 0; i < currentPosition.lineIndex; i++) {
      if (isChangeLine(currentHunk.lines[i])) {
        count++;
      }
    }

    return count;
  }, [diff, currentPosition]);

  return {
    // State
    viewMode,
    expandedFiles,
    expandedHunks,
    currentPosition,
    comments,
    currentFile,
    currentHunk,
    totalChanges,
    currentChangeIndex,

    // Actions
    setViewMode,
    toggleFile,
    toggleHunk,
    expandAllFiles,
    collapseAllFiles,
    expandAllHunks,
    collapseAllHunks,
    toggleViewMode,
    goToNextChange,
    goToPreviousChange,
    addComment,
    deleteComment,
    getCommentsForLine,
    setCurrentPosition,
  };
}
