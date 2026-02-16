import { useState, useCallback, useMemo } from 'react';
import { FileCode, X, Maximize2, Minimize2, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useStashDiff } from '@/hooks/queries/use-git';
import { toast } from 'sonner';
import type { StashEntry } from '../types';

interface StashDiffDialogProps {
  stash: StashEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectPath?: string;
}

// Constants
const COPY_FEEDBACK_TIMEOUT_MS = 2000;

// Diff line type for styling
type DiffLineType = 'header' | 'hunk' | 'addition' | 'deletion' | 'context';

interface DiffLine {
  content: string;
  type: DiffLineType;
}

export function StashDiffDialog({ stash, open, onOpenChange, projectPath }: StashDiffDialogProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: diff = '', isLoading } = useStashDiff(
    projectPath,
    stash?.index,
    open && !!projectPath && stash !== null
  );

  // Parse diff into styled lines
  const diffLines = useMemo(() => parseDiffLines(diff), [diff]);
  const lineCount = useMemo(() => diff.split('\n').length, [diff]);

  const handleCopy = useCallback(async () => {
    if (!diff) return;
    try {
      await navigator.clipboard.writeText(diff);
      setCopied(true);
      toast.success('Diff copied to clipboard');
      setTimeout(() => setCopied(false), COPY_FEEDBACK_TIMEOUT_MS);
    } catch {
      toast.error('Failed to copy diff');
    }
  }, [diff]);

  if (!stash) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-w-4xl max-h-[80vh] flex flex-col p-0',
          isFullscreen && 'w-full h-full max-h-screen rounded-lg'
        )}
      >
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="flex items-center gap-2 text-base">
                <FileCode className="h-4 w-4 text-brand-500" />
                Stash Diff
              </DialogTitle>
              <DialogDescription className="mt-1 truncate">{stash.message}</DialogDescription>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="font-mono">{stash.ref}</span>
                <span className="font-mono">{stash.hash.slice(0, 7)}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                title={copied ? 'Copied!' : 'Copy diff'}
                onClick={handleCopy}
                disabled={!diff}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Diff content */}
        <div className="flex-1 overflow-auto p-4 bg-muted/30">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Loading diff...
            </div>
          ) : !diff ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              No diff available
            </div>
          ) : (
            <pre className="text-xs font-mono whitespace-pre-wrap break-words leading-relaxed">
              {diffLines.map((line, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'px-1 py-0.5 -mx-1',
                    line.type === 'header' && 'text-cyan-600 dark:text-cyan-400',
                    line.type === 'hunk' && 'text-yellow-600 dark:text-yellow-400 bg-yellow-500/5',
                    line.type === 'addition' && 'text-green-600 dark:text-green-400 bg-green-500/5',
                    line.type === 'deletion' && 'text-red-600 dark:text-red-400 bg-red-500/5',
                    line.type === 'context' && 'text-muted-foreground'
                  )}
                >
                  {line.content}
                </div>
              ))}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/20 shrink-0">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Changes in this stash</span>
            <span>{lineCount} lines</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Parse diff content into styled lines
 */
function parseDiffLines(diff: string): DiffLine[] {
  const lines = diff.split('\n');

  return lines.map((line) => {
    // Determine line type for styling
    if (line.startsWith('diff --git') || line.startsWith('index ')) {
      return { content: line, type: 'header' };
    }
    if (line.startsWith('--- ') || line.startsWith('+++ ')) {
      return { content: line, type: 'header' };
    }
    if (line.startsWith('@@ ')) {
      return { content: line, type: 'hunk' };
    }
    if (line.startsWith('+')) {
      return { content: line, type: 'addition' };
    }
    if (line.startsWith('-')) {
      return { content: line, type: 'deletion' };
    }
    return { content: line, type: 'context' };
  });
}
