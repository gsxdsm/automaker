import { useState, useCallback, useMemo } from 'react';
import {
  Archive,
  Plus,
  Trash2,
  RefreshCw,
  Check,
  X,
  Eye,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/app-store';
import { useStashList } from '@/hooks/queries/use-git';
import {
  useSaveStash,
  useApplyStash,
  usePopStash,
  useDropStash,
  useClearStashes,
} from '@/hooks/mutations/use-git-mutations';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { StashDiffDialog } from './dialogs/stash-dialog';
import { SwipeableStashItem } from './components';
import type { StashEntry } from './types';

interface GitStashManagementProps {
  isMobile?: boolean;
}

// Constants
const COPY_FEEDBACK_TIMEOUT_MS = 2000;
const DEFAULT_STASH_MESSAGE_PLACEHOLDER = 'WIP: Work in progress...';

export function GitStashManagement({ isMobile = false }: GitStashManagementProps) {
  const { currentProject } = useAppStore();
  const projectPath = currentProject?.path;

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [stashMessage, setStashMessage] = useState('');
  const [includeUntracked, setIncludeUntracked] = useState(false);
  const [selectedStash, setSelectedStash] = useState<StashEntry | null>(null);
  const [diffDialogOpen, setDiffDialogOpen] = useState(false);
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [pendingActionStash, setPendingActionStash] = useState<{
    index: number;
    action: 'apply' | 'pop' | 'drop';
  } | null>(null);

  // Queries and mutations
  const { data: stashes = [], isLoading } = useStashList(projectPath);
  const saveStash = useSaveStash();
  const applyStash = useApplyStash();
  const popStash = usePopStash();
  const dropStash = useDropStash();
  const clearStashes = useClearStashes();

  // Compute combined loading state for stash operations
  const isStashOperationPending = useMemo(
    () => applyStash.isPending || popStash.isPending || dropStash.isPending,
    [applyStash.isPending, popStash.isPending, dropStash.isPending]
  );

  const hasStashes = stashes.length > 0;

  const handleCreateStash = useCallback(async () => {
    if (!projectPath) {
      toast.error('No project selected');
      return;
    }
    if (!stashMessage.trim()) {
      toast.error('Please enter a stash message');
      return;
    }

    try {
      await saveStash.mutateAsync({
        projectPath,
        message: stashMessage,
        includeUntracked,
      });
      // Reset form state on success
      setCreateDialogOpen(false);
      setStashMessage('');
      setIncludeUntracked(false);
    } catch (error) {
      // Error is already handled by the mutation hook
      console.error('Failed to create stash:', error);
    }
  }, [projectPath, stashMessage, includeUntracked, saveStash]);

  const handleApplyStash = useCallback(
    async (index: number) => {
      if (!projectPath) return;
      setPendingActionStash({ index, action: 'apply' });
      try {
        await applyStash.mutateAsync({ projectPath, index });
      } finally {
        setPendingActionStash(null);
      }
    },
    [projectPath, applyStash]
  );

  const handlePopStash = useCallback(
    async (index: number) => {
      if (!projectPath) return;
      setPendingActionStash({ index, action: 'pop' });
      try {
        await popStash.mutateAsync({ projectPath, index });
      } finally {
        setPendingActionStash(null);
      }
    },
    [projectPath, popStash]
  );

  const handleDropStash = useCallback(
    async (index: number) => {
      if (!projectPath) return;
      setPendingActionStash({ index, action: 'drop' });
      try {
        await dropStash.mutateAsync({ projectPath, index });
      } finally {
        setPendingActionStash(null);
      }
    },
    [projectPath, dropStash]
  );

  const handleClearAll = useCallback(async () => {
    if (!projectPath) return;
    try {
      await clearStashes.mutateAsync({ projectPath });
      setClearAllDialogOpen(false);
    } catch (error) {
      console.error('Failed to clear stashes:', error);
    }
  }, [projectPath, clearStashes]);

  const handleViewDiff = useCallback((stash: StashEntry) => {
    setSelectedStash(stash);
    setDiffDialogOpen(true);
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Header with stash count */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Archive className="h-4 w-4 text-brand-500" />
          <span className="font-medium text-xs text-muted-foreground uppercase tracking-wide">
            Stashes
          </span>
          <span className="text-xs text-muted-foreground/60">({stashes.length})</span>
        </div>
        {hasStashes && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-destructive hover:text-destructive"
            onClick={() => setClearAllDialogOpen(true)}
            disabled={clearStashes.isPending}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clear All
          </Button>
        )}
      </div>

      {/* Stash list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
            Loading stashes...
          </div>
        ) : !hasStashes ? (
          <div className="px-3 py-8 text-center">
            <Archive className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground mb-1">No stashes yet</p>
            <p className="text-xs text-muted-foreground/60 mb-4">
              Stash uncommitted changes to save them for later
            </p>
          </div>
        ) : (
          <div className="py-1">
            {stashes.map((stash) =>
              isMobile ? (
                <SwipeableStashItem
                  key={`${stash.ref}-${stash.index}`}
                  stash={stash}
                  onApply={() => handleApplyStash(stash.index)}
                  onPop={() => handlePopStash(stash.index)}
                  onDrop={() => handleDropStash(stash.index)}
                  onViewDiff={() => handleViewDiff(stash)}
                  isPending={isStashOperationPending}
                  pendingAction={
                    pendingActionStash?.index === stash.index
                      ? pendingActionStash.action
                      : undefined
                  }
                />
              ) : (
                <StashItem
                  key={`${stash.ref}-${stash.index}`}
                  stash={stash}
                  onApply={() => handleApplyStash(stash.index)}
                  onPop={() => handlePopStash(stash.index)}
                  onDrop={() => handleDropStash(stash.index)}
                  onViewDiff={() => handleViewDiff(stash)}
                  isMobile={false}
                  isPending={isStashOperationPending}
                  pendingAction={
                    pendingActionStash?.index === stash.index
                      ? pendingActionStash.action
                      : undefined
                  }
                />
              )
            )}
          </div>
        )}
      </div>

      {/* Create stash button */}
      <div className="p-2 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 h-8 text-xs"
          onClick={() => setCreateDialogOpen(true)}
          disabled={!projectPath || saveStash.isPending}
        >
          <Plus className="h-3 w-3" />
          Stash Changes
        </Button>
      </div>

      {/* Create stash dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Stash</DialogTitle>
            <DialogDescription>
              Save your uncommitted changes to a stash for later use.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="stash-message">Message</Label>
              <Input
                id="stash-message"
                placeholder={DEFAULT_STASH_MESSAGE_PLACEHOLDER}
                value={stashMessage}
                onChange={(e) => setStashMessage(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleCreateStash();
                  }
                }}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-untracked"
                checked={includeUntracked}
                onCheckedChange={(checked) => setIncludeUntracked(checked as boolean)}
              />
              <Label htmlFor="include-untracked" className="text-sm font-normal cursor-pointer">
                Include untracked files
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={saveStash.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateStash}
              disabled={saveStash.isPending || !stashMessage.trim()}
            >
              <Archive className="h-4 w-4 mr-2" />
              {saveStash.isPending ? 'Saving...' : 'Save Stash'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear all confirmation dialog */}
      <ConfirmDialog
        open={clearAllDialogOpen}
        onOpenChange={setClearAllDialogOpen}
        onConfirm={handleClearAll}
        title="Clear all stashes?"
        description={`This will permanently delete all ${stashes.length} stash${stashes.length !== 1 ? 'es' : ''}. This action cannot be undone.`}
        icon={Trash2}
        iconClassName="text-destructive"
        confirmText={clearStashes.isPending ? 'Clearing...' : 'Clear All'}
        cancelText="Cancel"
        confirmVariant="destructive"
      />

      {/* Stash diff dialog */}
      <StashDiffDialog
        stash={selectedStash}
        open={diffDialogOpen}
        onOpenChange={setDiffDialogOpen}
        projectPath={projectPath}
      />
    </div>
  );
}

interface StashItemProps {
  stash: StashEntry;
  onApply: () => void;
  onPop: () => void;
  onDrop: () => void;
  onViewDiff: () => void;
  isMobile: boolean;
  isPending: boolean;
  pendingAction?: 'apply' | 'pop' | 'drop';
}

function StashItem({
  stash,
  onApply,
  onPop,
  onDrop,
  onViewDiff,
  isMobile,
  isPending,
  pendingAction,
}: StashItemProps) {
  const [expanded, setExpanded] = useState(false);

  // Parse message to extract branch info if available
  const { branchInfo, displayMessage } = useMemo(() => {
    const messageParts = stash.message.split(': ');
    const branch = messageParts.length > 1 ? messageParts[0] : null;
    const message = messageParts.length > 1 ? messageParts.slice(1).join(': ') : stash.message;
    return { branchInfo: branch, displayMessage: message };
  }, [stash.message]);

  // Check if this specific stash is being operated on
  const isThisStashPending = isPending && pendingAction !== undefined;

  return (
    <div className="border-b border-border/50 last:border-0">
      {/* Main row */}
      <div
        className={cn(
          'flex items-start gap-2 px-3 py-2 text-sm hover:bg-accent/50 cursor-pointer group',
          isMobile && 'px-2 py-3'
        )}
      >
        <button
          className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors mt-0.5"
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? 'Collapse stash details' : 'Expand stash details'}
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>

        <Archive className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium truncate">{displayMessage}</span>
            {branchInfo && (
              <span className="text-[9px] text-muted-foreground shrink-0">on {branchInfo}</span>
            )}
            {isThisStashPending && (
              <span className="text-[9px] text-brand-500 shrink-0 flex items-center gap-1">
                <AlertTriangle className="h-2 w-2" />
                {pendingAction === 'apply'
                  ? 'Applying...'
                  : pendingAction === 'pop'
                    ? 'Popping...'
                    : pendingAction === 'drop'
                      ? 'Dropping...'
                      : 'Processing...'}
              </span>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground font-mono">
            {stash.hash.slice(0, 7)}
          </div>
        </div>

        {/* Actions */}
        <div
          className={cn(
            'flex items-center gap-0.5',
            isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}
        >
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            title="View diff"
            onClick={onViewDiff}
            disabled={isPending}
          >
            <Eye className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            title="Apply stash"
            onClick={onApply}
            disabled={isPending}
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            title="Pop stash"
            onClick={onPop}
            disabled={isPending}
          >
            <Check className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
            title="Drop stash"
            onClick={onDrop}
            disabled={isPending}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-2 ml-7 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 py-1">
            <span className="font-mono text-[10px]">{stash.ref}</span>
          </div>
          <div className="text-[10px] text-muted-foreground/60 mt-1">
            Stash index: {stash.index}
          </div>
        </div>
      )}
    </div>
  );
}
