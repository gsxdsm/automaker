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
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowDownUp, Cloud, AlertTriangle, Loader2 } from 'lucide-react';
import { usePullChanges, usePushChanges, useRemotes, useBranches } from '@/hooks/queries';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { extractRemoteBranchName, isMergeConflictError, GIT_TOAST_MESSAGES } from './git-utils';

type Operation = 'pull' | 'push';

interface PushPullDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectPath: string;
  defaultOperation?: Operation;
  defaultBranch?: string;
  currentBranch?: string;
}

/**
 * Dialog for pushing and pulling changes from git remotes.
 * Supports multi-remote selection, force push warnings, and rebase options.
 */
export function PushPullDialog({
  open,
  onOpenChange,
  projectPath,
  defaultOperation = 'pull',
  defaultBranch = '',
  currentBranch = '',
}: PushPullDialogProps) {
  const [operation, setOperation] = useState<Operation>(defaultOperation);
  const [selectedRemote, setSelectedRemote] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState(defaultBranch || currentBranch || '');
  const [forcePush, setForcePush] = useState(false);
  const [setUpstream, setSetUpstream] = useState(false);
  const [useRebase, setUseRebase] = useState(false);
  const [showForceWarning, setShowForceWarning] = useState(false);

  // Queries
  const { data: remotes = [], isLoading: isLoadingRemotes } = useRemotes(projectPath, open);
  const { data: allBranches = [], isLoading: isLoadingBranches } = useBranches(
    projectPath,
    true,
    open
  );

  // Mutations
  const pullMutation = usePullChanges();
  const pushMutation = usePushChanges();

  // Set default remote when available
  useEffect(() => {
    if (remotes.length > 0 && !selectedRemote) {
      setSelectedRemote(remotes[0].name);
    }
  }, [remotes, selectedRemote]);

  // Reset defaults when dialog opens
  useEffect(() => {
    if (open) {
      setOperation(defaultOperation);
      setSelectedBranch(defaultBranch || currentBranch || '');
      setForcePush(false);
      setSetUpstream(false);
      setUseRebase(false);
      setShowForceWarning(false);
    }
  }, [open, defaultOperation, defaultBranch, currentBranch]);

  // Computed values (memoized for performance)
  const isPending = pullMutation.isPending || pushMutation.isPending;
  const isLoading = isLoadingRemotes || isLoadingBranches;

  // Filter branches based on operation (memoized to avoid recalculating on every render)
  const branchesForOperation = useMemo(() => {
    if (operation === 'pull') {
      return allBranches.filter((b) => b.isRemote && b.name.startsWith(`${selectedRemote}/`));
    }
    return allBranches.filter((b) => !b.isRemote);
  }, [allBranches, operation, selectedRemote]);

  /**
   * Execute the pull or push operation
   */
  const handleExecute = useCallback(async () => {
    if (!selectedRemote) {
      toast.error(GIT_TOAST_MESSAGES.VALIDATION_ERROR_SELECT_REMOTE);
      return;
    }

    if (operation === 'pull') {
      try {
        await pullMutation.mutateAsync({
          projectPath,
          remote: selectedRemote,
          branch: selectedBranch || undefined,
          options: { rebase: useRebase },
        });

        const successMsg = GIT_TOAST_MESSAGES.PULL_SUCCESS(selectedRemote);
        toast.success(successMsg.title, {
          description: successMsg.description,
        });

        onOpenChange(false);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';

        if (isMergeConflictError(errorMsg)) {
          toast.error(GIT_TOAST_MESSAGES.PULL_CONFLICTS.title, {
            description: GIT_TOAST_MESSAGES.PULL_CONFLICTS.description,
          });
        } else {
          const failureMsg = GIT_TOAST_MESSAGES.PULL_FAILED(errorMsg);
          toast.error(failureMsg.title, {
            description: failureMsg.description,
          });
        }
      }
    } else {
      // Push operation
      if (forcePush && !showForceWarning) {
        setShowForceWarning(true);
        return;
      }

      try {
        await pushMutation.mutateAsync({
          projectPath,
          remote: selectedRemote,
          branch: selectedBranch || undefined,
          options: { force: forcePush, setUpstream },
        });

        const successMsg = GIT_TOAST_MESSAGES.PUSH_SUCCESS(selectedBranch, selectedRemote);
        toast.success(successMsg.title, {
          description: successMsg.description,
        });

        onOpenChange(false);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        const failureMsg = GIT_TOAST_MESSAGES.PUSH_FAILED(errorMsg);
        toast.error(failureMsg.title, {
          description: failureMsg.description,
        });
      }
    }
  }, [
    operation,
    selectedRemote,
    selectedBranch,
    useRebase,
    forcePush,
    setUpstream,
    showForceWarning,
    projectPath,
    pullMutation,
    pushMutation,
    onOpenChange,
  ]);

  /**
   * Get display name for a branch
   */
  const getBranchDisplayName = useCallback(
    (branch: { name: string }) => {
      if (operation === 'pull') {
        return extractRemoteBranchName(branch.name, selectedRemote);
      }
      return branch.name;
    },
    [operation, selectedRemote]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {operation === 'pull' ? (
              <>
                <ArrowDownUp className="h-5 w-5" />
                Pull Changes
              </>
            ) : (
              <>
                <Cloud className="h-5 w-5" />
                Push Changes
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {operation === 'pull'
              ? 'Fetch and merge changes from a remote branch'
              : 'Push local commits to a remote repository'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Operation toggle */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={operation === 'pull' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setOperation('pull')}
              disabled={isPending}
            >
              <ArrowDownUp className="h-4 w-4 mr-2" />
              Pull
            </Button>
            <Button
              type="button"
              variant={operation === 'push' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setOperation('push')}
              disabled={isPending}
            >
              <Cloud className="h-4 w-4 mr-2" />
              Push
            </Button>
          </div>

          {/* Remote selection */}
          <div className="space-y-2">
            <Label htmlFor="remote">Remote</Label>
            <Select value={selectedRemote} onValueChange={setSelectedRemote} disabled={isPending}>
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
                      <div className="flex items-center gap-2">
                        <span>{remote.name}</span>
                        {remote.fetchUrl && (
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                            ({remote.fetchUrl})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Branch selection */}
          {selectedRemote && (
            <div className="space-y-2">
              <Label htmlFor="branch">
                {operation === 'pull' ? 'Remote Branch' : 'Local Branch'}
              </Label>
              <Select
                value={selectedBranch}
                onValueChange={setSelectedBranch}
                disabled={isPending || isLoadingBranches}
              >
                <SelectTrigger id="branch">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branchesForOperation.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No branches available
                    </div>
                  ) : (
                    branchesForOperation.map((branch) => {
                      const displayName = getBranchDisplayName(branch);
                      return (
                        <SelectItem key={branch.name} value={branch.name}>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs">{displayName}</span>
                            {branch.ahead && branch.ahead > 0 && (
                              <span className="text-[10px] text-green-500">↑{branch.ahead}</span>
                            )}
                            {branch.behind && branch.behind > 0 && (
                              <span className="text-[10px] text-orange-500">↓{branch.behind}</span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Push options */}
          {operation === 'push' && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="set-upstream"
                  checked={setUpstream}
                  onCheckedChange={(checked) => setSetUpstream(checked === true)}
                  disabled={isPending}
                />
                <Label htmlFor="set-upstream" className="text-sm font-normal cursor-pointer flex-1">
                  Set upstream (track this branch)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="force-push"
                  checked={forcePush}
                  onCheckedChange={(checked) => {
                    setForcePush(checked === true);
                    if (checked === false) setShowForceWarning(false);
                  }}
                  disabled={isPending}
                />
                <Label
                  htmlFor="force-push"
                  className={cn(
                    'text-sm font-normal cursor-pointer flex-1',
                    forcePush && 'text-destructive'
                  )}
                >
                  Force push (overwrite remote)
                </Label>
              </div>
            </div>
          )}

          {/* Pull options */}
          {operation === 'pull' && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="use-rebase"
                checked={useRebase}
                onCheckedChange={(checked) => setUseRebase(checked === true)}
                disabled={isPending}
              />
              <Label htmlFor="use-rebase" className="text-sm font-normal cursor-pointer flex-1">
                Use rebase instead of merge
              </Label>
            </div>
          )}

          {/* Force push warning */}
          {showForceWarning && (
            <div className="border border-destructive/50 bg-destructive/10 rounded-lg p-3 text-sm text-destructive">
              <div className="flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <strong>Warning:</strong> Force pushing will overwrite the remote branch history.
                  This can cause data loss for collaborators. Are you sure?
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setShowForceWarning(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 text-xs"
                      onClick={handleExecute}
                      disabled={isPending}
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Pushing...
                        </>
                      ) : (
                        'Force Push Anyway'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          {!showForceWarning && (
            <Button onClick={handleExecute} disabled={!selectedRemote || isPending || isLoading}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {operation === 'pull' ? 'Pulling...' : 'Pushing...'}
                </>
              ) : (
                <>
                  {operation === 'pull' ? (
                    <>
                      <ArrowDownUp className="h-4 w-4 mr-2" />
                      Pull
                    </>
                  ) : (
                    <>
                      <Cloud className="h-4 w-4 mr-2" />
                      Push
                    </>
                  )}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
