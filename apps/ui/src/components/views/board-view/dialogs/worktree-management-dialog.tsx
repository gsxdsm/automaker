import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  GitBranch,
  FolderOpen,
  Terminal,
  Trash2,
  GitMerge,
  RefreshCw,
  AlertCircle,
  FileWarning,
  CheckCircle2,
  XCircle,
  Edit3,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { getElectronAPI } from '@/lib/electron';
import { getHttpApiClient } from '@/lib/http-api-client';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useNavigate } from '@tanstack/react-router';
import type { WorktreeInfo } from '../worktree-panel/types';

interface WorktreeManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectPath: string;
  worktrees: WorktreeInfo[];
  onRefresh: () => Promise<void>;
  onWorktreeDeleted: (worktree: WorktreeInfo, deletedBranch: boolean) => void;
  onWorktreeMerged: (worktree: WorktreeInfo, deletedBranch: boolean) => void;
  onCreateWorktree: () => void;
}

interface WorktreeActionState {
  worktreePath: string;
  action: 'opening_terminal' | 'discarding' | 'deleting' | 'merging';
}

export function WorktreeManagementDialog({
  open,
  onOpenChange,
  projectPath,
  worktrees,
  onRefresh,
  onWorktreeDeleted,
  onWorktreeMerged,
  onCreateWorktree,
}: WorktreeManagementDialogProps) {
  const [actionState, setActionState] = useState<WorktreeActionState | null>(null);
  const [deleteWorktreeDialogOpen, setDeleteWorktreeDialogOpen] = useState(false);
  const [selectedWorktreeForDelete, setSelectedWorktreeForDelete] = useState<WorktreeInfo | null>(
    null
  );
  const [mergeWorktreeDialogOpen, setMergeWorktreeDialogOpen] = useState(false);
  const [selectedWorktreeForMerge, setSelectedWorktreeForMerge] = useState<WorktreeInfo | null>(
    null
  );
  const [renameWorktreeDialogOpen, setRenameWorktreeDialogOpen] = useState(false);
  const [selectedWorktreeForRename, setSelectedWorktreeForRename] = useState<WorktreeInfo | null>(
    null
  );

  const isActionInProgress = (worktreePath: string) => actionState?.worktreePath === worktreePath;

  const getActionLabel = (worktreePath: string) => {
    if (!isActionInProgress(worktreePath)) return null;
    switch (actionState?.action) {
      case 'opening_terminal':
        return 'Opening terminal...';
      case 'discarding':
        return 'Discarding...';
      case 'deleting':
        return 'Deleting...';
      case 'merging':
        return 'Merging...';
      default:
        return 'Processing...';
    }
  };

  const navigate = useNavigate();

  const handleOpenInTerminal = async (worktree: WorktreeInfo) => {
    setActionState({ worktreePath: worktree.path, action: 'opening_terminal' });
    try {
      // Navigate to the terminal view with the worktree path and branch name
      navigate({
        to: '/terminal',
        search: { cwd: worktree.path, branch: worktree.branch, mode: 'tab', nonce: Date.now() },
      });
      // Don't show success toast as navigation is immediate
    } catch (error) {
      toast.error('Failed to open terminal', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      setActionState(null);
    }
  };

  const handleDiscardChanges = async (worktree: WorktreeInfo) => {
    if (!worktree.hasChanges) return;

    setActionState({ worktreePath: worktree.path, action: 'discarding' });
    try {
      const api = getHttpApiClient();
      const result = await api.worktree.discardChanges(worktree.path);

      if (result.success) {
        toast.success('Changes discarded', {
          description: `Discarded changes in ${worktree.branch}`,
        });
        await onRefresh();
      } else {
        toast.error('Failed to discard changes', {
          description: result.error || 'Unknown error',
        });
      }
    } catch (error) {
      toast.error('Failed to discard changes', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setActionState(null);
    }
  };

  const handleDeleteWorktree = (worktree: WorktreeInfo) => {
    setSelectedWorktreeForDelete(worktree);
    setDeleteWorktreeDialogOpen(true);
  };

  const handleConfirmDelete = async (deleteBranch: boolean) => {
    if (!selectedWorktreeForDelete) return;

    setActionState({ worktreePath: selectedWorktreeForDelete.path, action: 'deleting' });
    try {
      const api = getElectronAPI();
      if (!api?.worktree?.delete) {
        toast.error('Worktree API not available');
        return;
      }
      const result = await api.worktree.delete(
        projectPath,
        selectedWorktreeForDelete.path,
        deleteBranch
      );

      if (result.success) {
        toast.success(`Worktree deleted`, {
          description: deleteBranch
            ? `Branch "${selectedWorktreeForDelete.branch}" was also deleted`
            : `Branch "${selectedWorktreeForDelete.branch}" was kept`,
        });
        onWorktreeDeleted(selectedWorktreeForDelete, deleteBranch);
        setDeleteWorktreeDialogOpen(false);
        await onRefresh();
      } else {
        toast.error('Failed to delete worktree', {
          description: result.error,
        });
      }
    } catch (error) {
      toast.error('Failed to delete worktree', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setActionState(null);
    }
  };

  const handleMergeWorktree = (worktree: WorktreeInfo) => {
    setSelectedWorktreeForMerge(worktree);
    setMergeWorktreeDialogOpen(true);
  };

  const handleRenameWorktree = (worktree: WorktreeInfo) => {
    setSelectedWorktreeForRename(worktree);
    setRenameWorktreeDialogOpen(true);
  };

  const handleMergeConfirmed = async (deleteBranch: boolean) => {
    if (!selectedWorktreeForMerge) return;

    setActionState({ worktreePath: selectedWorktreeForMerge.path, action: 'merging' });
    try {
      const api = getElectronAPI();
      if (!api?.git?.mergeBranch) {
        toast.error('Merge API not available');
        return;
      }
      const result = await api.git.mergeBranch(projectPath, selectedWorktreeForMerge.branch);

      if (result.success) {
        toast.success('Branch merged successfully', {
          description: `Branch "${selectedWorktreeForMerge.branch}" merged into main`,
        });

        // Delete the branch if requested
        if (deleteBranch) {
          const deleteApi = getElectronAPI();
          if (deleteApi?.worktree?.delete) {
            await deleteApi.worktree.delete(projectPath, selectedWorktreeForMerge.path, true);
          }
        }

        onWorktreeMerged(selectedWorktreeForMerge, deleteBranch);
        setMergeWorktreeDialogOpen(false);
        await onRefresh();
      } else {
        toast.error('Failed to merge branch', {
          description: result.error || 'Unknown error',
        });
      }
    } catch (error) {
      toast.error('Failed to merge branch', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setActionState(null);
    }
  };

  const handleRefresh = async () => {
    await onRefresh();
  };

  const mainWorktree = worktrees.find((w) => w.isMain);
  const otherWorktrees = worktrees.filter((w) => !w.isMain);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="w-5 h-5" />
              Manage Worktrees
            </DialogTitle>
            <DialogDescription>
              View and manage all worktrees for this project. Create new worktrees, open terminals,
              view changes, discard changes, merge branches, and delete worktrees.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {/* Main Worktree Section */}
            {mainWorktree && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Badge variant="outline" className="text-xs">
                    Main
                  </Badge>
                  <span>Primary Worktree</span>
                </div>
                <WorktreeRow
                  worktree={mainWorktree}
                  actionLabel={getActionLabel(mainWorktree.path)}
                  isActionInProgress={isActionInProgress(mainWorktree.path)}
                  onOpenInTerminal={() => handleOpenInTerminal(mainWorktree)}
                  onDiscardChanges={() => handleDiscardChanges(mainWorktree)}
                  onDelete={undefined} // Cannot delete main worktree
                  onMerge={undefined} // Cannot merge main worktree
                  onRename={undefined} // Cannot rename main worktree
                />
              </div>
            )}

            {/* Other Worktrees Section */}
            {otherWorktrees.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                  <span>Feature Worktrees ({otherWorktrees.length})</span>
                </div>
                {otherWorktrees.map((worktree) => (
                  <WorktreeRow
                    key={worktree.path}
                    worktree={worktree}
                    actionLabel={getActionLabel(worktree.path)}
                    isActionInProgress={isActionInProgress(worktree.path)}
                    onOpenInTerminal={() => handleOpenInTerminal(worktree)}
                    onDiscardChanges={() => handleDiscardChanges(worktree)}
                    onDelete={() => handleDeleteWorktree(worktree)}
                    onMerge={() => handleMergeWorktree(worktree)}
                    onRename={() => handleRenameWorktree(worktree)}
                  />
                ))}
              </div>
            )}

            {worktrees.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <GitBranch className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">No worktrees found</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Create your first worktree to start working on features in parallel.
                </p>
                <Button onClick={onCreateWorktree}>
                  <GitBranch className="w-4 h-4 mr-2" />
                  Create Worktree
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <Button variant="ghost" onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={onCreateWorktree}>
              <GitBranch className="w-4 h-4 mr-2" />
              Create New Worktree
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteWorktreeConfirmDialog
        open={deleteWorktreeDialogOpen}
        onOpenChange={setDeleteWorktreeDialogOpen}
        worktree={selectedWorktreeForDelete}
        onConfirm={handleConfirmDelete}
      />

      {/* Merge Confirmation Dialog */}
      <MergeWorktreeConfirmDialog
        open={mergeWorktreeDialogOpen}
        onOpenChange={setMergeWorktreeDialogOpen}
        worktree={selectedWorktreeForMerge}
        onConfirm={handleMergeConfirmed}
      />

      {/* Rename Worktree Dialog */}
      <RenameWorktreeDialog
        open={renameWorktreeDialogOpen}
        onOpenChange={setRenameWorktreeDialogOpen}
        worktree={selectedWorktreeForRename}
        projectPath={projectPath}
        onRefresh={onRefresh}
      />
    </>
  );
}

interface WorktreeRowProps {
  worktree: WorktreeInfo;
  actionLabel: string | null;
  isActionInProgress: boolean;
  onOpenInTerminal: () => void;
  onDiscardChanges: () => void;
  onDelete?: () => void;
  onMerge?: () => void;
  onRename?: () => void;
}

function WorktreeRow({
  worktree,
  actionLabel,
  isActionInProgress,
  onOpenInTerminal,
  onDiscardChanges,
  onDelete,
  onMerge,
  onRename,
}: WorktreeRowProps) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <GitBranch className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium truncate">{worktree.branch}</span>
            {worktree.hasChanges ? (
              <Badge variant="destructive" className="text-xs">
                <AlertCircle className="w-3 h-3 mr-1" />
                {worktree.changedFilesCount} change{worktree.changedFilesCount !== 1 ? 's' : ''}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                <CheckCircle2 className="w-3 h-3 mr-1 text-green-500" />
                Clean
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{worktree.path}</p>
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {isActionInProgress ? (
          <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground">
            <Spinner size="xs" />
            <span>{actionLabel}</span>
          </div>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={onOpenInTerminal}
              title="Open in integrated terminal"
            >
              <Terminal className="w-4 h-4" />
            </Button>

            {worktree.hasChanges && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-orange-500 hover:text-orange-600 hover:bg-orange-500/10"
                onClick={onDiscardChanges}
                title="Discard changes"
              >
                <XCircle className="w-4 h-4" />
              </Button>
            )}

            {onMerge && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={onMerge}
                title="Merge to main"
              >
                <GitMerge className="w-4 h-4" />
              </Button>
            )}

            {onRename && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={onRename}
                title="Rename branch"
              >
                <Edit3 className="w-4 h-4" />
              </Button>
            )}

            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={onDelete}
                title="Delete worktree"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Delete Confirmation Dialog
interface DeleteWorktreeConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worktree: WorktreeInfo | null;
  onConfirm: (deleteBranch: boolean) => void;
}

function DeleteWorktreeConfirmDialog({
  open,
  onOpenChange,
  worktree,
  onConfirm,
}: DeleteWorktreeConfirmDialogProps) {
  const [deleteBranch, setDeleteBranch] = useState(false);

  // Reset state when dialog opens/closes
  useState(() => {
    if (!open) {
      setDeleteBranch(false);
    }
  });

  if (!worktree) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="w-5 h-5" />
            Delete Worktree
          </DialogTitle>
          <DialogDescription className="space-y-3">
            <span>
              Are you sure you want to delete the worktree for branch{' '}
              <code className="font-mono bg-muted px-1 rounded">{worktree.branch}</code>?
            </span>

            {worktree.hasChanges && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20 mt-2">
                <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <span className="text-yellow-500 text-sm">
                  This worktree has {worktree.changedFilesCount} uncommitted change(s). These will
                  be lost if you proceed.
                </span>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center space-x-2 py-4">
          <input
            type="checkbox"
            id="delete-branch"
            checked={deleteBranch}
            onChange={(e) => setDeleteBranch(e.target.checked)}
            className="h-4 w-4"
          />
          <label htmlFor="delete-branch" className="text-sm cursor-pointer select-none">
            Also delete the branch{' '}
            <code className="font-mono bg-muted px-1 rounded">{worktree.branch}</code>
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => onConfirm(deleteBranch)}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Merge Confirmation Dialog
interface MergeWorktreeConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worktree: WorktreeInfo | null;
  onConfirm: (deleteBranch: boolean) => void;
}

function MergeWorktreeConfirmDialog({
  open,
  onOpenChange,
  worktree,
  onConfirm,
}: MergeWorktreeConfirmDialogProps) {
  const [deleteBranch, setDeleteBranch] = useState(false);

  if (!worktree) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="w-5 h-5" />
            Merge Branch to Main
          </DialogTitle>
          <DialogDescription>
            Merge branch <code className="font-mono bg-muted px-1 rounded">{worktree.branch}</code>{' '}
            into the main branch. Make sure you have committed all changes before merging.
          </DialogDescription>
        </DialogHeader>

        {worktree.hasChanges && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20">
            <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
            <span className="text-yellow-500 text-sm">
              This worktree has {worktree.changedFilesCount} uncommitted change(s). Please commit or
              discard them before merging.
            </span>
          </div>
        )}

        <div className="flex items-center space-x-2 py-4">
          <input
            type="checkbox"
            id="delete-branch-after-merge"
            checked={deleteBranch}
            onChange={(e) => setDeleteBranch(e.target.checked)}
            className="h-4 w-4"
            disabled={worktree.hasChanges}
          />
          <label
            htmlFor="delete-branch-after-merge"
            className={cn(
              'text-sm cursor-pointer select-none',
              worktree.hasChanges && 'text-muted-foreground cursor-not-allowed'
            )}
          >
            Delete the branch{' '}
            <code className="font-mono bg-muted px-1 rounded">{worktree.branch}</code> after merge
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(deleteBranch)} disabled={worktree.hasChanges}>
            <GitMerge className="w-4 h-4 mr-2" />
            Merge
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Rename Worktree Dialog
interface RenameWorktreeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worktree: WorktreeInfo | null;
  projectPath: string;
  onRefresh: () => Promise<void>;
}

function RenameWorktreeDialog({
  open,
  onOpenChange,
  worktree,
  projectPath,
  onRefresh,
}: RenameWorktreeDialogProps) {
  const [newBranchName, setNewBranchName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens
  useState(() => {
    if (open && worktree) {
      setNewBranchName(worktree.branch);
      setError(null);
    }
  });

  const handleRename = async () => {
    if (!worktree || !newBranchName.trim()) return;

    // Validate branch name (git-compatible)
    const validBranchRegex = /^[a-zA-Z0-9._/-]+$/;
    if (!validBranchRegex.test(newBranchName)) {
      setError(
        'Invalid branch name. Use only letters, numbers, dots, underscores, hyphens, and slashes.'
      );
      return;
    }

    if (newBranchName === worktree.branch) {
      setError('New branch name must be different from the current name.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const api = getElectronAPI();
      if (!api?.git?.renameBranch) {
        setError('Rename API not available');
        return;
      }
      const result = await api.git.renameBranch(projectPath, worktree.branch, newBranchName);

      if (result.success) {
        toast.success('Branch renamed successfully', {
          description: `"${worktree.branch}" → "${newBranchName}"`,
        });
        onOpenChange(false);
        await onRefresh();
      } else {
        setError(result.error || 'Failed to rename branch');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to rename branch');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading && newBranchName.trim()) {
      handleRename();
    }
  };

  if (!worktree) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="w-5 h-5" />
            Rename Branch
          </DialogTitle>
          <DialogDescription>
            Rename the branch for this worktree. This will create a new branch and switch the
            worktree to it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="new-branch-name" className="text-sm font-medium">
              New Branch Name
            </label>
            <input
              id="new-branch-name"
              value={newBranchName}
              onChange={(e) => {
                setNewBranchName(e.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
              autoFocus
            />
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              <p className="mb-1">
                Current: <code className="bg-muted px-1 rounded">{worktree.branch}</code>
              </p>
              <p>This will rename the branch both locally and on the worktree.</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleRename} disabled={isLoading || !newBranchName.trim()}>
            {isLoading ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Renaming...
              </>
            ) : (
              <>
                <Edit3 className="w-4 h-4 mr-2" />
                Rename
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
