import { useState, useCallback, useMemo } from 'react';
import {
  GitBranch,
  RefreshCw,
  Trash2,
  Edit2,
  GitMerge,
  ArrowDownUp,
  Cloud,
  Check,
  ChevronDown,
  ChevronRight,
  Plus,
  Globe,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/store/app-store';
import {
  useBranches,
  useCurrentBranch,
  useRemotes,
  useCheckoutBranch,
  usePullChanges,
  usePushChanges,
} from '@/hooks/queries';
import {
  BranchCreateDialog,
  BranchRenameDialog,
  BranchDeleteDialog,
  BranchMergeDialog,
  BranchRebaseDialog,
  PushPullDialog,
  RemoteManagementDialog,
  SetBranchTrackingDialog,
} from './dialogs';
import { toast } from 'sonner';
import type { GitBranchData, RemoteFilter } from './git-branch-management.types';
import {
  BRANCH_GROUP_LOCAL,
  REMOTE_FILTERS,
  getBranchGroupLabel,
} from './git-branch-management.types';

interface GitBranchManagementProps {
  isMobile?: boolean;
}

export function GitBranchManagement({ isMobile = false }: GitBranchManagementProps) {
  const { currentProject } = useAppStore();
  const projectPath = currentProject?.path ?? '';

  // UI state
  const [remoteFilter, setRemoteFilter] = useState<RemoteFilter>(REMOTE_FILTERS.ALL);
  const [selectedRemote, setSelectedRemote] = useState<string>(REMOTE_FILTERS.ALL);
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [rebaseDialogOpen, setRebaseDialogOpen] = useState(false);
  const [pushPullDialogOpen, setPushPullDialogOpen] = useState(false);
  const [remoteManagementDialogOpen, setRemoteManagementDialogOpen] = useState(false);
  const [setTrackingDialogOpen, setSetTrackingDialogOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string>('');

  // Queries
  const {
    data: branches = [],
    isLoading: isLoadingBranches,
    refetch: refetchBranches,
  } = useBranches(projectPath, true, !!projectPath);

  const { data: currentBranch = '' } = useCurrentBranch(projectPath, !!projectPath);

  const { data: remotes = [] } = useRemotes(projectPath, !!projectPath);

  // Mutations
  const checkoutMutation = useCheckoutBranch();
  const pullMutation = usePullChanges();
  const pushMutation = usePushChanges();

  // Derived state - memoized filters
  const localBranches = useMemo(
    () => branches.filter((b: GitBranchData) => !b.isRemote),
    [branches]
  );

  const remoteBranches = useMemo(
    () => branches.filter((b: GitBranchData) => b.isRemote),
    [branches]
  );

  // Filter branches based on UI state
  const filteredBranches = useMemo(() => {
    let result = branches;

    // Filter by local/remote
    if (remoteFilter !== REMOTE_FILTERS.ALL) {
      result = result.filter((b: GitBranchData) =>
        remoteFilter === REMOTE_FILTERS.LOCAL ? !b.isRemote : b.isRemote
      );
    }

    // Filter by selected remote (for remote branches)
    if (remoteFilter === REMOTE_FILTERS.REMOTE && selectedRemote !== REMOTE_FILTERS.ALL) {
      result = result.filter((b: GitBranchData) => b.name.startsWith(`${selectedRemote}/`));
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((b: GitBranchData) => b.name.toLowerCase().includes(query));
    }

    return result;
  }, [branches, remoteFilter, selectedRemote, searchQuery]);

  // Group branches for display
  const groupedBranches = useMemo(() => {
    const groups: Record<string, GitBranchData[]> = {};

    for (const branch of filteredBranches) {
      if (branch.isRemote) {
        // Extract remote name from branch name (e.g., "origin/main" -> "origin")
        const parts = branch.name.split('/');
        const remote = parts[0] || 'other';
        if (!groups[remote]) {
          groups[remote] = [];
        }
        groups[remote].push(branch);
      } else {
        // Local branches
        if (!groups[BRANCH_GROUP_LOCAL]) {
          groups[BRANCH_GROUP_LOCAL] = [];
        }
        groups[BRANCH_GROUP_LOCAL].push(branch);
      }
    }

    return groups;
  }, [filteredBranches]);

  const toggleBranchExpanded = useCallback((branchName: string) => {
    setExpandedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(branchName)) {
        next.delete(branchName);
      } else {
        next.add(branchName);
      }
      return next;
    });
  }, []);

  const handleCheckout = async (branchName: string) => {
    try {
      await checkoutMutation.mutateAsync({
        projectPath,
        branchName,
      });
      toast.success('Checked out branch', {
        description: `Now on "${branchName}"`,
      });
    } catch (error) {
      toast.error('Failed to checkout branch', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handlePull = async (branch: GitBranchData) => {
    if (!branch.tracking) {
      toast.info('No tracking branch', {
        description: 'Set an upstream branch to pull changes',
      });
      return;
    }

    const [remote, ...branchParts] = branch.tracking.split('/');
    const remoteBranch = branchParts.join('/');

    try {
      await pullMutation.mutateAsync({
        projectPath,
        remote,
        branch: remoteBranch,
      });
      toast.success('Pulled changes', {
        description: `Updated ${branch.name} from ${branch.tracking}`,
      });
    } catch (error) {
      toast.error('Failed to pull changes', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handlePush = async (branch: GitBranchData) => {
    const remote = selectedRemote !== REMOTE_FILTERS.ALL ? selectedRemote : remotes[0]?.name;
    if (!remote) {
      toast.error('No remote configured');
      return;
    }

    try {
      await pushMutation.mutateAsync({
        projectPath,
        remote,
        branch: branch.name,
        options: { setUpstream: !branch.tracking },
      });
      toast.success('Pushed changes', {
        description: `Pushed ${branch.name} to ${remote}/${branch.name}`,
      });
    } catch (error) {
      toast.error('Failed to push changes', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const openRenameDialog = useCallback((branchName: string) => {
    setSelectedBranch(branchName);
    setRenameDialogOpen(true);
  }, []);

  const openDeleteDialog = useCallback((branchName: string) => {
    setSelectedBranch(branchName);
    setDeleteDialogOpen(true);
  }, []);

  const openMergeDialog = useCallback((branchName: string) => {
    setSelectedBranch(branchName);
    setMergeDialogOpen(true);
  }, []);

  const openRebaseDialog = useCallback(() => {
    setRebaseDialogOpen(true);
  }, []);

  // Memoized render functions for better performance
  const renderAheadBehindBadge = useCallback((branch: GitBranchData) => {
    const hasAhead = branch.ahead && branch.ahead > 0;
    const hasBehind = branch.behind && branch.behind > 0;

    if (!hasAhead && !hasBehind) return null;

    return (
      <div className="flex items-center gap-1 text-[10px]">
        {hasAhead && (
          <Badge
            variant="outline"
            className="h-4 px-1 text-[9px] bg-green-500/10 text-green-400 border-green-500/20"
          >
            ↑{branch.ahead}
          </Badge>
        )}
        {hasBehind && (
          <Badge
            variant="outline"
            className="h-4 px-1 text-[9px] bg-orange-500/10 text-orange-400 border-orange-500/20"
          >
            ↓{branch.behind}
          </Badge>
        )}
      </div>
    );
  }, []);

  const renderBranchItem = useCallback(
    (branch: GitBranchData) => {
      const isExpanded = expandedBranches.has(branch.name);
      const isCurrent = branch.name === currentBranch || (branch.current && !branch.isRemote);
      const isRemote = branch.isRemote;

      return (
        <div
          key={branch.name}
          className={cn('group relative hover:bg-accent/30', isCurrent && 'bg-accent/50')}
        >
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer',
              isMobile && 'py-3'
            )}
          >
            {/* Expand/collapse */}
            <button
              className="shrink-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
              onClick={() => toggleBranchExpanded(branch.name)}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>

            {/* Branch icon */}
            <GitBranch
              className={cn(
                'h-3.5 w-3.5 shrink-0',
                isCurrent ? 'text-brand-500' : 'text-muted-foreground',
                branch.hasUncommittedChanges && 'text-yellow-400'
              )}
            />

            {/* Branch name */}
            <span className={cn('flex-1 truncate font-mono text-xs', isCurrent && 'font-medium')}>
              {branch.name}
            </span>

            {/* Status indicators */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Current branch indicator */}
              {isCurrent && <Check className="h-3.5 w-3.5 text-brand-500 shrink-0" />}

              {/* Uncommitted changes */}
              {branch.hasUncommittedChanges && (
                <div
                  className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0"
                  title="Uncommitted changes"
                />
              )}

              {/* Ahead/Behind badges */}
              {renderAheadBehindBadge(branch)}

              {/* Tracking indicator */}
              {branch.tracking && !isRemote && (
                <div className="shrink-0" title={`Tracks ${branch.tracking}`}>
                  <Cloud className="h-3 w-3 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div
              className={cn(
                'flex items-center gap-0.5 shrink-0',
                'opacity-0 group-hover:opacity-100',
                'transition-opacity'
              )}
            >
              {!isRemote && !isCurrent && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  title="Checkout"
                  onClick={() => handleCheckout(branch.name)}
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              )}

              {!isRemote && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    title="Rename"
                    onClick={() => openRenameDialog(branch.name)}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  {!isCurrent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      title="Delete"
                      onClick={() => openDeleteDialog(branch.name)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </>
              )}

              {isRemote && isCurrent && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  title="Pull"
                  onClick={() => handlePull(branch)}
                >
                  <ArrowDownUp className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Expanded details */}
          {isExpanded && (
            <div className="px-3 pb-2 pl-10 text-xs text-muted-foreground">
              <div className="space-y-1">
                {branch.message && (
                  <div className="truncate" title={branch.message}>
                    {branch.message}
                  </div>
                )}
                {branch.commit && (
                  <div className="font-mono text-[10px] opacity-70">
                    {branch.commit.slice(0, 8)}
                  </div>
                )}
                {branch.tracking && (
                  <div className="flex items-center gap-1">
                    <Cloud className="h-3 w-3" />
                    <span>Tracks {branch.tracking}</span>
                  </div>
                )}

                {/* Quick actions for expanded branch */}
                {!isRemote && (
                  <div className="flex items-center gap-2 pt-2 mt-2 border-t border-border">
                    {branch.ahead && branch.ahead > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => handlePush(branch)}
                      >
                        <Cloud className="h-3 w-3 mr-1" />
                        Push
                      </Button>
                    )}
                    {branch.behind && branch.behind > 0 && branch.tracking && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => handlePull(branch)}
                      >
                        <ArrowDownUp className="h-3 w-3 mr-1" />
                        Pull
                      </Button>
                    )}
                    {!isCurrent && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => openMergeDialog(branch.name)}
                        >
                          <GitMerge className="h-3 w-3 mr-1" />
                          Merge
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      );
    },
    [
      expandedBranches,
      currentBranch,
      toggleBranchExpanded,
      handleCheckout,
      handlePull,
      handlePush,
      openRenameDialog,
      openDeleteDialog,
      openMergeDialog,
      renderAheadBehindBadge,
      isMobile,
      projectPath,
      selectedRemote,
      remotes,
    ]
  );

  // Memoize the options passed to renderBranchItem via dependency
  const renderBranchItemMemoized = useCallback(renderBranchItem, [renderBranchItem]);

  return (
    <div className="h-full flex flex-col">
      {/* Header with controls */}
      <div className="flex items-center gap-2 p-2 border-b border-border bg-muted/20">
        {/* Remote filter */}
        <Select value={remoteFilter} onValueChange={(v: RemoteFilter) => setRemoteFilter(v)}>
          <SelectTrigger className="h-7 w-24 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={REMOTE_FILTERS.ALL}>All</SelectItem>
            <SelectItem value={REMOTE_FILTERS.LOCAL}>Local</SelectItem>
            <SelectItem value={REMOTE_FILTERS.REMOTE}>Remote</SelectItem>
          </SelectContent>
        </Select>

        {/* Remote selector (when showing remote branches) */}
        {remoteFilter === REMOTE_FILTERS.REMOTE && remotes.length > 0 && (
          <Select value={selectedRemote} onValueChange={setSelectedRemote}>
            <SelectTrigger className="h-7 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={REMOTE_FILTERS.ALL}>All Remotes</SelectItem>
              {remotes.map((remote: { name: string }) => (
                <SelectItem key={remote.name} value={remote.name}>
                  {remote.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Search */}
        <input
          type="text"
          placeholder="Filter branches..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={cn(
            'flex-1 h-7 px-2 text-xs bg-transparent border-0 rounded',
            'placeholder:text-muted-foreground focus:outline-none focus:ring-0'
          )}
        />

        {/* Refresh */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => refetchBranches()}
          disabled={isLoadingBranches}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isLoadingBranches && 'animate-spin')} />
        </Button>

        {/* New branch */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs gap-1"
          onClick={() => setCreateDialogOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          {!isMobile && 'New'}
        </Button>
      </div>

      {/* Branch list */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingBranches ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            Loading branches...
          </div>
        ) : filteredBranches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <GitBranch className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">No branches found</p>
            {searchQuery && <p className="text-xs mt-1">Try adjusting your filter or search</p>}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {/* Render grouped branches */}
            {Object.entries(groupedBranches).map(([groupName, groupBranches]) => (
              <div key={groupName}>
                {/* Group header */}
                <div className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide bg-muted/30">
                  {getBranchGroupLabel(groupName)}
                </div>
                {/* Group items */}
                {groupBranches.map(renderBranchItemMemoized)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer with quick actions for current branch */}
      {currentBranch && (
        <div className="p-2 border-t border-border bg-muted/10">
          {/* Quick actions row */}
          <div className="flex items-center gap-2 text-xs">
            <GitBranch className="h-3.5 w-3.5 text-brand-500 shrink-0" />
            <span className="font-mono flex-1 truncate">{currentBranch}</span>
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setPushPullDialogOpen(true)}
            >
              <ArrowDownUp className="h-3 w-3 mr-1" />
              Pull
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setPushPullDialogOpen(true)}
            >
              <Cloud className="h-3 w-3 mr-1" />
              Push
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setSetTrackingDialogOpen(true)}
              title="Set upstream tracking"
            >
              <Cloud className="h-3 w-3 mr-1" />
              Track
            </Button>
          </div>

          {/* Secondary actions */}
          <div className="flex items-center gap-2 text-xs mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs flex-1"
              onClick={() => setRemoteManagementDialogOpen(true)}
            >
              <Globe className="h-3 w-3 mr-1" />
              Remotes
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs flex-1"
              onClick={openRebaseDialog}
            >
              Rebase
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs flex-1"
              onClick={() => openMergeDialog(currentBranch)}
            >
              Merge
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <BranchCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        projectPath={projectPath}
        availableBranches={localBranches.map((b: GitBranchData) => b.name)}
      />

      <BranchRenameDialog
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        projectPath={projectPath}
        branchName={selectedBranch}
        isCurrentBranch={selectedBranch === currentBranch}
      />

      <BranchDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        projectPath={projectPath}
        branchName={selectedBranch}
        hasUncommittedChanges={
          localBranches.find((b: GitBranchData) => b.name === selectedBranch)?.hasUncommittedChanges
        }
      />

      <BranchMergeDialog
        open={mergeDialogOpen}
        onOpenChange={setMergeDialogOpen}
        projectPath={projectPath}
        currentBranch={currentBranch}
        availableBranches={localBranches.map((b: GitBranchData) => b.name)}
      />

      <BranchRebaseDialog
        open={rebaseDialogOpen}
        onOpenChange={setRebaseDialogOpen}
        projectPath={projectPath}
        currentBranch={currentBranch}
        availableBranches={localBranches.map((b: GitBranchData) => b.name)}
      />

      {/* Push/Pull Dialog */}
      <PushPullDialog
        open={pushPullDialogOpen}
        onOpenChange={setPushPullDialogOpen}
        projectPath={projectPath}
        defaultBranch={selectedBranch || currentBranch}
        currentBranch={currentBranch}
      />

      {/* Remote Management Dialog */}
      <RemoteManagementDialog
        open={remoteManagementDialogOpen}
        onOpenChange={setRemoteManagementDialogOpen}
        projectPath={projectPath}
      />

      {/* Set Branch Tracking Dialog */}
      <SetBranchTrackingDialog
        open={setTrackingDialogOpen}
        onOpenChange={setSetTrackingDialogOpen}
        projectPath={projectPath}
        currentBranch={currentBranch}
      />
    </div>
  );
}
