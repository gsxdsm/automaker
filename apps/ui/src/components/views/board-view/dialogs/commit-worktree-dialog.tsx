import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { GitCommit, Sparkles, FileEdit, FilePlus, FileX, File } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getElectronAPI } from '@/lib/electron';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';

interface WorktreeInfo {
  path: string;
  branch: string;
  isMain: boolean;
  hasChanges?: boolean;
  changedFilesCount?: number;
}

interface ChangedFile {
  path: string;
  status: string;
  statusLabel: string;
}

interface CommitWorktreeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worktree: WorktreeInfo | null;
  onCommitted: () => void;
}

function getFileStatusIcon(status: string) {
  switch (status) {
    case 'M':
    case 'MM':
    case 'AM':
      return <FileEdit className="w-3.5 h-3.5 text-yellow-500" />;
    case 'A':
    case '??':
      return <FilePlus className="w-3.5 h-3.5 text-green-500" />;
    case 'D':
      return <FileX className="w-3.5 h-3.5 text-red-500" />;
    default:
      return <File className="w-3.5 h-3.5 text-muted-foreground" />;
  }
}

function getFileStatusColor(status: string): string {
  switch (status) {
    case 'M':
    case 'MM':
    case 'AM':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'A':
    case '??':
      return 'text-green-600 dark:text-green-400';
    case 'D':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-muted-foreground';
  }
}

export function CommitWorktreeDialog({
  open,
  onOpenChange,
  worktree,
  onCommitted,
}: CommitWorktreeDialogProps) {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changedFiles, setChangedFiles] = useState<ChangedFile[]>([]);
  const [uncheckedFiles, setUncheckedFiles] = useState<Set<string>>(new Set());
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const enableAiCommitMessages = useAppStore((state) => state.enableAiCommitMessages);

  const selectedFiles = useMemo(
    () => changedFiles.filter((f) => !uncheckedFiles.has(f.path)).map((f) => f.path),
    [changedFiles, uncheckedFiles]
  );

  const allChecked = uncheckedFiles.size === 0 && changedFiles.length > 0;
  const noneChecked = uncheckedFiles.size === changedFiles.length && changedFiles.length > 0;

  const handleToggleFile = (filePath: string) => {
    setUncheckedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  };

  const handleToggleAll = () => {
    if (allChecked) {
      // Uncheck all
      setUncheckedFiles(new Set(changedFiles.map((f) => f.path)));
    } else {
      // Check all
      setUncheckedFiles(new Set());
    }
  };

  const handleCommit = async () => {
    if (!worktree || !message.trim() || selectedFiles.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const api = getElectronAPI();
      if (!api?.worktree?.commit) {
        setError('Worktree API not available');
        return;
      }

      // Pass selectedFiles only if not all files are selected (optimization)
      const filesToCommit = allChecked ? undefined : selectedFiles;
      const result = await api.worktree.commit(worktree.path, message, filesToCommit);

      if (result.success && result.result) {
        if (result.result.committed) {
          toast.success('Changes committed', {
            description: `Commit ${result.result.commitHash} on ${result.result.branch}`,
          });
          onCommitted();
          onOpenChange(false);
          setMessage('');
          setChangedFiles([]);
          setUncheckedFiles(new Set());
        } else {
          toast.info('No changes to commit', {
            description: result.result.message,
          });
        }
      } else {
        setError(result.error || 'Failed to commit changes');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to commit');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Prevent commit while loading or while AI is generating a message
    if (
      e.key === 'Enter' &&
      e.metaKey &&
      !isLoading &&
      !isGenerating &&
      message.trim() &&
      selectedFiles.length > 0
    ) {
      handleCommit();
    }
  };

  // Fetch changed files and generate AI commit message when dialog opens
  useEffect(() => {
    if (open && worktree) {
      // Reset state
      setMessage('');
      setError(null);
      setChangedFiles([]);
      setUncheckedFiles(new Set());

      // Fetch changed files
      setIsLoadingFiles(true);
      const fetchFiles = async () => {
        try {
          const api = getElectronAPI();
          if (!api?.worktree?.getChangedFiles) {
            setIsLoadingFiles(false);
            return;
          }

          const result = await api.worktree.getChangedFiles(worktree.path);
          if (result.success && result.files) {
            setChangedFiles(result.files);
          }
        } catch (err) {
          console.warn('Failed to fetch changed files:', err);
        } finally {
          setIsLoadingFiles(false);
        }
      };
      fetchFiles();

      // Only generate AI commit message if enabled
      if (!enableAiCommitMessages) {
        return;
      }

      setIsGenerating(true);
      let cancelled = false;

      const generateMessage = async () => {
        try {
          const api = getElectronAPI();
          if (!api?.worktree?.generateCommitMessage) {
            if (!cancelled) {
              setIsGenerating(false);
            }
            return;
          }

          const result = await api.worktree.generateCommitMessage(worktree.path);

          if (cancelled) return;

          if (result.success && result.message) {
            setMessage(result.message);
          } else {
            // Don't show error toast, just log it and leave message empty
            console.warn('Failed to generate commit message:', result.error);
            setMessage('');
          }
        } catch (err) {
          if (cancelled) return;
          // Don't show error toast for generation failures
          console.warn('Error generating commit message:', err);
          setMessage('');
        } finally {
          if (!cancelled) {
            setIsGenerating(false);
          }
        }
      };

      generateMessage();

      return () => {
        cancelled = true;
      };
    }
  }, [open, worktree, enableAiCommitMessages]);

  if (!worktree) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCommit className="w-5 h-5" />
            Commit Changes
          </DialogTitle>
          <DialogDescription>
            Commit changes in the{' '}
            <code className="font-mono bg-muted px-1 rounded">{worktree.branch}</code> worktree.
            {changedFiles.length > 0 && (
              <span className="ml-1">
                ({selectedFiles.length} of {changedFiles.length} file
                {changedFiles.length > 1 ? 's' : ''} selected)
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Changed Files List */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Files to commit</Label>
              {changedFiles.length > 0 && (
                <button
                  type="button"
                  onClick={handleToggleAll}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {allChecked ? 'Deselect all' : 'Select all'}
                </button>
              )}
            </div>

            {isLoadingFiles ? (
              <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                <Spinner size="sm" className="mr-2" />
                Loading files...
              </div>
            ) : changedFiles.length === 0 ? (
              <div className="text-sm text-muted-foreground py-2">No changed files found.</div>
            ) : (
              <ScrollArea className="h-[200px] rounded-md border">
                <div className="p-2 space-y-0.5">
                  {changedFiles.map((file) => {
                    const isChecked = !uncheckedFiles.has(file.path);
                    return (
                      <label
                        key={file.path}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-muted/50 cursor-pointer group"
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => handleToggleFile(file.path)}
                        />
                        {getFileStatusIcon(file.status)}
                        <span
                          className={`text-xs font-mono truncate flex-1 ${!isChecked ? 'opacity-50' : ''}`}
                          title={file.path}
                        >
                          {file.path}
                        </span>
                        <span
                          className={`text-[10px] shrink-0 ${getFileStatusColor(file.status)} ${!isChecked ? 'opacity-50' : ''}`}
                        >
                          {file.statusLabel}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Commit Message */}
          <div className="grid gap-2">
            <Label htmlFor="commit-message" className="flex items-center gap-2">
              Commit Message
              {isGenerating && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Sparkles className="w-3 h-3 animate-pulse" />
                  Generating...
                </span>
              )}
            </Label>
            <Textarea
              id="commit-message"
              placeholder={
                isGenerating ? 'Generating commit message...' : 'Describe your changes...'
              }
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              className="min-h-[100px] font-mono text-sm"
              autoFocus
              disabled={isGenerating}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <p className="text-xs text-muted-foreground">
            Press <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Cmd+Enter</kbd> to commit
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isLoading || isGenerating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCommit}
            disabled={isLoading || isGenerating || !message.trim() || noneChecked}
          >
            {isLoading ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Committing...
              </>
            ) : (
              <>
                <GitCommit className="w-4 h-4 mr-2" />
                Commit
                {selectedFiles.length > 0 && selectedFiles.length < changedFiles.length
                  ? ` (${selectedFiles.length} files)`
                  : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
