/**
 * Diff Parser Utilities
 *
 * Utilities for parsing unified and side-by-side git diffs into structured data
 * for rendering in the split diff viewer.
 */

// Constants for diff parsing
const DIFF_PREFIX_LENGTH = 'diff --git a/'.length;
const RENAME_FROM_PREFIX = 'rename from'.length;
const RENAME_TO_PREFIX = 'rename to'.length;
const COPY_FROM_PREFIX = 'copy from'.length;
const COPY_TO_PREFIX = 'copy to'.length;
const COLLAPSED_INDICATOR = '...';
const DEFAULT_CONTEXT_LINES = 3;

/**
 * Represents a single line in a diff
 */
export interface DiffLine {
  /** Line number in the old file (undefined for added lines) */
  oldLineNumber?: number;
  /** Line number in the new file (undefined for deleted lines) */
  newLineNumber?: number;
  /** The type of change this line represents */
  type: 'context' | 'addition' | 'deletion' | 'header';
  /** The content of the line (without the +/– prefix) */
  content: string;
  /** Whether this line is part of a collapsed unchanged region */
  isCollapsed?: boolean;
}

/**
 * Represents a hunk of changes in a diff
 */
export interface DiffHunk {
  /** Starting line number in the old file */
  oldStart: number;
  /** Number of lines in the old file */
  oldLines: number;
  /** Starting line number in the new file */
  newStart: number;
  /** Number of lines in the new file */
  newLines: number;
  /** Header line (e.g., "@@ -10,5 +10,7 @@") */
  header: string;
  /** Lines in this hunk */
  lines: DiffLine[];
  /** Context before this hunk (for collapsing) */
  contextBefore?: DiffLine[];
  /** Context after this hunk (for collapsing) */
  contextAfter?: DiffLine[];
}

/**
 * Represents a file in a diff
 */
export interface DiffFile {
  /** Path to the file (new version) */
  newPath: string;
  /** Path to the file (old version) */
  oldPath: string;
  /** Whether this is a new file */
  isNew: boolean;
  /** Whether this file was deleted */
  isDeleted: boolean;
  /** Whether this file was renamed */
  isRenamed: boolean;
  /** Whether this file was copied */
  isCopied: boolean;
  /** Mode change (e.g., "100644" to "100755") */
  oldMode?: string;
  newMode?: string;
  /** Hunks in this file */
  hunks: DiffHunk[];
  /** Total number of additions */
  additions: number;
  /** Total number of deletions */
  deletions: number;
  /** Language for syntax highlighting (detected from file extension) */
  language: string;
}

/**
 * Represents a fully parsed diff
 */
export interface ParsedDiff {
  /** Files in the diff */
  files: DiffFile[];
  /** Total number of additions across all files */
  totalAdditions: number;
  /** Total number of deletions across all files */
  totalDeletions: number;
}

/**
 * Diff view mode
 */
export type DiffViewMode = 'unified' | 'split';

/**
 * Create a partial DiffFile with default values
 */
function createDefaultFile(oldPath = 'unknown', newPath = 'unknown'): Partial<DiffFile> {
  return {
    oldPath,
    newPath,
    isNew: false,
    isDeleted: false,
    isRenamed: false,
    isCopied: false,
    hunks: [],
    additions: 0,
    deletions: 0,
    language: '',
  };
}

/**
 * Check if a line represents an actual change (not context)
 */
export function isChangeLine(line: DiffLine): boolean {
  return line.type === 'addition' || line.type === 'deletion';
}

/**
 * Parse a unified git diff into structured data
 */
export function parseUnifiedDiff(diffText: string): ParsedDiff {
  const files: DiffFile[] = [];
  const lines = diffText.split('\n');

  let currentFile: Partial<DiffFile> | null = null;
  let currentHunk: Partial<DiffHunk> | null = null;
  let currentLines: DiffLine[] = [];
  let oldLineNum = 0;
  let newLineNum = 0;
  let fileAdditions = 0;
  let fileDeletions = 0;

  const finishHunk = () => {
    if (currentHunk && currentFile) {
      currentHunk.lines = currentLines;
      if (!currentFile.hunks) {
        currentFile.hunks = [];
      }
      currentFile.hunks.push(currentHunk as DiffHunk);
      currentHunk = null;
      currentLines = [];
    }
  };

  const finishFile = () => {
    finishHunk();
    if (currentFile) {
      currentFile.additions = fileAdditions;
      currentFile.deletions = fileDeletions;
      if (!currentFile.newPath) {
        currentFile.newPath = currentFile.oldPath || '';
      }
      if (!currentFile.oldPath) {
        currentFile.oldPath = currentFile.newPath;
      }
      // Detect language for syntax highlighting
      currentFile.language = detectLanguage(currentFile.newPath || '');
      files.push(currentFile as DiffFile);
      currentFile = null;
      fileAdditions = 0;
      fileDeletions = 0;
    }
  };

  for (const line of lines) {
    // New file diff
    if (line.startsWith('diff --git')) {
      finishFile();
      const match = line.match(/diff --git a\/(.*?) b\/(.*)/);
      currentFile = createDefaultFile(match ? match[1] : undefined, match ? match[2] : undefined);
      continue;
    }

    // Skip if no current file
    if (!currentFile) continue;

    // New file indicator
    if (line.startsWith('new file mode')) {
      currentFile.isNew = true;
      continue;
    }

    // Deleted file indicator
    if (line.startsWith('deleted file mode')) {
      currentFile.isDeleted = true;
      continue;
    }

    // Renamed file indicator
    if (line.startsWith('rename from')) {
      currentFile.isRenamed = true;
      currentFile.oldPath = line.substring(RENAME_FROM_PREFIX);
      continue;
    }
    if (line.startsWith('rename to')) {
      currentFile.newPath = line.substring(RENAME_TO_PREFIX);
      continue;
    }

    // Copied file indicator
    if (line.startsWith('copy from')) {
      currentFile.isCopied = true;
      currentFile.oldPath = line.substring(COPY_FROM_PREFIX);
      continue;
    }
    if (line.startsWith('copy to')) {
      currentFile.newPath = line.substring(COPY_TO_PREFIX);
      continue;
    }

    // Mode changes
    const modeMatch = line.match(/old mode (\w+)/);
    if (modeMatch) {
      currentFile.oldMode = modeMatch[1];
      continue;
    }
    const newModeMatch = line.match(/new mode (\w+)/);
    if (newModeMatch) {
      currentFile.newMode = newModeMatch[1];
      continue;
    }

    // Index line
    if (line.startsWith('index ')) {
      continue;
    }

    // ---/+++ lines
    if (line.startsWith('--- ') || line.startsWith('+++ ')) {
      continue;
    }

    // Hunk header
    if (line.startsWith('@@')) {
      finishHunk();
      // Parse line numbers from @@ -old,count +new,count @@
      const hunkMatch = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (hunkMatch) {
        oldLineNum = parseInt(hunkMatch[1], 10);
        const oldCount = hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1;
        newLineNum = parseInt(hunkMatch[3], 10);
        const newCount = hunkMatch[4] ? parseInt(hunkMatch[4], 10) : 1;
        currentHunk = {
          oldStart: oldLineNum,
          oldLines: oldCount,
          newStart: newLineNum,
          newLines: newCount,
          header: line,
          lines: [],
        };
      }
      continue;
    }

    // Diff content lines
    if (currentHunk) {
      if (line.startsWith('+')) {
        currentLines.push({
          newLineNumber: newLineNum,
          type: 'addition',
          content: line.substring(1),
        });
        newLineNum++;
        fileAdditions++;
      } else if (line.startsWith('-')) {
        currentLines.push({
          oldLineNumber: oldLineNum,
          type: 'deletion',
          content: line.substring(1),
        });
        oldLineNum++;
        fileDeletions++;
      } else if (line.startsWith(' ') || line === '') {
        currentLines.push({
          oldLineNumber: oldLineNum,
          newLineNumber: newLineNum,
          type: 'context',
          content: line.substring(1) || '',
        });
        oldLineNum++;
        newLineNum++;
      }
    }
  }

  // Don't forget the last file and hunk
  finishFile();

  // Calculate totals
  const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);

  return {
    files,
    totalAdditions,
    totalDeletions,
  };
}

/**
 * Convert unified diff hunk to side-by-side diff lines
 * This creates aligned left (old) and right (new) panes
 */
export function convertToSideBySide(hunk: DiffHunk): {
  leftLines: DiffLine[];
  rightLines: DiffLine[];
} {
  const leftLines: DiffLine[] = [];
  const rightLines: DiffLine[] = [];

  for (const line of hunk.lines) {
    if (line.type === 'deletion') {
      // Deletion only appears on left side
      leftLines.push(line);
      rightLines.push({
        type: 'context',
        content: '',
      });
    } else if (line.type === 'addition') {
      // Addition only appears on right side
      leftLines.push({
        type: 'context',
        content: '',
      });
      rightLines.push(line);
    } else {
      // Context appears on both sides
      leftLines.push(line);
      rightLines.push(line);
    }
  }

  return { leftLines, rightLines };
}

/**
 * Collapse unchanged regions in hunks
 */
export function collapseUnchangedRegions(
  hunks: DiffHunk[],
  contextLines: number = DEFAULT_CONTEXT_LINES
): DiffHunk[] {
  return hunks.map((hunk) => {
    const lines: DiffLine[] = [];
    let contextCount = 0;
    let inChanges = false;

    for (let i = 0; i < hunk.lines.length; i++) {
      const line = hunk.lines[i];

      if (line.type === 'context') {
        contextCount++;

        // If we're past the context limit and not in changes, mark as collapsed
        if (contextCount > contextLines * 2 && !inChanges && i < hunk.lines.length - contextLines) {
          // Only add collapse indicator if not already added
          const lastLine = lines[lines.length - 1];
          if (!lastLine || !lastLine.isCollapsed) {
            lines.push({
              type: 'context',
              content: COLLAPSED_INDICATOR,
              isCollapsed: true,
            });
          }
          continue;
        }
      } else {
        inChanges = true;
        contextCount = 0;
      }

      lines.push(line);
    }

    return {
      ...hunk,
      lines,
    };
  });
}

/**
 * Detect language from file extension for syntax highlighting
 */
export function detectLanguage(filePath: string): string {
  const name = filePath.split('/').pop() || filePath;
  const ext = name.includes('.') ? name.split('.').pop()?.toLowerCase() : '';

  // Check exact file names first
  const fileNameMap: Record<string, string> = {
    Dockerfile: 'dockerfile',
    Makefile: 'shell',
    Rakefile: 'ruby',
    Gemfile: 'ruby',
    '.gitignore': 'shell',
    '.env': 'shell',
    '.bashrc': 'bash',
    '.zshrc': 'zsh',
    'package.json': 'json',
    'tsconfig.json': 'json',
  };
  if (fileNameMap[name]) return fileNameMap[name];

  // Then check extensions
  const extMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    mjs: 'javascript',
    cjs: 'javascript',
    mts: 'typescript',
    cts: 'typescript',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    json: 'json',
    md: 'markdown',
    mdx: 'markdown',
    xml: 'xml',
    svg: 'svg',
    py: 'python',
    rs: 'rust',
    cpp: 'cpp',
    c: 'c',
    h: 'c',
    hpp: 'cpp',
    java: 'java',
    sql: 'sql',
    yaml: 'yaml',
    yml: 'yaml',
    sh: 'shell',
    bash: 'bash',
    zsh: 'zsh',
    go: 'go',
    rb: 'ruby',
    toml: 'toml',
    lock: 'toml',
  };

  return ext ? extMap[ext] || '' : '';
}

/**
 * Find the next change in the diff
 */
export function findNextChange(
  files: DiffFile[],
  currentFileIndex: number,
  currentHunkIndex: number,
  currentLineIndex: number
): { fileIndex: number; hunkIndex: number; lineIndex: number } | null {
  // Search in current hunk from current line
  const currentFile = files[currentFileIndex];
  const currentHunk = currentFile.hunks[currentHunkIndex];

  for (let i = currentLineIndex + 1; i < currentHunk.lines.length; i++) {
    if (isChangeLine(currentHunk.lines[i])) {
      return { fileIndex: currentFileIndex, hunkIndex: currentHunkIndex, lineIndex: i };
    }
  }

  // Search remaining hunks in current file
  for (let h = currentHunkIndex + 1; h < currentFile.hunks.length; h++) {
    const hunk = currentFile.hunks[h];
    const firstChange = hunk.lines.findIndex(isChangeLine);
    if (firstChange !== -1) {
      return { fileIndex: currentFileIndex, hunkIndex: h, lineIndex: firstChange };
    }
  }

  // Search remaining files
  for (let f = currentFileIndex + 1; f < files.length; f++) {
    const file = files[f];
    for (let h = 0; h < file.hunks.length; h++) {
      const hunk = file.hunks[h];
      const firstChange = hunk.lines.findIndex(isChangeLine);
      if (firstChange !== -1) {
        return { fileIndex: f, hunkIndex: h, lineIndex: firstChange };
      }
    }
  }

  return null;
}

/**
 * Find the previous change in the diff
 */
export function findPreviousChange(
  files: DiffFile[],
  currentFileIndex: number,
  currentHunkIndex: number,
  currentLineIndex: number
): { fileIndex: number; hunkIndex: number; lineIndex: number } | null {
  // Search in current hunk from current line
  const currentFile = files[currentFileIndex];
  const currentHunk = currentFile.hunks[currentHunkIndex];

  for (let i = currentLineIndex - 1; i >= 0; i--) {
    if (isChangeLine(currentHunk.lines[i])) {
      return { fileIndex: currentFileIndex, hunkIndex: currentHunkIndex, lineIndex: i };
    }
  }

  // Search previous hunks in current file
  for (let h = currentHunkIndex - 1; h >= 0; h--) {
    const hunk = currentFile.hunks[h];
    const lastChange = hunk.lines.findLastIndex(isChangeLine);
    if (lastChange !== -1) {
      return { fileIndex: currentFileIndex, hunkIndex: h, lineIndex: lastChange };
    }
  }

  // Search previous files
  for (let f = currentFileIndex - 1; f >= 0; f--) {
    const file = files[f];
    for (let h = file.hunks.length - 1; h >= 0; h--) {
      const hunk = file.hunks[h];
      const lastChange = hunk.lines.findLastIndex(isChangeLine);
      if (lastChange !== -1) {
        return { fileIndex: f, hunkIndex: h, lineIndex: lastChange };
      }
    }
  }

  return null;
}

/**
 * Find the first change in the entire diff
 */
export function findFirstChange(files: DiffFile[]): {
  fileIndex: number;
  hunkIndex: number;
  lineIndex: number;
} | null {
  for (let f = 0; f < files.length; f++) {
    const file = files[f];
    for (let h = 0; h < file.hunks.length; h++) {
      const hunk = file.hunks[h];
      const firstChange = hunk.lines.findIndex(isChangeLine);
      if (firstChange !== -1) {
        return { fileIndex: f, hunkIndex: h, lineIndex: firstChange };
      }
    }
  }
  return null;
}

/**
 * Find the last change in the entire diff
 */
export function findLastChange(files: DiffFile[]): {
  fileIndex: number;
  hunkIndex: number;
  lineIndex: number;
} | null {
  for (let f = files.length - 1; f >= 0; f--) {
    const file = files[f];
    for (let h = file.hunks.length - 1; h >= 0; h--) {
      const hunk = file.hunks[h];
      const lastChange = hunk.lines.findLastIndex(isChangeLine);
      if (lastChange !== -1) {
        return { fileIndex: f, hunkIndex: h, lineIndex: lastChange };
      }
    }
  }
  return null;
}
