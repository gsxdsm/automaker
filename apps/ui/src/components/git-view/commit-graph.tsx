import { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { GitCommitWithStats } from '@automaker/git-utils';

export interface CommitGraphProps {
  commits: GitCommitWithStats[];
  selectedCommit?: string | null;
  onCommitClick?: (hash: string) => void;
  compact?: boolean;
}

interface GraphNode {
  hash: string;
  column: number;
  parents: string[];
}

// Constants for graph sizing
const GRAPH_CONSTANTS = {
  COLUMN_WIDTH: 16, // px
  NODE_SIZE_COMPACT: 10, // px
  NODE_SIZE_NORMAL: 12, // px
  ROW_HEIGHT_COMPACT: 20, // px
  ROW_HEIGHT_NORMAL: 28, // px
  LINE_OFFSET_START: 8, // px
  LINE_OFFSET_END_COMPACT: 28, // px
  LINE_OFFSET_END_NORMAL: 40, // px
  LINE_STROKE_WIDTH: 2,
} as const;

// Color palette for graph lines
const GRAPH_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
] as const;

/**
 * Simple commit graph visualization using columns to represent branches
 * This is a simplified approach that works well for most git histories
 */
export const CommitGraph = memo(function CommitGraph({
  commits,
  selectedCommit,
  onCommitClick,
  compact = false,
}: CommitGraphProps) {
  // Calculate column assignments for commits (memoized)
  const graphData = useMemo(() => calculateGraphColumns(commits), [commits]);

  // Find the maximum column to determine width (memoized)
  const maxColumn = useMemo(() => Math.max(...graphData.map((n) => n.column), 0), [graphData]);

  return (
    <div className={cn('flex flex-col', compact ? 'gap-0.5' : 'gap-1')}>
      {graphData.map((node, index) => {
        const commit = commits[index];
        const isSelected = selectedCommit === node.hash;

        return (
          <div
            key={node.hash}
            className="relative flex items-center"
            style={{
              height: compact
                ? `${GRAPH_CONSTANTS.ROW_HEIGHT_COMPACT}px`
                : `${GRAPH_CONSTANTS.ROW_HEIGHT_NORMAL}px`,
            }}
          >
            {/* Graph visualization area */}
            <div
              className="flex items-center relative"
              style={{ width: `${(maxColumn + 1) * GRAPH_CONSTANTS.COLUMN_WIDTH}px` }}
            >
              {/* Draw connection lines to parents */}
              {node.parents.map((parentHash) => {
                const parentIndex = graphData.findIndex((n) => n.hash === parentHash);
                if (parentIndex === -1) return null;

                const parentNode = graphData[parentIndex];
                const lineColor = getLineColor(node.column);

                return (
                  <svg
                    key={`line-${node.hash}-${parentHash}`}
                    className="absolute inset-0 pointer-events-none"
                    style={{ height: '100%' }}
                  >
                    <line
                      x1={
                        node.column * GRAPH_CONSTANTS.COLUMN_WIDTH +
                        GRAPH_CONSTANTS.LINE_OFFSET_START
                      }
                      y1={GRAPH_CONSTANTS.LINE_OFFSET_START}
                      x2={
                        parentNode.column * GRAPH_CONSTANTS.COLUMN_WIDTH +
                        GRAPH_CONSTANTS.LINE_OFFSET_START
                      }
                      y2={
                        compact
                          ? GRAPH_CONSTANTS.LINE_OFFSET_END_COMPACT
                          : GRAPH_CONSTANTS.LINE_OFFSET_END_NORMAL
                      }
                      stroke={lineColor}
                      strokeWidth={GRAPH_CONSTANTS.LINE_STROKE_WIDTH}
                      fill="none"
                      opacity="0.5"
                    />
                  </svg>
                );
              })}

              {/* Commit node */}
              <button
                className={cn(
                  'relative z-10 rounded-full transition-all hover:scale-110',
                  isSelected && 'ring-2 ring-brand-500 ring-offset-1'
                )}
                style={{
                  backgroundColor: getLineColor(node.column),
                  width: compact
                    ? `${GRAPH_CONSTANTS.NODE_SIZE_COMPACT}px`
                    : `${GRAPH_CONSTANTS.NODE_SIZE_NORMAL}px`,
                  height: compact
                    ? `${GRAPH_CONSTANTS.NODE_SIZE_COMPACT}px`
                    : `${GRAPH_CONSTANTS.NODE_SIZE_NORMAL}px`,
                  marginLeft: `${node.column * GRAPH_CONSTANTS.COLUMN_WIDTH}px`,
                }}
                onClick={() => onCommitClick?.(node.hash)}
                aria-label={`Select commit ${commit.shortHash}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
});

/**
 * Calculate column assignments for commits using a simple algorithm
 */
function calculateGraphColumns(commits: GitCommitWithStats[]): GraphNode[] {
  const nodes: GraphNode[] = [];
  const columns: Map<string, number> = new Map(); // hash -> column
  const availableColumns: number[] = [];

  // Process commits in order (newest first)
  for (const commit of commits) {
    let column: number;

    // Check if this commit already has a column assigned
    if (columns.has(commit.hash)) {
      column = columns.get(commit.hash)!;
    } else {
      // Assign to next available column
      column = availableColumns.pop() ?? nodes.length;
      columns.set(commit.hash, column);
    }

    // Assign columns to parents if they don't have one yet
    for (const parentHash of commit.parents) {
      if (!columns.has(parentHash)) {
        // Find an available column that's not this commit's column
        let parentColumn = availableColumns.pop();
        if (parentColumn === undefined) {
          parentColumn = Math.max(...nodes.map((n) => n.column), column) + 1;
        }
        columns.set(parentHash, parentColumn);
      }
    }

    // Release this commit's column when it's no longer the active head
    if (commit.parents.length === 1) {
      // Single parent - this column will continue through parent
      // Keep the column occupied
    } else if (commit.parents.length === 0) {
      // Root commit - release column
      availableColumns.push(column);
    }

    nodes.push({
      hash: commit.hash,
      column,
      parents: commit.parents,
    });
  }

  return nodes;
}

/**
 * Get line color based on column index
 */
function getLineColor(column: number): string {
  // Use the column for color, wrapping around
  return GRAPH_COLORS[column % GRAPH_COLORS.length];
}
