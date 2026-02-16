import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, GitMerge, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConflictResolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAbort: () => void;
  onViewConflicts: () => void;
  conflictFiles?: string[];
}

export function ConflictResolutionDialog({
  open,
  onOpenChange,
  onAbort,
  onViewConflicts,
  conflictFiles = [],
}: ConflictResolutionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Merge Conflicts Detected
          </DialogTitle>
          <DialogDescription>
            The pull resulted in merge conflicts that need to be resolved before continuing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Conflict explanation */}
          <div className="border border-destructive/50 bg-destructive/10 rounded-lg p-3 text-sm text-destructive">
            <div className="flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <strong>Conflicts detected:</strong> Changes from the remote branch conflict with
                your local changes. You need to resolve these conflicts manually before the merge
                can be completed.
              </div>
            </div>
          </div>

          {/* Conflict files list */}
          {conflictFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Files with conflicts:</p>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-muted/30 p-2">
                {conflictFiles.map((file) => (
                  <div
                    key={file}
                    className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent/50 rounded"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    <span className="font-mono text-xs truncate flex-1">{file}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resolution instructions */}
          <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-2">
            <p className="font-medium">How to resolve conflicts:</p>
            <ol className="space-y-1 list-decimal list-inside text-muted-foreground">
              <li>
                Open conflicted files and look for conflict markers (
                <span className="font-mono">&lt;&lt;&lt;&lt;&lt;&lt;&lt;</span>,{' '}
                <span className="font-mono">======</span>,{' '}
                <span className="font-mono">&gt;&gt;&gt;&gt;&gt;&gt;&gt;</span>)
              </li>
              <li>Edit the files to keep the changes you want</li>
              <li>Remove the conflict markers</li>
              <li>Stage the resolved files</li>
              <li>Complete the merge with a commit</li>
            </ol>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <p className="text-sm font-medium">What would you like to do?</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="justify-start" onClick={onViewConflicts}>
                <GitMerge className="h-4 w-4 mr-2" />
                View Conflicts
              </Button>
              <Button
                variant="outline"
                className="justify-start text-destructive hover:text-destructive"
                onClick={onAbort}
              >
                <X className="h-4 w-4 mr-2" />
                Abort Merge
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={onViewConflicts}>
            <Check className="h-4 w-4 mr-2" />
            Resolve Conflicts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
