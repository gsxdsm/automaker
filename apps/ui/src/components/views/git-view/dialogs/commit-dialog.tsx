import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  GitCommit,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Trash2,
  Eye,
  EyeOff,
  AlertTriangle,
} from 'lucide-react';
import { useGitDiffs } from '@/hooks/queries';
import {
  useStageFiles,
  useUnstageFiles,
  useCommitChanges,
  useDiscardChanges,
} from '@/hooks/mutations';
import {
  getFileStatusColor,
  getFileStatusLabel,
  getFileStatusIcon,
  DIFF_PREVIEW_MAX_LINES,
  DIFF_PREVIEW_NO_DIFF_MESSAGE,
  DIFF_PREVIEW_NO_PREVIEW_MESSAGE,
  DIFF_PREVIEW_TRUNCATED_MESSAGE,
} from '@/lib/git-file-status';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';
import { getElectronAPI } from '@/lib/electron';
import type { FileStatus } from '@/types/electron';

interface CommitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectPath: string;
}

interface FileStatusWithSelection extends FileStatus {
  selected: boolean;
  diffPreview?: string;
  showDiff: boolean;
  isLoadingDiff?: boolean;
}

/**
 * Parse unified diff format for preview
 * Truncates after a maximum number of lines to prevent performance issues
 */
function parseFileDiff(diffText: string): string {
  if (!diffText) return DIFF_PREVIEW_NO_DIFF_MESSAGE;
  const lines = diffText.split('\n');
  let preview = '';
  let lineCount = 0;
  let inHunk = false;

  for (const line of lines) {
    // Start of hunk
    if (line.startsWith('@@')) {
      inHunk = true;
      preview += line + '\n';
      lineCount++;
      continue;
    }
    // Diff content lines
    if (
      inHunk &&
      (line.startsWith('+') || line.startsWith('-') || line.startsWith(' ') || line === '')
    ) {
      preview += line + '\n';
      lineCount++;
      if (lineCount > DIFF_PREVIEW_MAX_LINES) {
        preview += DIFF_PREVIEW_TRUNCATED_MESSAGE;
        break;
      }
    }
  }

  return preview || DIFF_PREVIEW_NO_PREVIEW_MESSAGE;
}

/**
 * Pluralization helper for file counts
 */
function pluralizeFiles(count: number): string {
  return `file${count !== 1 ? 's' : ''}`;
}

/**
 * Git Commit Dialog
 *
 * Comprehensive commit UI with:
 * - File list with status indicators
 * - Staging/unstaging controls
 * - Diff previews
 * - AI-powered commit message generation
 * - Commit options (amend, sign-off, no-verify)
 */
export function CommitDialog({ open, onOpenChange, projectPath }: CommitDialogProps) {
  const [message, setMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [commitOptions, setCommitOptions] = useState({
    amend: false,
    signOff: false,
    noVerify: false,
  });

  const stageMutation = useStageFiles();
  const unstageMutation = useUnstageFiles();
  const commitMutation = useCommitChanges();
  const discardMutation = useDiscardChanges();

  // Fetch git diffs to get changed files
  const {
    data: diffsData,
    isLoading: isLoadingDiffs,
    refetch: refetchDiffs,
  } = useGitDiffs(projectPath, open);

  const files: FileStatus[] = diffsData?.files ?? [];

  // Expandable file states
  const [fileStates, setFileStates] = useState<Map<string, FileStatusWithSelection>>(new Map());

  // Memoize file values array to avoid repeated Array.from calls
  const fileValues = useMemo(() => Array.from(fileStates.values()), [fileStates]);

  // Memoize selected files for staging operations
  const selectedFiles = useMemo(() => fileValues.filter((f) => f.selected), [fileValues]);

  const selectedCount = selectedFiles.length;
  const hasSelection = selectedCount > 0;

  /**
   * Update file states when the files list changes
   * Preserves existing selection and diff state
   */
  useEffect(() => {
    setFileStates((prevStates) => {
      const newStates = new Map<string, FileStatusWithSelection>();
      for (const file of files) {
        const existing = prevStates.get(file.path);
        newStates.set(file.path, {
          ...file,
          selected: existing?.selected ?? false,
          showDiff: existing?.showDiff ?? false,
          diffPreview: existing?.diffPreview,
          isLoadingDiff: false,
        });
      }
      return newStates;
    });
  }, [files]); // Note: Intentionally omitting fileStates to prevent infinite loops

  /**
   * Toggle selection for a single file
   */
  const handleToggleFileSelection = useCallback((filePath: string) => {
    setFileStates((prev) => {
      const newStates = new Map(prev);
      const file = newStates.get(filePath);
      if (file) {
        newStates.set(filePath, { ...file, selected: !file.selected });
      }
      return newStates;
    });
  }, []);

  /**
   * Toggle selection for all files
   */
  const handleToggleAll = useCallback(() => {
    const allSelected = fileValues.every((f) => f.selected);
    setFileStates((prev) => {
      const newStates = new Map(prev);
      for (const [path, file] of newStates) {
        newStates.set(path, { ...file, selected: !allSelected });
      }
      return newStates;
    });
  }, [fileValues]);

  /**
   * Toggle diff preview visibility and fetch diff if needed
   */
  const handleToggleDiff = useCallback(
    async (filePath: string) => {
      const file = fileStates.get(filePath);
      if (!file) return;

      // If diff preview is already loaded, just toggle visibility
      if (file.diffPreview) {
        setFileStates((prev) => {
          const newStates = new Map(prev);
          newStates.set(filePath, { ...file, showDiff: !file.showDiff });
          return newStates;
        });
        return;
      }

      // Set loading state
      setFileStates((prev) => {
        const newStates = new Map(prev);
        newStates.set(filePath, { ...file, isLoadingDiff: true });
        return newStates;
      });

      // Fetch diff preview
      try {
        const api = getElectronAPI();
        if (!api.git) {
          toast.error('Git API not available');
          return;
        }

        const result = await api.git.getFileDiff(projectPath, filePath);
        if (result.success && result.diff) {
          const preview = parseFileDiff(result.diff);
          setFileStates((prev) => {
            const newStates = new Map(prev);
            const f = newStates.get(filePath);
            if (f) {
              newStates.set(filePath, {
                ...f,
                diffPreview: preview,
                showDiff: true,
                isLoadingDiff: false,
              });
            }
            return newStates;
          });
        } else {
          // Handle error case
          setFileStates((prev) => {
            const newStates = new Map(prev);
            const f = newStates.get(filePath);
            if (f) {
              newStates.set(filePath, { ...f, isLoadingDiff: false });
            }
            return newStates;
          });
          toast.error('Failed to load diff preview');
        }
      } catch (error) {
        // Clear loading state on error
        setFileStates((prev) => {
          const newStates = new Map(prev);
          const f = newStates.get(filePath);
          if (f) {
            newStates.set(filePath, { ...f, isLoadingDiff: false });
          }
          return newStates;
        });
        console.error('Failed to get file diff:', error);
        toast.error('Failed to load diff preview', {
          description: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
    [fileStates, projectPath]
  );

  /**
   * Stage selected files
   */
  const handleStageSelected = useCallback(async () => {
    const paths = selectedFiles.map((f) => f.path);
    if (paths.length === 0) return;

    try {
      await stageMutation.mutateAsync({ projectPath, paths });
      toast.success(`Staged ${paths.length} ${pluralizeFiles(paths.length)}`);

      // Clear selection after staging
      setFileStates((prev) => {
        const newStates = new Map(prev);
        for (const [path, file] of newStates) {
          if (file.selected) {
            newStates.set(path, { ...file, selected: false });
          }
        }
        return newStates;
      });
    } catch (error) {
      // Error handled by mutation
    }
  }, [selectedFiles, projectPath, stageMutation]);

  /**
   * Stage all files
   */
  const handleStageAll = useCallback(async () => {
    try {
      await stageMutation.mutateAsync({ projectPath });
      toast.success('All changes staged');
    } catch (error) {
      // Error handled by mutation
    }
  }, [projectPath, stageMutation]);

  /**
   * Unstage selected files
   */
  const handleUnstageSelected = useCallback(async () => {
    const paths = selectedFiles.map((f) => f.path);
    if (paths.length === 0) return;

    try {
      await unstageMutation.mutateAsync({ projectPath, paths });
      toast.success(`Unstaged ${paths.length} ${pluralizeFiles(paths.length)}`);
    } catch (error) {
      // Error handled by mutation
    }
  }, [selectedFiles, projectPath, unstageMutation]);

  /**
   * Discard selected files
   */
  const handleDiscardSelected = useCallback(async () => {
    const paths = selectedFiles.map((f) => f.path);
    if (paths.length === 0) return;

    // Confirm before discarding
    const confirmed = window.confirm(
      `Are you sure you want to discard changes to ${paths.length} ${pluralizeFiles(paths.length)}? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await discardMutation.mutateAsync({ projectPath, paths });
    } catch (error) {
      // Error handled by mutation
    }
  }, [selectedFiles, projectPath, discardMutation]);

  /**
   * Generate AI commit message
   */
  const handleGenerateMessage = useCallback(async () => {
    setIsGenerating(true);
    try {
      const api = getElectronAPI();
      // Try to use worktree commit message generation if available
      if (api.worktree) {
        const result = await api.worktree.generateCommitMessage(projectPath);
        if (result.success && result.message) {
          setMessage(result.message);
          return;
        }
      }

      // Fallback to a generic message
      setMessage(
        `feat: Update files\n\nChanges to ${selectedCount || 'various'} ${pluralizeFiles(selectedCount || 0)}`
      );
    } catch (error) {
      console.error('Failed to generate commit message:', error);
      toast.error('Failed to generate commit message', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
      // Still provide a fallback message
      setMessage(
        `feat: Update files\n\nChanges to ${selectedCount || 'various'} ${pluralizeFiles(selectedCount || 0)}`
      );
    } finally {
      setIsGenerating(false);
    }
  }, [projectPath, selectedCount]);

  /**
   * Commit changes
   */
  const handleCommit = useCallback(async () => {
    if (!message.trim()) {
      toast.error('Please enter a commit message');
      return;
    }

    try {
      await commitMutation.mutateAsync({
        projectPath,
        message,
        options: commitOptions,
      });

      // Reset form and close
      setMessage('');
      setCommitOptions({ amend: false, signOff: false, noVerify: false });
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  }, [message, projectPath, commitOptions, commitMutation, onOpenChange]);

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && e.metaKey && !commitMutation.isPending) {
        e.preventDefault();
        handleCommit();
      }
    },
    [commitMutation.isPending, handleCommit]
  );

  /**
   * Update commit option
   */
  const updateCommitOption = useCallback(
    <K extends keyof typeof commitOptions>(key: K, value: boolean) => {
      setCommitOptions((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const isLoading = isLoadingDiffs || commitMutation.isPending;
  const canCommit = message.trim().length > 0 && !commitMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCommit className="w-5 h-5 text-brand-500" />
            Commit Changes
          </DialogTitle>
          <DialogDescription>Review changes, stage files, and create a commit</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Changed Files Section */}
          <div className="flex-1 flex flex-col min-h-0 border rounded-lg overflow-hidden">
            {/* Files Header */}
            <div className="flex items-center justify-between p-3 bg-muted/30 border-b">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all"
                  checked={files.length > 0 && fileValues.every((f) => f.selected)}
                  onCheckedChange={handleToggleAll}
                />
                <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                  Select All
                </Label>
                <span className="text-xs text-muted-foreground">
                  ({files.length} {pluralizeFiles(files.length)} changed)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleStageAll}
                  disabled={files.length === 0}
                  className="h-7 text-xs"
                >
                  <Eye className="w-3 h-3 mr-1" />
                  Stage All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void refetchDiffs()}
                  disabled={isLoadingDiffs}
                  className="h-7 text-xs"
                >
                  Refresh
                </Button>
              </div>
            </div>

            {/* Files List */}
            <ScrollArea className="flex-1">
              {isLoadingDiffs ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Spinner size="md" />
                </div>
              ) : files.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <GitCommit className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-sm">No changes detected</p>
                  <p className="text-xs mt-1">Working tree is clean</p>
                </div>
              ) : (
                <div className="divide-y">
                  {fileValues.map((file) => {
                    const StatusIcon = getFileStatusIcon(file.status);
                    return (
                      <div key={file.path} className="p-3 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={file.selected}
                            onCheckedChange={() => handleToggleFileSelection(file.path)}
                          />

                          <div className={cn('p-1 rounded', getFileStatusColor(file.status))}>
                            <StatusIcon className="w-4 h-4" />
                          </div>

                          <span className="flex-1 text-sm font-mono truncate">{file.path}</span>

                          <Badge
                            variant="outline"
                            className={cn('text-xs', getFileStatusColor(file.status))}
                          >
                            {getStatusLabel(file.status)}
                          </Badge>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleToggleDiff(file.path)}
                            disabled={file.isLoadingDiff}
                            className="h-7 w-7 p-0"
                          >
                            {file.isLoadingDiff ? (
                              <Spinner size="sm" />
                            ) : file.showDiff ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </Button>
                        </div>

                        {/* Diff Preview */}
                        {file.showDiff && file.diffPreview && (
                          <div className="mt-3 ml-8 p-3 bg-muted/50 rounded-md">
                            <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                              {file.diffPreview}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            {/* Action Bar */}
            {files.length > 0 && (
              <div className="flex items-center gap-2 p-3 border-t bg-muted/30">
                <span className="text-xs text-muted-foreground">
                  {selectedCount} {pluralizeFiles(selectedCount)} selected
                </span>
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleStageSelected}
                  disabled={!hasSelection || stageMutation.isPending}
                  className="h-7 text-xs"
                >
                  <Eye className="w-3 h-3 mr-1" />
                  Stage
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUnstageSelected}
                  disabled={!hasSelection || unstageMutation.isPending}
                  className="h-7 text-xs"
                >
                  <EyeOff className="w-3 h-3 mr-1" />
                  Unstage
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDiscardSelected}
                  disabled={!hasSelection || discardMutation.isPending}
                  className="h-7 text-xs text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Discard
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* Commit Message Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="commit-message">Commit Message</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGenerateMessage}
                disabled={isGenerating || isLoading}
                className="h-7 text-xs"
              >
                {isGenerating ? (
                  <>
                    <Spinner size="sm" className="mr-1" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 mr-1" />
                    AI Generate
                  </>
                )}
              </Button>
            </div>
            <Textarea
              id="commit-message"
              placeholder="feat: Brief description of changes

Detailed explanation of what was changed and why..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[120px] font-mono text-sm resize-none"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Press <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Cmd+Enter</kbd> to commit
            </p>
          </div>

          {/* Commit Options */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Checkbox
                id="amend"
                checked={commitOptions.amend}
                onCheckedChange={(checked) => updateCommitOption('amend', checked === true)}
              />
              <Label htmlFor="amend" className="text-sm cursor-pointer">
                Amend last commit
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="signoff"
                checked={commitOptions.signOff}
                onCheckedChange={(checked) => updateCommitOption('signOff', checked === true)}
              />
              <Label htmlFor="signoff" className="text-sm cursor-pointer">
                Sign-off (Signed-off-by)
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="no-verify"
                checked={commitOptions.noVerify}
                onCheckedChange={(checked) => updateCommitOption('noVerify', checked === true)}
              />
              <Label htmlFor="no-verify" className="text-sm cursor-pointer">
                Skip hooks (--no-verify)
              </Label>
            </div>
          </div>

          {commitOptions.noVerify && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-md">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-amber-500">
                Pre-commit hooks will be bypassed. This may skip important validations.
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleCommit} disabled={!canCommit || isLoading}>
            {commitMutation.isPending ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Committing...
              </>
            ) : (
              <>
                <GitCommit className="w-4 h-4 mr-2" />
                Commit
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
