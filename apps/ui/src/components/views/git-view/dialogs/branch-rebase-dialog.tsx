import { useState, useCallback, useMemo } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GitBranch, ArrowRight, Eye, AlertTriangle, FileText } from 'lucide-react';
import { useRebaseBranch } from '@/hooks/queries';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';

// Constants for magic strings
const REMOTE_BRANCH_SEPARATOR = '/';

interface BranchRebaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectPath: string;
  currentBranch: string;
  availableBranches: string[];
  onConflictsDetected?: (conflicts: string[]) => void;
}

export function BranchRebaseDialog({
  open,
  onOpenChange,
  projectPath,
  currentBranch,
  availableBranches,
  onConflictsDetected,
}: BranchRebaseDialogProps) {
  const [upstreamBranch, setUpstreamBranch] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewDiffs, setPreviewDiffs] = useState<string>('');
  const [previewCommits, setPreviewCommits] = useState<string[]>([]);

  const rebaseBranchMutation = useRebaseBranch();

  // Filter out current branch and remote branches from available options (memoized)
  const rebaseableBranches = useMemo(
    () =>
      availableBranches.filter((b) => b !== currentBranch && !b.includes(REMOTE_BRANCH_SEPARATOR)),
    [availableBranches, currentBranch]
  );

  // Load preview using git rebase --dry-run
  const loadPreview = useCallback(async () => {
    if (!upstreamBranch) return;

    setPreviewLoading(true);
    setShowPreview(true);
    try {
      const api = (
        window as {
          electron?: {
            api?: {
              git?: {
                getRebasePreview: (
                  path: string,
                  branch: string
                ) => Promise<{
                  success: boolean;
                  diff?: string;
                  commits?: string[];
                  error?: string;
                }>;
              };
            };
          };
        }
      )?.electron?.api;
      if (api?.git?.getRebasePreview) {
        // Get rebase preview
        const result = await api.git.getRebasePreview(projectPath, upstreamBranch);
        if (result.success) {
          setPreviewDiffs(result.diff || '');
          setPreviewCommits(result.commits || []);
        } else {
          toast.error('Failed to load preview', {
            description: result.error,
          });
        }
      } else {
        toast.error('Git API not available', {
          description: 'The git preview feature is not currently available',
        });
      }
    } catch (error) {
      toast.error('Failed to load preview', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setPreviewLoading(false);
    }
  }, [upstreamBranch, projectPath]);

  const handleRebase = async () => {
    if (!upstreamBranch) {
      toast.error('Please select an upstream branch');
      return;
    }

    if (upstreamBranch === currentBranch) {
      toast.error('Cannot rebase a branch onto itself');
      return;
    }

    try {
      const result = await rebaseBranchMutation.mutateAsync({
        projectPath,
        branchName: upstreamBranch,
      });

      // Check for conflicts - the result may have conflicts property even if not typed
      const resultWithConflicts = result as {
        success: boolean;
        conflicts?: string[];
        error?: string;
      };
      if (resultWithConflicts.conflicts && resultWithConflicts.conflicts.length > 0) {
        toast.error('Rebase conflicts detected', {
          description: `${resultWithConflicts.conflicts.length} file(s) have conflicts during rebase`,
        });
        if (onConflictsDetected) {
          onConflictsDetected(resultWithConflicts.conflicts);
        }
        return;
      }

      if (result.success) {
        toast.success('Rebase completed', {
          description: `"${currentBranch}" rebased onto "${upstreamBranch}"`,
        });

        setUpstreamBranch('');
        setShowPreview(false);
        setPreviewDiffs('');
        setPreviewCommits([]);
        onOpenChange(false);
      }
    } catch (error) {
      // Check if error contains conflicts information
      const errorWithConflicts = error as { message?: string; conflicts?: string[] };
      if (errorWithConflicts.conflicts && errorWithConflicts.conflicts.length > 0) {
        toast.error('Rebase conflicts detected', {
          description: `${errorWithConflicts.conflicts.length} file(s) have conflicts during rebase`,
        });
        if (onConflictsDetected) {
          onConflictsDetected(errorWithConflicts.conflicts);
        }
        return;
      }

      toast.error('Failed to rebase branch', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleUpstreamBranchChange = useCallback((value: string) => {
    setUpstreamBranch(value);
    setShowPreview(false);
    setPreviewDiffs('');
    setPreviewCommits([]);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Rebase Branch</DialogTitle>
          <DialogDescription>
            Rebase <span className="font-mono">{currentBranch}</span> onto another branch. This will
            rewrite the branch history.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          <Tabs defaultValue="rebase" className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="rebase">Rebase Settings</TabsTrigger>
              <TabsTrigger value="preview" disabled={!upstreamBranch}>
                Preview Changes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="rebase" className="flex-1 overflow-y-auto mt-4 space-y-4">
              <div className="flex items-center justify-center gap-2 text-sm p-4 rounded-lg bg-muted/30">
                <span className="font-mono text-brand-500 font-medium">{currentBranch}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono">{upstreamBranch || 'upstream branch'}</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="upstream-branch">Upstream Branch</Label>
                <Select value={upstreamBranch} onValueChange={handleUpstreamBranchChange}>
                  <SelectTrigger id="upstream-branch">
                    <SelectValue placeholder="Select upstream branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {rebaseableBranches.map((branch) => (
                      <SelectItem key={branch} value={branch}>
                        {branch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Rebase info */}
              <div className="space-y-3">
                <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-start gap-2 text-xs">
                    <GitBranch className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                    <div className="text-blue-700">
                      <div className="font-medium mb-1">What is Rebase?</div>
                      <div className="text-muted-foreground">
                        Rebasing moves all commits from the current branch to the tip of the
                        upstream branch, creating a linear history. Your commits will be replayed
                        one by one.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20">
                  <div className="flex items-start gap-2 text-xs">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                    <div className="text-yellow-700">
                      <div className="font-medium mb-1">Rewrite History Warning</div>
                      <div className="text-muted-foreground">
                        Rebasing rewrites history. Avoid rebasing branches that have been pushed and
                        shared with others, as it will require force-push and may cause issues for
                        collaborators.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="flex-1 overflow-hidden flex flex-col mt-4">
              {!showPreview ? (
                <div className="flex-1 flex items-center justify-center">
                  <Button
                    variant="outline"
                    onClick={loadPreview}
                    disabled={!upstreamBranch || previewLoading}
                  >
                    {previewLoading ? (
                      <>
                        <Spinner size="sm" className="mr-2" />
                        Loading preview...
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4 mr-2" />
                        Preview Changes
                      </>
                    )}
                  </Button>
                </div>
              ) : previewLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <Spinner size="md" />
                    <p className="text-sm text-muted-foreground">Loading preview...</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-hidden flex flex-col space-y-3">
                  {/* Summary */}
                  <div className="flex items-center gap-3 text-sm p-3 rounded-lg bg-muted/30">
                    {previewCommits.length > 0 ? (
                      <>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>{previewCommits.length} commits to rebase</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">No commits to rebase</span>
                    )}
                  </div>

                  {/* Commits list */}
                  {previewCommits.length > 0 && (
                    <ScrollArea className="h-48 rounded-md border bg-background">
                      <div className="p-2 space-y-1">
                        {previewCommits.map((commit, index) => (
                          <div
                            key={index}
                            className="p-2 rounded text-xs hover:bg-accent/50 font-mono"
                          >
                            <span className="text-muted-foreground mr-2">{index + 1}.</span>
                            {commit}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}

                  {/* Diff preview */}
                  {previewDiffs && (
                    <ScrollArea className="flex-1 rounded-md border bg-background">
                      <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-all">
                        {previewDiffs}
                      </pre>
                    </ScrollArea>
                  )}

                  {/* Potential conflicts warning */}
                  <div className="p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20">
                    <div className="flex items-start gap-2 text-xs">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                      <div className="text-yellow-700">
                        <div className="font-medium mb-1">Dry Run Preview</div>
                        <div className="text-muted-foreground">
                          This is a preview based on the merge-base. Actual rebase may result in
                          conflicts if commits modify the same lines.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleRebase}
            disabled={!upstreamBranch || rebaseBranchMutation.isPending}
          >
            {rebaseBranchMutation.isPending ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Rebasing...
              </>
            ) : (
              <>
                <GitBranch className="h-4 w-4 mr-2" />
                Rebase
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
