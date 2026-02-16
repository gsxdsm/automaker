import { useState, useCallback, useEffect } from 'react';
import { GitCommit, FileDiff, X, Copy, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SplitDiffViewer } from '@/components/ui/split-diff-viewer';
import { toast } from 'sonner';
import { getCommitDiff } from '@automaker/git-utils';

export interface CommitDiffViewProps {
  repoPath: string;
  commitHash: string;
  commitMessage: string;
  onClose?: () => void;
}

export function CommitDiffView({
  repoPath,
  commitHash,
  commitMessage,
  onClose,
}: CommitDiffViewProps) {
  const [diff, setDiff] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadDiff = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const diffText = await getCommitDiff(repoPath, commitHash);
      setDiff(diffText);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load diff'));
    } finally {
      setIsLoading(false);
    }
  }, [repoPath, commitHash]);

  useEffect(() => {
    loadDiff();
  }, [loadDiff]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(diff);
    toast.success('Diff copied to clipboard');
  }, [diff]);

  const handleDownload = useCallback(() => {
    try {
      const blob = new Blob([diff], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${commitHash}.diff`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Cleanup URL after a short delay
      setTimeout(() => URL.revokeObjectURL(url), 100);
      toast.success('Diff downloaded');
    } catch (err) {
      toast.error('Failed to download diff');
      console.error('Download error:', err);
    }
  }, [diff, commitHash]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
          <span>Loading diff...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-destructive">
        <div className="text-center">
          <FileDiff className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-sm mb-1">Failed to load diff</p>
          <p className="text-xs text-muted-foreground">{error.message}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={loadDiff}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/20 shrink-0">
        <GitCommit className="h-4 w-4 text-brand-500 shrink-0" />
        <span className="font-mono text-sm text-muted-foreground">{commitHash.slice(0, 8)}</span>
        <span className="flex-1 text-sm truncate">{commitMessage}</span>
        <Button variant="ghost" size="sm" className="h-7 px-2 gap-1.5" onClick={handleCopy}>
          <Copy className="h-3.5 w-3.5" />
          <span className="text-xs">Copy</span>
        </Button>
        <Button variant="ghost" size="sm" className="h-7 px-2 gap-1.5" onClick={handleDownload}>
          <Download className="h-3.5 w-3.5" />
          <span className="text-xs">Download</span>
        </Button>
        {onClose && (
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Diff content using SplitDiffViewer */}
      <div className="flex-1 overflow-hidden">
        <SplitDiffViewer
          diff={diff}
          showHeader={false}
          commitHash={commitHash}
          commitMessage={commitMessage}
          repoPath={repoPath}
        />
      </div>
    </div>
  );
}
