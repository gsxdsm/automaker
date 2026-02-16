/**
 * SplitDiffPane Component
 *
 * A single pane component for displaying diff content.
 * Can be used as left (old) or right (new) pane in split view,
 * or as the single pane in unified view.
 */

import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { DiffLine } from '@/lib/diff-parser';

export interface SplitDiffPaneProps {
  /** Lines to display in this pane */
  lines: DiffLine[];
  /** Whether this is the left (old) or right (new) pane */
  side?: 'left' | 'right';
  /** Language for syntax highlighting */
  language?: string;
  /** Whether to show line numbers */
  showLineNumbers?: boolean;
  /** Optional CSS class name */
  className?: string;
  /** Click handler for lines */
  onLineClick?: (line: DiffLine, index: number) => void;
  /** Current line index to highlight */
  activeLineIndex?: number;
  /** Comments for lines */
  comments?: Map<number, string>;
}

export const SplitDiffPane = memo<SplitDiffPaneProps>(
  ({
    lines,
    side = 'left',
    language = '',
    showLineNumbers = true,
    className,
    onLineClick,
    activeLineIndex,
    comments = new Map(),
  }) => {
    return (
      <div
        className={cn('flex flex-col h-full overflow-hidden font-mono text-xs', className)}
        data-testid={`diff-pane-${side}`}
      >
        {/* Header */}
        <div className="flex items-center px-3 py-2 bg-muted/30 border-b border-border shrink-0">
          <span className="text-sm font-medium text-muted-foreground">
            {side === 'left' ? 'Old' : 'New'}
          </span>
          {language && <span className="ml-2 text-xs text-muted-foreground/70">{language}</span>}
        </div>

        {/* Lines */}
        <div className="flex-1 overflow-y-auto">
          {lines.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <span className="text-sm">No content</span>
            </div>
          ) : (
            <div className="flex flex-col">
              {lines.map((line, index) => {
                const lineNumber = side === 'left' ? line.oldLineNumber : line.newLineNumber;
                const isActive = activeLineIndex === index;
                const hasComment = comments.has(index);

                return (
                  <div
                    key={index}
                    className={cn(
                      'flex items-start group hover:bg-accent/30 transition-colors',
                      line.type === 'addition' && 'bg-green-500/5',
                      line.type === 'deletion' && 'bg-red-500/5',
                      line.type === 'header' && 'bg-blue-500/10',
                      isActive && 'bg-accent',
                      onLineClick && 'cursor-pointer'
                    )}
                    onClick={() => onLineClick?.(line, index)}
                    data-testid={`diff-line-${side}-${index}`}
                  >
                    {/* Line number */}
                    {showLineNumbers && (
                      <div
                        className={cn(
                          'w-12 shrink-0 text-right pr-2 select-none border-r border-border-glass text-muted-foreground/70',
                          line.type === 'header' && 'text-blue-400'
                        )}
                      >
                        {lineNumber ?? ''}
                      </div>
                    )}

                    {/* Line prefix */}
                    <div
                      className={cn(
                        'w-4 shrink-0 text-center select-none font-bold',
                        line.type === 'addition' && 'text-green-500',
                        line.type === 'deletion' && 'text-red-500',
                        line.type === 'context' && 'text-muted-foreground',
                        line.type === 'header' && 'text-blue-400'
                      )}
                    >
                      {line.type === 'addition' && '+'}
                      {line.type === 'deletion' && '-'}
                      {line.type === 'context' && ' '}
                    </div>

                    {/* Line content */}
                    <div className="flex-1 px-2 py-0.5 whitespace-pre-wrap break-all min-h-[1.25rem]">
                      {line.isCollapsed ? (
                        <span className="text-muted-foreground/50 italic">{line.content}</span>
                      ) : (
                        <span
                          className={cn(
                            line.type === 'context' && 'text-foreground-secondary',
                            line.type === 'addition' && 'text-green-400',
                            line.type === 'deletion' && 'text-red-400',
                            line.type === 'header' && 'text-blue-400'
                          )}
                        >
                          {line.content || '\u00A0'}
                        </span>
                      )}
                    </div>

                    {/* Comment indicator */}
                    {hasComment && (
                      <div className="w-6 shrink-0 flex items-center justify-center text-muted-foreground">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 13A6 6 0 118 2a6 6 0 010 12zm1-7H6v1h2V5h1v4z" />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }
);

SplitDiffPane.displayName = 'SplitDiffPane';
