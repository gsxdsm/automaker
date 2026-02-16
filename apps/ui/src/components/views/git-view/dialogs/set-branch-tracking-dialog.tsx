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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Cloud, Loader2 } from 'lucide-react';
import { useRemotes, useBranches, useSetBranchUpstream } from '@/hooks/queries';
import { toast } from 'sonner';
import { extractRemoteBranchName, GIT_TOAST_MESSAGES } from './git-utils';

interface SetBranchTrackingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectPath: string;
  currentBranch: string;
}

/**
 * Dialog for setting branch upstream tracking configuration.
 * Allows selecting a remote and remote branch to track for the current branch.
 */
export function SetBranchTrackingDialog({
  open,
  onOpenChange,
  projectPath,
  currentBranch,
}: SetBranchTrackingDialogProps) {
  const [selectedRemote, setSelectedRemote] = useState<string>('');
  const [selectedRemoteBranch, setSelectedRemoteBranch] = useState<string>('');

  // Queries
  const { data: remotes = [], isLoading: isLoadingRemotes } = useRemotes(projectPath, open);
  const { data: allBranches = [], isLoading: isLoadingBranches } = useBranches(
    projectPath,
    true,
    open
  );

  // Mutation
  const setUpstreamMutation = useSetBranchUpstream();

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedRemote('');
      setSelectedRemoteBranch('');
    }
  }, [open]);

  // Computed values
  const isPending = setUpstreamMutation.isPending;
  const isLoading = isLoadingRemotes || isLoadingBranches;

  // Get remote branches for selected remote (memoized)
  const remoteBranches = useMemo(() => {
    if (!selectedRemote) return [];
    return allBranches.filter((b) => b.isRemote && b.name.startsWith(`${selectedRemote}/`));
  }, [allBranches, selectedRemote]);

  /**
   * Set the branch tracking configuration
   */
  const handleSetTracking = useCallback(async () => {
    if (!selectedRemote || !selectedRemoteBranch) {
      toast.error(GIT_TOAST_MESSAGES.VALIDATION_ERROR_SELECT_BRANCHES);
      return;
    }

    try {
      await setUpstreamMutation.mutateAsync({
        projectPath,
        branch: currentBranch,
        remote: selectedRemote,
        remoteBranch: extractRemoteBranchName(selectedRemoteBranch, selectedRemote),
      });

      const successMsg = GIT_TOAST_MESSAGES.TRACKING_CONFIGURED(
        currentBranch,
        selectedRemoteBranch
      );
      toast.success(successMsg.title, {
        description: successMsg.description,
      });

      onOpenChange(false);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      const failureMsg = GIT_TOAST_MESSAGES.TRACKING_FAILED(errorMsg);
      toast.error(failureMsg.title, {
        description: failureMsg.description,
      });
    }
  }, [
    selectedRemote,
    selectedRemoteBranch,
    projectPath,
    currentBranch,
    setUpstreamMutation,
    onOpenChange,
  ]);

  /**
   * Handle remote selection change
   */
  const handleRemoteChange = useCallback((value: string) => {
    setSelectedRemote(value);
    setSelectedRemoteBranch(''); // Reset branch selection when remote changes
  }, []);

  /**
   * Get display name for a remote branch
   */
  const getRemoteBranchDisplayName = useCallback(
    (branch: { name: string }) => {
      return extractRemoteBranchName(branch.name, selectedRemote);
    },
    [selectedRemote]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Set Branch Tracking
          </DialogTitle>
          <DialogDescription>
            Configure the upstream branch for <span className="font-mono">{currentBranch}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Remote selection */}
          <div className="space-y-2">
            <Label htmlFor="remote">Remote</Label>
            <Select
              value={selectedRemote}
              onValueChange={handleRemoteChange}
              disabled={isPending || isLoading}
            >
              <SelectTrigger id="remote">
                <SelectValue placeholder="Select remote" />
              </SelectTrigger>
              <SelectContent>
                {remotes.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    No remotes configured
                  </div>
                ) : (
                  remotes.map((remote) => (
                    <SelectItem key={remote.name} value={remote.name}>
                      {remote.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Remote branch selection */}
          {selectedRemote && (
            <div className="space-y-2">
              <Label htmlFor="remote-branch">Remote Branch</Label>
              <Select
                value={selectedRemoteBranch}
                onValueChange={setSelectedRemoteBranch}
                disabled={isPending || isLoadingBranches}
              >
                <SelectTrigger id="remote-branch">
                  <SelectValue placeholder="Select remote branch" />
                </SelectTrigger>
                <SelectContent>
                  {remoteBranches.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No branches found for this remote
                    </div>
                  ) : (
                    remoteBranches.map((branch) => {
                      const displayName = getRemoteBranchDisplayName(branch);
                      return (
                        <SelectItem key={branch.name} value={branch.name}>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs">{displayName}</span>
                          </div>
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Info box */}
          <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
            <p>
              Setting branch tracking allows you to use simple{' '}
              <span className="font-mono">git pull</span> and{' '}
              <span className="font-mono">git push</span> commands without specifying the remote and
              branch.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSetTracking}
            disabled={!selectedRemote || !selectedRemoteBranch || isPending || isLoading}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Setting...
              </>
            ) : (
              <>
                <Cloud className="h-4 w-4 mr-2" />
                Set Tracking
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
