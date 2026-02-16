import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  GitCommit,
  GitBranch,
  RefreshCw,
  GitPullRequest,
  Archive,
  FolderTree,
  Plus,
  Settings,
  X,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import { CommitDialog } from './dialogs';
import { QuickCommitFAB } from '@/components/ui/mobile';

interface GitActionPanelProps {
  isCollapsed: boolean;
  onCollapseChange: (collapsed: boolean) => void;
  isMobile: boolean;
  commitDialogOpen?: boolean;
  onCommitDialogOpenChange?: (open: boolean) => void;
}

type ActionCategory = 'commit' | 'branch' | 'merge' | 'stash' | 'settings';

// Constants
const DEFAULT_BRANCH = 'main';

// Quick actions configuration - extracted to avoid recreation on each render
const QUICK_ACTIONS = [
  {
    category: 'commit' as ActionCategory,
    label: 'Commit',
    icon: GitCommit,
    shortcut: '⌘K',
    description: 'Commit staged changes',
    color: 'text-green-400',
    actionType: 'commit' as const,
  },
  {
    category: 'branch' as ActionCategory,
    label: 'New Branch',
    icon: GitBranch,
    shortcut: undefined,
    description: 'Create a new branch',
    color: 'text-blue-400',
    actionType: 'new-branch' as const,
  },
  {
    category: 'branch' as ActionCategory,
    label: 'Switch Branch',
    icon: RefreshCw,
    shortcut: undefined,
    description: 'Switch to another branch',
    color: 'text-purple-400',
    actionType: 'switch-branch' as const,
  },
  {
    category: 'merge' as ActionCategory,
    label: 'Merge',
    icon: GitPullRequest,
    shortcut: undefined,
    description: 'Merge branches',
    color: 'text-orange-400',
    actionType: 'merge' as const,
  },
  {
    category: 'merge' as ActionCategory,
    label: 'Rebase',
    icon: RefreshCw,
    shortcut: undefined,
    description: 'Rebase current branch',
    color: 'text-yellow-400',
    actionType: 'rebase' as const,
  },
  {
    category: 'stash' as ActionCategory,
    label: 'Stash',
    icon: Archive,
    shortcut: undefined,
    description: 'Stash uncommitted changes',
    color: 'text-cyan-400',
    actionType: 'stash' as const,
  },
  {
    category: 'stash' as ActionCategory,
    label: 'Worktree',
    icon: FolderTree,
    shortcut: undefined,
    description: 'Create new worktree',
    color: 'text-pink-400',
    actionType: 'worktree' as const,
  },
  {
    category: 'settings' as ActionCategory,
    label: 'Settings',
    icon: Settings,
    shortcut: undefined,
    description: 'Git configuration',
    color: 'text-gray-400',
    actionType: 'settings' as const,
  },
] as const;

type QuickActionType = (typeof QUICK_ACTIONS)[number]['actionType'];

// Dialog components to avoid duplication
interface BranchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchName: string;
  onBranchNameChange: (name: string) => void;
  branchBase: string;
  onBranchBaseChange: (base: string) => void;
  onSubmit: () => void;
  inputId: string;
}

function BranchDialog({
  open,
  onOpenChange,
  branchName,
  onBranchNameChange,
  branchBase,
  onBranchBaseChange,
  onSubmit,
  inputId,
}: BranchDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Branch</DialogTitle>
          <DialogDescription>Create a new branch from an existing one</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor={inputId}>Branch Name</Label>
            <Input
              id={inputId}
              placeholder="feature/my-new-feature"
              value={branchName}
              onChange={(e) => onBranchNameChange(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${inputId}-base`}>Base Branch</Label>
            <Select value={branchBase} onValueChange={onBranchBaseChange}>
              <SelectTrigger id={`${inputId}-base`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main">main</SelectItem>
                <SelectItem value="develop">develop</SelectItem>
                <SelectItem value="feat-git-editor">feat-git-editor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit}>
            <GitBranch className="h-4 w-4 mr-2" />
            Create Branch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GitActionPanel({
  isCollapsed,
  onCollapseChange,
  isMobile,
  commitDialogOpen: externalCommitDialogOpen = false,
  onCommitDialogOpenChange: externalSetCommitDialogOpen,
}: GitActionPanelProps) {
  // Use internal state if not controlled from parent
  const [internalCommitDialogOpen, setInternalCommitDialogOpen] = useState(false);
  const commitDialogOpen = externalCommitDialogOpen ?? internalCommitDialogOpen;
  const setCommitDialogOpen = externalSetCommitDialogOpen ?? setInternalCommitDialogOpen;
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [branchBase, setBranchBase] = useState(DEFAULT_BRANCH);
  const { currentProject } = useAppStore();

  // Handle keyboard shortcut for commit (Cmd/Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k' && !e.shiftKey) {
        e.preventDefault();
        setCommitDialogOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCreateBranch = useCallback(() => {
    if (!newBranchName.trim()) {
      toast.error('Branch name is required');
      return;
    }
    toast.success('Branch created', {
      description: `${newBranchName} from ${branchBase}`,
    });
    setBranchDialogOpen(false);
    setNewBranchName('');
    setBranchBase(DEFAULT_BRANCH);
  }, [newBranchName, branchBase]);

  const handleQuickAction = useCallback((actionType: QuickActionType) => {
    switch (actionType) {
      case 'commit':
        setCommitDialogOpen(true);
        break;
      case 'new-branch':
        setBranchDialogOpen(true);
        break;
      case 'switch-branch':
        toast.info('Switch branch coming soon');
        break;
      case 'merge':
        toast.info('Merge coming soon');
        break;
      case 'rebase':
        toast.info('Rebase coming soon');
        break;
      case 'stash':
        toast.info('Stash coming soon');
        break;
      case 'worktree':
        toast.info('Create worktree coming soon');
        break;
      case 'settings':
        toast.info('Git settings coming soon');
        break;
    }
  }, []);

  // Mobile view: full panel
  if (isMobile) {
    return (
      <>
        {/* Quick Commit FAB - Always visible on mobile for easy access */}
        {currentProject && (
          <QuickCommitFAB
            onCommit={() => setCommitDialogOpen(true)}
            position="bottom-right"
            additionalActions={[
              {
                id: 'branch',
                label: 'New Branch',
                icon: GitBranch,
                onClick: () => setBranchDialogOpen(true),
                color: 'bg-blue-500',
              },
              {
                id: 'stash',
                label: 'Stash',
                icon: Archive,
                onClick: () => toast.info('Stash coming soon'),
                color: 'bg-cyan-500',
              },
            ]}
          />
        )}

        <div className="h-full flex flex-col bg-card border-l border-border">
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-3 border-b border-border bg-muted/30">
            <Plus className="h-4 w-4 text-brand-500" />
            <span className="font-medium text-sm">Quick Actions</span>
          </div>

          {/* Actions grid */}
          <div className="flex-1 overflow-y-auto p-3 pb-20">
            <div className="grid grid-cols-2 gap-2">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors touch-manipulation"
                    style={{ minHeight: 88 }}
                    onClick={() => handleQuickAction(action.actionType)}
                  >
                    <div className={cn('p-2 rounded bg-muted', action.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-medium">{action.label}</div>
                      {action.shortcut && (
                        <div className="text-[10px] text-muted-foreground">{action.shortcut}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* New Commit Dialog */}
          {currentProject && (
            <CommitDialog
              open={commitDialogOpen}
              onOpenChange={setCommitDialogOpen}
              projectPath={currentProject.path}
            />
          )}

          {/* Branch Dialog */}
          <BranchDialog
            open={branchDialogOpen}
            onOpenChange={setBranchDialogOpen}
            branchName={newBranchName}
            onBranchNameChange={setNewBranchName}
            branchBase={branchBase}
            onBranchBaseChange={setBranchBase}
            onSubmit={handleCreateBranch}
            inputId="branch-name-mobile"
          />
        </div>
      </>
    );
  }

  // Desktop collapsed view
  if (isCollapsed) {
    return (
      <div className="h-full flex flex-col bg-card border-l border-border w-12 items-center">
        <div className="flex items-center justify-center py-3 w-full border-b border-border">
          <Plus className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Action icons */}
        <div className="flex flex-col gap-1 py-2 w-full">
          <button
            className="flex items-center justify-center py-2 hover:bg-accent/50 transition-colors text-green-400"
            onClick={() => setCommitDialogOpen(true)}
            title="Commit"
          >
            <GitCommit className="h-4 w-4" />
          </button>
          <button
            className="flex items-center justify-center py-2 hover:bg-accent/50 transition-colors text-blue-400"
            onClick={() => setBranchDialogOpen(true)}
            title="New Branch"
          >
            <GitBranch className="h-4 w-4" />
          </button>
          <button
            className="flex items-center justify-center py-2 hover:bg-accent/50 transition-colors text-purple-400"
            onClick={() => toast.info('Switch branch coming soon')}
            title="Switch Branch"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Expand button */}
        <div className="mt-auto">
          <button
            className="flex items-center justify-center py-2 w-full hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
            onClick={() => onCollapseChange(false)}
            title="Expand panel"
          >
            <Plus className="h-4 w-4" /> {/* Using as left arrow */}
          </button>
        </div>

        {/* New Commit Dialog */}
        {currentProject && (
          <CommitDialog
            open={commitDialogOpen}
            onOpenChange={setCommitDialogOpen}
            projectPath={currentProject.path}
          />
        )}

        {/* Branch Dialog */}
        <BranchDialog
          open={branchDialogOpen}
          onOpenChange={setBranchDialogOpen}
          branchName={newBranchName}
          onBranchNameChange={setNewBranchName}
          branchBase={branchBase}
          onBranchBaseChange={setBranchBase}
          onSubmit={handleCreateBranch}
          inputId="branch-name-collapsed"
        />
      </div>
    );
  }

  // Desktop expanded view
  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
        <Plus className="h-4 w-4 text-brand-500" />
        <span className="font-medium text-xs text-muted-foreground uppercase tracking-wide flex-1">
          Quick Actions
        </span>
        <button
          className="p-0.5 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground"
          onClick={() => onCollapseChange(true)}
          title="Collapse panel"
        >
          <Plus className="h-3 w-3" /> {/* Using as right arrow */}
        </button>
      </div>

      {/* Actions list */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-1">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-accent/50 transition-colors rounded group"
                onClick={() => handleQuickAction(action.actionType)}
              >
                <div className={cn('p-1.5 rounded bg-muted', action.color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{action.label}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {action.description}
                  </div>
                </div>
                {action.shortcut && (
                  <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                    {action.shortcut}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer status */}
      <div className="border-t border-border p-2 bg-muted/10">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <CheckCircle2 className="h-3 w-3 text-green-400" />
          <span>Working tree clean</span>
        </div>
      </div>

      {/* New Commit Dialog */}
      {currentProject && (
        <CommitDialog
          open={commitDialogOpen}
          onOpenChange={setCommitDialogOpen}
          projectPath={currentProject.path}
        />
      )}

      {/* Branch Dialog */}
      <BranchDialog
        open={branchDialogOpen}
        onOpenChange={setBranchDialogOpen}
        branchName={newBranchName}
        onBranchNameChange={setNewBranchName}
        branchBase={branchBase}
        onBranchBaseChange={setBranchBase}
        onSubmit={handleCreateBranch}
        inputId="branch-name-desktop"
      />
    </div>
  );
}
