import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useDeleteBranch } from '@/hooks/queries';
import { toast } from 'sonner';

interface BranchDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectPath: string;
  branchName: string;
  hasUncommittedChanges?: boolean;
  isMerged?: boolean;
}

export function BranchDeleteDialog({
  open,
  onOpenChange,
  projectPath,
  branchName,
  hasUncommittedChanges = false,
  isMerged = true,
}: BranchDeleteDialogProps) {
  const [forceDelete, setForceDelete] = useState(false);
  const [confirmName, setConfirmName] = useState('');

  const deleteBranchMutation = useDeleteBranch();

  const handleDelete = async () => {
    if (confirmName !== branchName) {
      toast.error('Please confirm by typing the branch name');
      return;
    }

    try {
      await deleteBranchMutation.mutateAsync({
        projectPath,
        branchName,
        force: forceDelete,
      });

      toast.success('Branch deleted', {
        description: `"${branchName}" has been deleted`,
      });

      setConfirmName('');
      setForceDelete(false);
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to delete branch', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const needsForce = !isMerged || hasUncommittedChanges;
  const showWarning = needsWarning();

  function needsWarning() {
    if (hasUncommittedChanges) {
      return {
        title: 'Branch has uncommitted changes',
        message:
          'This branch contains uncommitted changes that will be lost. Please commit or stash changes first.',
        type: 'danger',
      };
    }
    if (!isMerged) {
      return {
        title: 'Branch has not been merged',
        message:
          'This branch has not been merged into the current branch. Deleting it will lose all commits unique to this branch.',
        type: 'warning',
      };
    }
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Delete Branch
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{' '}
            <span className="font-mono font-medium">{branchName}</span>?
            {showWarning && (
              <div className="mt-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle
                    className={`h-4 w-4 mt-0.5 ${showWarning.type === 'danger' ? 'text-destructive' : 'text-yellow-600'}`}
                  />
                  <div>
                    <div
                      className={`font-medium text-sm ${showWarning.type === 'danger' ? 'text-destructive' : 'text-yellow-700'}`}
                    >
                      {showWarning.title}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{showWarning.message}</div>
                  </div>
                </div>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!hasUncommittedChanges && !isMerged && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="force-delete"
                checked={forceDelete}
                onCheckedChange={(checked) => setForceDelete(checked === true)}
              />
              <Label htmlFor="force-delete" className="text-sm font-normal cursor-pointer flex-1">
                Force delete (unmerged branches)
              </Label>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="confirm-name">
              Type <span className="font-mono">{branchName}</span> to confirm
            </Label>
            <Input
              id="confirm-name"
              placeholder={branchName}
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              autoFocus
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setConfirmName('');
              setForceDelete(false);
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={
              confirmName !== branchName ||
              deleteBranchMutation.isPending ||
              (!forceDelete && !isMerged)
            }
          >
            {deleteBranchMutation.isPending ? (
              <>Deleting...</>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Branch
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
