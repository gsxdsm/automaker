import { useState, useCallback, useMemo } from 'react';
import {
  GitPullRequest,
  GitMerge,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  ChevronRight,
  Plus,
  RefreshCw,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore } from '@/store/app-store';
import type { GitPullRequest } from '@automaker/git-utils';
import {
  usePullRequests,
  usePullRequestChecks,
  useCheckoutPullRequest,
  useClosePullRequest,
  useMergePullRequest,
  useCreatePullRequest,
  useGeneratePRTitle,
  useGeneratePRDescription,
} from '@/hooks/queries';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

// Type definitions
type PRState = 'OPEN' | 'CLOSED' | 'MERGED' | 'ALL';
type SidebarTab = 'list' | 'detail';

interface GitPullRequestsProps {
  isMobile: boolean;
}

// Shared PR type interface
interface PullRequest {
  number: number;
  title: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  author: string;
  url: string;
  headRefName: string;
  baseRefName: string;
  createdAt: string;
  mergedAt?: string;
  closedAt?: string;
}

interface PRCheck {
  name: string;
  status: string;
  conclusion?: string;
  databaseId?: number;
}

export function GitPullRequests({ isMobile }: GitPullRequestsProps) {
  const { currentProject } = useAppStore();
  const [activeTab, setActiveTab] = useState<SidebarTab>('list');
  const [selectedPR, setSelectedPR] = useState<number | null>(null);
  const [stateFilter, setStateFilter] = useState<PRState>('OPEN');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [prTitle, setPrTitle] = useState('');
  const [prDescription, setPrDescription] = useState('');

  // Fetch PRs based on state filter
  const {
    data: prs,
    isLoading,
    refetch,
    isFetching,
  } = usePullRequests(currentProject?.path, { state: stateFilter });

  // Get checks for selected PR - ensure array type
  const { data: checks = [], isLoading: isLoadingChecks } = usePullRequestChecks(
    currentProject?.path,
    selectedPR ?? undefined
  );

  // Mutations
  const { mutate: checkoutPR, isPending: isCheckingOut } = useCheckoutPullRequest();
  const { mutate: closePR, isPending: isClosing } = useClosePullRequest();
  const { mutate: mergePR, isPending: isMerging } = useMergePullRequest();
  const { mutate: createPR, isPending: isCreating } = useCreatePullRequest();
  const { mutate: generateTitle, isPending: isGeneratingTitle } = useGeneratePRTitle();
  const { mutate: generateDescription, isPending: isGeneratingDescription } =
    useGeneratePRDescription();

  const handlePRClick = useCallback((prNumber: number) => {
    setSelectedPR(prNumber);
    setActiveTab('detail');
  }, []);

  const handleBackToList = useCallback(() => {
    setSelectedPR(null);
    setActiveTab('list');
  }, []);

  const handleCheckout = useCallback(
    (prNumber: number, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!currentProject?.path) return;
      checkoutPR(
        { projectPath: currentProject.path, prNumber },
        {
          onSuccess: () => {
            toast.success(`Checked out PR #${prNumber}`);
          },
          onError: (error) => {
            toast.error(`Failed to checkout PR: ${error.message}`);
          },
        }
      );
    },
    [currentProject?.path, checkoutPR]
  );

  const handleClose = useCallback(
    (prNumber: number, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!currentProject?.path) return;
      if (!confirm(`Are you sure you want to close PR #${prNumber}?`)) return;
      closePR(
        { projectPath: currentProject.path, prNumber },
        {
          onSuccess: () => {
            setSelectedPR(null);
            setActiveTab('list');
          },
          onError: (error) => {
            toast.error(`Failed to close PR: ${error.message}`);
          },
        }
      );
    },
    [currentProject?.path, closePR]
  );

  const handleMerge = useCallback(
    (prNumber: number, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!currentProject?.path) return;
      if (!confirm(`Are you sure you want to merge PR #${prNumber}?`)) return;
      mergePR(
        { projectPath: currentProject.path, prNumber, mergeMethod: 'merge' },
        {
          onSuccess: () => {
            setSelectedPR(null);
            setActiveTab('list');
          },
          onError: (error) => {
            toast.error(`Failed to merge PR: ${error.message}`);
          },
        }
      );
    },
    [currentProject?.path, mergePR]
  );

  const handleCreatePR = useCallback(() => {
    if (!currentProject?.path) {
      toast.error('No project selected');
      return;
    }
    setShowCreateDialog(true);
    setPrTitle('');
    setPrDescription('');
    // Auto-generate title and description when dialog opens
    generateTitle(
      { projectPath: currentProject.path },
      {
        onSuccess: (title) => {
          setPrTitle(title);
        },
        onError: (error) => {
          toast.warning(`Could not generate title: ${error.message}`);
        },
      }
    );
    generateDescription(
      { projectPath: currentProject.path },
      {
        onSuccess: (description) => {
          setPrDescription(description);
        },
        onError: (error) => {
          toast.warning(`Could not generate description: ${error.message}`);
        },
      }
    );
  }, [currentProject?.path, generateTitle, generateDescription]);

  const handleSavePR = useCallback(() => {
    if (!currentProject?.path || !prTitle.trim()) {
      toast.error('Title is required');
      return;
    }
    createPR(
      {
        projectPath: currentProject.path,
        title: prTitle.trim(),
        body: prDescription.trim() || undefined,
        draft: false,
      },
      {
        onSuccess: () => {
          setShowCreateDialog(false);
          setPrTitle('');
          setPrDescription('');
          refetch();
        },
      }
    );
  }, [currentProject?.path, prTitle, prDescription, createPR, refetch]);

  // Memoize selected PR lookup to avoid recalculation on every render
  const selectedPRData = useMemo(
    () => prs?.find((pr) => pr.number === selectedPR),
    [prs, selectedPR]
  );

  // Mobile view
  if (isMobile) {
    return (
      <>
        <div className="h-full flex flex-col">
          {/* List View */}
          {activeTab === 'list' && (
            <div className="h-full flex flex-col">
              <PRListHeader
                stateFilter={stateFilter}
                onStateChange={setStateFilter}
                isLoading={isFetching}
                onRefresh={() => refetch()}
                onCreatePR={handleCreatePR}
                isMobile
              />
              <PRList prs={prs ?? []} isLoading={isLoading} onPRClick={handlePRClick} isMobile />
            </div>
          )}

          {/* Detail View */}
          {activeTab === 'detail' && selectedPRData && (
            <div className="h-full flex flex-col">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/20">
                <button
                  className="p-1 rounded hover:bg-accent/50 text-muted-foreground"
                  onClick={handleBackToList}
                >
                  <ChevronRight className="h-4 w-4 rotate-180" />
                </button>
                <span className="font-medium text-sm flex-1">PR #{selectedPRData.number}</span>
              </div>
              <PRDetailView
                pr={selectedPRData}
                checks={checks ?? []}
                onCheckout={handleCheckout}
                onClose={handleClose}
                onMerge={handleMerge}
                isCheckingOut={isCheckingOut}
                isClosing={isClosing}
                isMerging={isMerging}
                isLoadingChecks={isLoadingChecks}
                isMobile
              />
            </div>
          )}
        </div>

        {/* Create PR Dialog */}
        <CreatePRDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          title={prTitle}
          onTitleChange={setPrTitle}
          description={prDescription}
          onDescriptionChange={setPrDescription}
          onSave={handleSavePR}
          isGeneratingTitle={isGeneratingTitle}
          isGeneratingDescription={isGeneratingDescription}
          isCreating={isCreating}
        />
      </>
    );
  }

  // Desktop view - split into list and detail panels
  return (
    <>
      <div className="h-full flex">
        {/* List Panel */}
        <div
          className={cn('flex flex-col border-r border-border', selectedPR ? 'w-1/2' : 'w-full')}
        >
          <PRListHeader
            stateFilter={stateFilter}
            onStateChange={setStateFilter}
            isLoading={isFetching}
            onRefresh={() => refetch()}
            onCreatePR={handleCreatePR}
          />
          <PRList prs={prs ?? []} isLoading={isLoading} onPRClick={handlePRClick} />
        </div>

        {/* Detail Panel */}
        {selectedPRData && (
          <div className="w-1/2 flex flex-col">
            <PRDetailView
              pr={selectedPRData}
              checks={checks ?? []}
              onCheckout={handleCheckout}
              onClose={handleClose}
              onMerge={handleMerge}
              isCheckingOut={isCheckingOut}
              isClosing={isClosing}
              isMerging={isMerging}
              isLoadingChecks={isLoadingChecks}
            />
          </div>
        )}
      </div>

      {/* Create PR Dialog */}
      <CreatePRDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        title={prTitle}
        onTitleChange={setPrTitle}
        description={prDescription}
        onDescriptionChange={setPrDescription}
        onSave={handleSavePR}
        isGeneratingTitle={isGeneratingTitle}
        isGeneratingDescription={isGeneratingDescription}
        isCreating={isCreating}
      />
    </>
  );
}

// ============================================
// Sub-components
// ============================================

function PRListHeader({
  stateFilter,
  onStateChange,
  isLoading,
  onRefresh,
  onCreatePR,
  isMobile,
}: {
  stateFilter: PRState;
  onStateChange: (state: PRState) => void;
  isLoading: boolean;
  onRefresh: () => void;
  onCreatePR: () => void;
  isMobile?: boolean;
}) {
  const filters: { key: PRState; label: string; count?: number }[] = [
    { key: 'OPEN', label: 'Open' },
    { key: 'CLOSED', label: 'Closed' },
    { key: 'MERGED', label: 'Merged' },
    { key: 'ALL', label: 'All' },
  ];

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
        <GitPullRequest className="h-4 w-4 text-brand-500" />
        <span
          className={cn(
            'font-medium',
            isMobile ? 'text-sm' : 'text-xs text-muted-foreground uppercase tracking-wide flex-1'
          )}
        >
          Pull Requests
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2"
          onClick={onRefresh}
          disabled={isLoading}
          aria-label={isLoading ? 'Refreshing pull requests' : 'Refresh pull requests'}
        >
          <RefreshCw className={cn('h-3 w-3', isLoading && 'animate-spin')} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-brand-500 hover:text-brand-600"
          onClick={onCreatePR}
          aria-label="Create new pull request"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex border-b border-border" role="tablist" aria-label="Pull request filters">
        {filters.map((filter) => (
          <button
            key={filter.key}
            className={cn(
              'flex-1 px-2 py-1.5 text-xs font-medium transition-colors',
              stateFilter === filter.key
                ? 'text-foreground bg-accent/50 border-b-2 border-brand-500'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
            )}
            onClick={() => onStateChange(filter.key)}
            role="tab"
            aria-selected={stateFilter === filter.key}
            aria-label={`Show ${filter.label.toLowerCase()} pull requests`}
          >
            {filter.label}
          </button>
        ))}
      </div>
    </>
  );
}

function PRList({
  prs,
  isLoading,
  onPRClick,
  isMobile,
}: {
  prs: PullRequest[];
  isLoading: boolean;
  onPRClick: (prNumber: number) => void;
  isMobile?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted-foreground text-sm">
          <RefreshCw className="h-6 w-6 mx-auto mb-2 animate-spin" />
          <p>Loading pull requests...</p>
        </div>
      </div>
    );
  }

  if (prs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted-foreground text-sm">
          <GitPullRequest className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>No pull requests found</p>
          <p className="text-xs mt-1">Try changing the filter or create a new PR</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {prs.map((pr) => (
        <PRListItem
          key={pr.number}
          pr={pr}
          onClick={() => onPRClick(pr.number)}
          isMobile={isMobile}
        />
      ))}
    </div>
  );
}

function PRListItem({
  pr,
  onClick,
  isMobile,
}: {
  pr: PullRequest;
  onClick: () => void;
  isMobile?: boolean;
}) {
  const getStatusIcon = () => {
    switch (pr.state) {
      case 'OPEN':
        return <Clock className="h-3 w-3 text-yellow-500" />;
      case 'MERGED':
        return <GitMerge className="h-3 w-3 text-purple-500" />;
      case 'CLOSED':
        return <XCircle className="h-3 w-3 text-red-500" />;
    }
  };

  const timeAgo = formatDistanceToNow(new Date(pr.createdAt), { addSuffix: true });

  return (
    <div
      className={cn(
        'flex items-start gap-2 px-3 py-2 hover:bg-accent/50 cursor-pointer border-b border-border/50',
        isMobile && 'py-3'
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`View pull request ${pr.number}: ${pr.title}`}
    >
      <div className="shrink-0 mt-0.5">{getStatusIcon()}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('font-medium truncate', isMobile ? 'text-sm' : 'text-xs')}>
            {pr.title}
          </span>
          <Badge variant="outline" className="shrink-0 text-[10px] px-1 h-4">
            #{pr.number}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
          <span>{pr.author}</span>
          <span>•</span>
          <span>
            {pr.headRefName} → {pr.baseRefName}
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground/60 mt-0.5">{timeAgo}</div>
      </div>
    </div>
  );
}

function PRDetailView({
  pr,
  checks,
  onCheckout,
  onClose,
  onMerge,
  isCheckingOut,
  isClosing,
  isMerging,
  isLoadingChecks,
  isMobile,
}: {
  pr: PullRequest;
  checks: PRCheck[];
  onCheckout: (prNumber: number, e: React.MouseEvent) => void;
  onClose: (prNumber: number, e: React.MouseEvent) => void;
  onMerge: (prNumber: number, e: React.MouseEvent) => void;
  isCheckingOut: boolean;
  isClosing: boolean;
  isMerging: boolean;
  isLoadingChecks?: boolean;
  isMobile?: boolean;
}) {
  const getStatusBadge = () => {
    switch (pr.state) {
      case 'OPEN':
        return (
          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Open</Badge>
        );
      case 'MERGED':
        return (
          <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20">Merged</Badge>
        );
      case 'CLOSED':
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Closed</Badge>;
    }
  };

  const timeAgo = formatDistanceToNow(new Date(pr.createdAt), { addSuffix: true });

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          {getStatusBadge()}
          <span className="text-xs text-muted-foreground">#{pr.number}</span>
        </div>
        <h3 className={cn('font-semibold', isMobile ? 'text-base' : 'text-sm')}>{pr.title}</h3>
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <span>by {pr.author}</span>
          <span>•</span>
          <span>{timeAgo}</span>
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs">
          <span className="text-muted-foreground">{pr.headRefName}</span>
          <span className="text-muted-foreground">→</span>
          <span className="text-muted-foreground">{pr.baseRefName}</span>
        </div>
      </div>

      {/* Checks */}
      {checks.length > 0 || isLoadingChecks ? (
        <div className="p-3 border-b border-border">
          <h4 className="text-xs font-medium mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3" />
            Checks
          </h4>
          {isLoadingChecks ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Loading checks...</span>
            </div>
          ) : (
            <div className="space-y-1" role="list" aria-label="Pull request checks">
              {checks.map((check) => (
                <div
                  key={check.databaseId ?? check.name}
                  className="flex items-center gap-2 text-xs"
                  role="listitem"
                >
                  <span
                    className={cn('w-2 h-2 rounded-full shrink-0', {
                      'bg-green-500': check.conclusion === 'SUCCESS',
                      'bg-red-500': check.conclusion === 'FAILURE',
                      'bg-yellow-500': check.status === 'PENDING' || check.status === 'IN_PROGRESS',
                      'bg-gray-400': !check.conclusion && check.status === 'COMPLETED',
                    })}
                    aria-hidden="true"
                  />
                  <span className="flex-1 truncate" title={check.name}>
                    {check.name}
                  </span>
                  <span className="text-muted-foreground text-[10px] shrink-0">
                    {check.conclusion ?? check.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Actions */}
      {pr.state === 'OPEN' && (
        <div className="p-3 border-b border-border flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={(e) => onCheckout(pr.number, e)}
            disabled={isCheckingOut}
            aria-label={`Checkout pull request ${pr.number}`}
          >
            <Eye className="h-3 w-3 mr-1" />
            Checkout
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs text-purple-500 border-purple-500/50 hover:bg-purple-500/10"
            onClick={(e) => onMerge(pr.number, e)}
            disabled={isMerging}
            aria-label={`Merge pull request ${pr.number}`}
          >
            <GitMerge className="h-3 w-3 mr-1" />
            Merge
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs text-red-500 border-red-500/50 hover:bg-red-500/10"
            onClick={(e) => onClose(pr.number, e)}
            disabled={isClosing}
            aria-label={`Close pull request ${pr.number}`}
          >
            <XCircle className="h-3 w-3 mr-1" />
            Close
          </Button>
        </div>
      )}

      {/* Link to GitHub */}
      <div className="p-3">
        <Button variant="link" className="h-auto p-0 text-xs" asChild>
          <a href={pr.url} target="_blank" rel="noopener noreferrer">
            Open on GitHub ↗
          </a>
        </Button>
      </div>
    </div>
  );
}

// ============================================
// Create PR Dialog
// ============================================

interface CreatePRDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onTitleChange: (title: string) => void;
  description: string;
  onDescriptionChange: (description: string) => void;
  onSave: () => void;
  isGeneratingTitle: boolean;
  isGeneratingDescription: boolean;
  isCreating: boolean;
}

function CreatePRDialog({
  open,
  onOpenChange,
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  onSave,
  isGeneratingTitle,
  isGeneratingDescription,
  isCreating,
}: CreatePRDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Pull Request</DialogTitle>
          <DialogDescription>
            Create a new pull request with AI-generated title and description based on your commits.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="pr-title">Title</Label>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                {isGeneratingTitle ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Generating...
                  </>
                ) : title ? (
                  <>
                    <Sparkles className="h-3 w-3" />
                    AI Generated
                  </>
                ) : null}
              </div>
            </div>
            <Input
              id="pr-title"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="PR title"
              className="text-sm"
              disabled={isGeneratingTitle}
              aria-describedby="pr-title-description"
            />
            <p id="pr-title-description" className="text-[10px] text-muted-foreground">
              Enter a clear, concise title for your pull request
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="pr-description">Description</Label>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                {isGeneratingDescription ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Generating...
                  </>
                ) : description ? (
                  <>
                    <Sparkles className="h-3 w-3" />
                    AI Generated
                  </>
                ) : null}
              </div>
            </div>
            <Textarea
              id="pr-description"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="PR description (supports markdown)"
              rows={10}
              className="text-sm font-mono resize-none"
              disabled={isGeneratingDescription}
              aria-describedby="pr-description-description"
            />
            <p id="pr-description-description" className="text-[10px] text-muted-foreground">
              Describe the changes in this pull request
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={isCreating || !title.trim()}>
            {isCreating ? 'Creating...' : 'Create Pull Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Export the dialog to be used in main component
export { CreatePRDialog };
