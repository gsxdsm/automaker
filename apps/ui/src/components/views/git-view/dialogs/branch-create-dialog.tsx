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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GitBranch, CheckCircle2 } from 'lucide-react';
import { useCreateBranch } from '@/hooks/queries';
import { toast } from 'sonner';

interface BranchCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectPath: string;
  availableBranches: string[];
}

export function BranchCreateDialog({
  open,
  onOpenChange,
  projectPath,
  availableBranches,
}: BranchCreateDialogProps) {
  const [branchName, setBranchName] = useState('');
  const [startPoint, setStartPoint] = useState('HEAD');

  const createBranchMutation = useCreateBranch();

  const handleCreate = async () => {
    if (!branchName.trim()) {
      toast.error('Branch name is required');
      return;
    }

    // Validate branch name format
    const validName = /^[a-zA-Z0-9-_\/]+$/;
    if (!validName.test(branchName)) {
      toast.error('Invalid branch name', {
        description:
          'Branch names can only contain letters, numbers, hyphens, underscores, and forward slashes',
      });
      return;
    }

    try {
      await createBranchMutation.mutateAsync({
        projectPath,
        branchName: branchName.trim(),
        startPoint: startPoint !== 'HEAD' ? startPoint : undefined,
      });

      toast.success('Branch created', {
        description: `"${branchName}" created from ${startPoint}`,
      });

      setBranchName('');
      setStartPoint('HEAD');
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to create branch', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCreate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Branch</DialogTitle>
          <DialogDescription>
            Create a new branch from an existing one. The new branch will start at the same commit
            as the base branch.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="branch-name">Branch Name</Label>
            <Input
              id="branch-name"
              placeholder="feature/my-new-feature"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              onKeyDown={handleKeyPress}
              autoFocus
              autoComplete="off"
            />
            <p className="text-[10px] text-muted-foreground">
              Use feature/, bugfix/, or hotfix/ prefixes for better organization
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="start-point">Base Branch</Label>
            <Select value={startPoint} onValueChange={setStartPoint}>
              <SelectTrigger id="start-point">
                <SelectValue placeholder="Select base branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HEAD">HEAD (current position)</SelectItem>
                {availableBranches
                  .filter((b) => !b.includes('/')) // Only show local branches
                  .map((branch) => (
                    <SelectItem key={branch} value={branch}>
                      {branch}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={createBranchMutation.isPending}>
            {createBranchMutation.isPending ? (
              <>Creating...</>
            ) : (
              <>
                <GitBranch className="h-4 w-4 mr-2" />
                Create Branch
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
