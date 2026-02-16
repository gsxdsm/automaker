import { useState, useEffect } from 'react';
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
import { Label } from '@/components/ui/label';
import { GitBranch, Edit2 } from 'lucide-react';
import { useRenameBranch } from '@/hooks/queries';
import { toast } from 'sonner';

interface BranchRenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectPath: string;
  branchName?: string; // If undefined, rename current branch
  isCurrentBranch?: boolean;
}

export function BranchRenameDialog({
  open,
  onOpenChange,
  projectPath,
  branchName,
  isCurrentBranch = false,
}: BranchRenameDialogProps) {
  const [newName, setNewName] = useState('');

  const renameBranchMutation = useRenameBranch();

  useEffect(() => {
    if (open) {
      setNewName(branchName || '');
    }
  }, [open, branchName]);

  const handleRename = async () => {
    if (!newName.trim()) {
      toast.error('Branch name is required');
      return;
    }

    // Validate branch name format
    const validName = /^[a-zA-Z0-9-_\/]+$/;
    if (!validName.test(newName)) {
      toast.error('Invalid branch name', {
        description:
          'Branch names can only contain letters, numbers, hyphens, underscores, and forward slashes',
      });
      return;
    }

    try {
      await renameBranchMutation.mutateAsync({
        projectPath,
        oldName: branchName,
        newName: newName.trim(),
      });

      toast.success('Branch renamed', {
        description: isCurrentBranch
          ? `Current branch renamed to "${newName}"`
          : `"${branchName}" renamed to "${newName}"`,
      });

      setNewName('');
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to rename branch', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleRename();
    }
  };

  const title = isCurrentBranch ? 'Rename Current Branch' : 'Rename Branch';
  const description = isCurrentBranch
    ? 'Rename the current branch. This will update the branch name locally.'
    : branchName
      ? `Rename "${branchName}" to a new name.`
      : 'Rename the current branch.';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="new-branch-name">New Branch Name</Label>
            <Input
              id="new-branch-name"
              placeholder="feature/new-branch-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyPress}
              autoFocus
              autoComplete="off"
            />
          </div>

          {branchName && (
            <div className="text-sm text-muted-foreground">
              Renaming: <span className="font-mono font-medium">{branchName}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleRename} disabled={renameBranchMutation.isPending}>
            {renameBranchMutation.isPending ? (
              <>Renaming...</>
            ) : (
              <>
                <Edit2 className="h-4 w-4 mr-2" />
                Rename Branch
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
