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
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GitMerge, Eye, AlertTriangle, FileText } from 'lucide-react';
import { useMergeBranch } from '@/hooks/queries';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';

// Constants for magic strings
const DIALOG_CLOSE_DELAY = 100;
const REMOTE_BRANCH_SEPARATOR = '/';

interface BranchMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectPath: string;
  currentBranch: string;
  availableBranches: string[];
  onConflictsDetected?: (conflicts: string[]) => void;
}

export function BranchMergeDialog({
  open,
  onOpenChange,
  projectPath,
  currentBranch,
  availableBranches,
  onConflictsDetected,
}: BranchMergeDialogProps) {
  const [sourceBranch, setSourceBranch] = useState('');
  const [noCommit, setNoCommit] = useState(false);
  const [noFF, setNoFF] = useState(false);
  const [squash, setSquash] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewDiffs, setPreviewDiffs] = useState<string>('');
  const [previewFiles, setPreviewFiles] = useState<string[]>([]);

  const mergeBranchMutation = useMergeBranch();

  // Filter out current branch and remote branches from available options (memoized)
  const mergeableBranches = useMemo(
    () =>
      availableBranches.filter((b) => b !== currentBranch && !b.includes(REMOTE_BRANCH_SEPARATOR)),
    [availableBranches, currentBranch]
  );

  // Load preview using git diff to see what would change
  const loadPreview = useCallback(async () => {
    if (!sourceBranch) return;

    setPreviewLoading(true);
    setShowPreview(true);
    try {
      const api = (
        window as {
          electron?: {
            api?: {
              git?: {
                getMergePreview: (
                  path: string,
                  branch: string
                ) => Promise<{ success: boolean; diff?: string; files?: string[]; error?: string }>;
              };
            };
          };
        }
      )?.electron?.api;
      if (api?.git?.getMergePreview) {
        // Get diff preview using merge-base
        const diffResult = await api.git.getMergePreview(projectPath, sourceBranch);
        if (diffResult.success) {
          setPreviewDiffs(diffResult.diff || '');
          setPreviewFiles(diffResult.files || []);
        } else {
          toast.error('Failed to load preview', {
            description: diffResult.error,
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
  }, [sourceBranch, projectPath]);

  const handleMerge = async () => {
    if (!sourceBranch) {
      toast.error('Please select a branch to merge');
      return;
    }

    if (sourceBranch === currentBranch) {
      toast.error('Cannot merge a branch into itself');
      return;
    }

    try {
      const result = await mergeBranchMutation.mutateAsync({
        projectPath,
        branchName: sourceBranch,
        options: { noCommit, noFF, squash },
      });

      // Check for conflicts - the result may have conflicts property even if not typed
      const resultWithConflicts = result as {
        success: boolean;
        conflicts?: string[];
        error?: string;
      };
      if (resultWithConflicts.conflicts && resultWithConflicts.conflicts.length > 0) {
        toast.error('Merge conflicts detected', {
          description: `${resultWithConflicts.conflicts.length} file(s) have conflicts`,
        });
        if (onConflictsDetected) {
          onConflictsDetected(resultWithConflicts.conflicts);
        }
        return;
      }

      if (result.success) {
        toast.success('Branch merged', {
          description: `"${sourceBranch}" merged into "${currentBranch}"`,
        });

        setSourceBranch('');
        setNoCommit(false);
        setNoFF(false);
        setSquash(false);
        setShowPreview(false);
        setPreviewDiffs('');
        setPreviewFiles([]);
        onOpenChange(false);
      }
    } catch (error) {
      // Check if error contains conflicts information
      const errorWithConflicts = error as { message?: string; conflicts?: string[] };
      if (errorWithConflicts.conflicts && errorWithConflicts.conflicts.length > 0) {
        toast.error('Merge conflicts detected', {
          description: `${errorWithConflicts.conflicts.length} file(s) have conflicts`,
        });
        if (onConflictsDetected) {
          onConflictsDetected(errorWithConflicts.conflicts);
        }
        return;
      }

      toast.error('Failed to merge branch', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleSourceBranchChange = useCallback((value: string) => {
    setSourceBranch(value);
    setShowPreview(false);
    setPreviewDiffs('');
    setPreviewFiles([]);
  }, []);

  // Parse preview stats (memoized to avoid recalculation on every render)
  const stats = useMemo(() => {
    const additions = (previewDiffs.match(/^\+/gm) || []).length;
    const deletions = (previewDiffs.match(/^-/gm) || []).length;
    return { additions, deletions };
  }, [previewDiffs]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Merge Branch</DialogTitle>
          <DialogDescription>
            Merge <span className="font-mono">source branch</span> into{' '}
            <span className="font-mono">{currentBranch}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          <Tabs defaultValue="merge" className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="merge">Merge Settings</TabsTrigger>
              <TabsTrigger value="preview" disabled={!sourceBranch}>
                Preview Changes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="merge" className="flex-1 overflow-y-auto mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="source-branch">Source Branch</Label>
                <Select value={sourceBranch} onValueChange={handleSourceBranchChange}>
                  <SelectTrigger id="source-branch">
                    <SelectValue placeholder="Select branch to merge" />
                  </SelectTrigger>
                  <SelectContent>
                    {mergeableBranches.map((branch) => (
                      <SelectItem key={branch} value={branch}>
                        {branch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Merge Strategy</Label>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="no-commit"
                    checked={noCommit}
                    onCheckedChange={(checked) => setNoCommit(checked === true)}
                  />
                  <Label htmlFor="no-commit" className="text-sm font-normal cursor-pointer flex-1">
                    No commit (perform merge but don't auto-commit)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="no-ff"
                    checked={noFF}
                    onCheckedChange={(checked) => setNoFF(checked === true)}
                  />
                  <Label htmlFor="no-ff" className="text-sm font-normal cursor-pointer flex-1">
                    No fast-forward (always create a merge commit)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="squash"
                    checked={squash}
                    onCheckedChange={(checked) => setSquash(checked === true)}
                  />
                  <Label htmlFor="squash" className="text-sm font-normal cursor-pointer flex-1">
                    Squash (combine all commits into one)
                  </Label>
                </div>
              </div>

              {/* Conflict Warning */}
              {(noCommit || noFF || squash) && (
                <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-start gap-2 text-xs">
                    <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                    <div className="text-blue-700">
                      <div className="font-medium mb-1">Merge Strategy Note</div>
                      <div className="text-muted-foreground">
                        {squash
                          ? 'Squashing combines all commits into a single new commit, preserving a linear history.'
                          : noFF
                            ? 'A merge commit will always be created, even when fast-forward is possible.'
                            : 'No commit will be created automatically. You can review changes before committing.'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="preview" className="flex-1 overflow-hidden flex flex-col mt-4">
              {!showPreview ? (
                <div className="flex-1 flex items-center justify-center">
                  <Button
                    variant="outline"
                    onClick={loadPreview}
                    disabled={!sourceBranch || previewLoading}
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
                    {previewFiles.length > 0 ? (
                      <>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>{previewFiles.length} files changed</span>
                        {stats.additions > 0 && (
                          <Badge variant="default" className="bg-green-500/20 text-green-400">
                            +{stats.additions}
                          </Badge>
                        )}
                        {stats.deletions > 0 && (
                          <Badge variant="default" className="bg-red-500/20 text-red-400">
                            -{stats.deletions}
                          </Badge>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">No changes detected</span>
                    )}
                  </div>

                  {/* Diff preview */}
                  <ScrollArea className="flex-1 rounded-md border bg-background">
                    {previewDiffs ? (
                      <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-all">
                        {previewDiffs}
                      </pre>
                    ) : (
                      <div className="p-8 text-center text-muted-foreground text-sm">
                        No diff preview available
                      </div>
                    )}
                  </ScrollArea>

                  {/* Potential conflicts warning */}
                  <div className="p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20">
                    <div className="flex items-start gap-2 text-xs">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                      <div className="text-yellow-700">
                        <div className="font-medium mb-1">Dry Run Preview</div>
                        <div className="text-muted-foreground">
                          This is a preview based on the merge-base. Actual merge may result in
                          conflicts that need to be resolved.
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
          <Button onClick={handleMerge} disabled={!sourceBranch || mergeBranchMutation.isPending}>
            {mergeBranchMutation.isPending ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Merging...
              </>
            ) : (
              <>
                <GitMerge className="h-4 w-4 mr-2" />
                Merge
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
