import { useState, useCallback, useEffect } from 'react';
import { GitCommit, GitBranch, GitPullRequest, FileDiff, ArrowLeft } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { useCommitHistory } from '@/hooks/git/use-commit-history';
import { CommitFilters } from '@/components/git-view/commit-filters';
import { CommitList } from '@/components/git-view/commit-list';
import { CommitDiffView } from '@/components/git-view/commit-diff-view';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { PullToRefreshWrapper } from './components';
import { useIsMobile } from '@/hooks/use-media-query';

type MainViewTab = 'commits' | 'diffs' | 'pull-requests';
type DiffViewMode = 'list' | 'detail';

interface GitMainContentProps {
  selectedCommit: string | null;
  onCommitSelect: (hash: string | null) => void;
}

// Tab configuration - extracted to avoid recreation on each render
const MAIN_VIEW_TABS = [
  { key: 'commits' as const, label: 'Commits', icon: GitCommit },
  { key: 'diffs' as const, label: 'Diffs', icon: FileDiff },
  { key: 'pull-requests' as const, label: 'Pull Requests', icon: GitPullRequest },
] as const;

// Graph icon component
const GraphIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="12" r="3" />
    <path d="M6 9v6" />
    <path d="M18 9v-3" />
    <path d="M9 12h6" />
  </svg>
);

export function GitMainContent({ selectedCommit, onCommitSelect }: GitMainContentProps) {
  const { currentProject } = useAppStore();
  const [activeTab, setActiveTab] = useState<MainViewTab>('commits');
  const [diffViewMode, setDiffViewMode] = useState<DiffViewMode>('list');
  const [selectedCommitForDiff, setSelectedCommitForDiff] = useState<string | null>(null);
  const [showGraph, setShowGraph] = useState(true);
  const [compactView, setCompactView] = useState(false);
  const isMobile = useIsMobile();

  // Use commit history hook (defaults to HEAD branch)
  const {
    commits,
    isLoading,
    error,
    hasMore,
    totalCount,
    filters,
    loadMore,
    refresh,
    setFilters,
    loadCommitFiles,
  } = useCommitHistory({
    repoPath: currentProject?.path || '',
    pageSize: 50,
    enabled: !!currentProject?.path,
  });

  // Load files when a commit is selected
  useEffect(() => {
    if (selectedCommit && activeTab === 'commits') {
      loadCommitFiles(selectedCommit);
    }
  }, [selectedCommit, activeTab, loadCommitFiles]);

  const handleCommitClick = useCallback(
    (hash: string | null) => {
      onCommitSelect(hash);
      if (hash) {
        setSelectedCommitForDiff(hash);
        // Automatically load files for this commit
        loadCommitFiles(hash);
      }
    },
    [onCommitSelect, loadCommitFiles]
  );

  const handleBackToList = useCallback(() => {
    setDiffViewMode('list');
  }, []);

  const handleRefresh = useCallback(() => {
    refresh();
    toast.success('Commit history refreshed');
  }, [refresh]);

  // Tab selector
  const renderTabSelector = useCallback(() => {
    return (
      <div className="flex items-center gap-1 border-b border-border bg-muted/20">
        {MAIN_VIEW_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm transition-colors',
                activeTab === tab.key
                  ? 'text-foreground bg-background border-b-2 border-brand-500'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
              )}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}

        {/* View options (only for commits tab) */}
        {activeTab === 'commits' && (
          <>
            <div className="ml-auto flex items-center gap-1 pr-2">
              <Button
                variant={showGraph ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2"
                onClick={() => setShowGraph(!showGraph)}
                title="Toggle graph visualization"
              >
                <GraphIcon className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={compactView ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2"
                onClick={() => setCompactView(!compactView)}
                title="Toggle compact view"
              >
                <span className="text-xs">紧凑</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={handleRefresh}
                title="Refresh"
              >
                ↻
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }, [activeTab, showGraph, compactView, handleRefresh]);

  // Render commits tab
  const renderCommits = useCallback(() => {
    if (diffViewMode === 'detail' && selectedCommitForDiff) {
      const commit = commits.find((c) => c.hash === selectedCommitForDiff);
      return (
        <div className="h-full flex flex-col">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/20">
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleBackToList}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">Viewing diff for {commit?.shortHash}</span>
          </div>
          <CommitDiffView
            repoPath={currentProject?.path || ''}
            commitHash={selectedCommitForDiff}
            commitMessage={commit?.message || ''}
          />
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col">
        <CommitFilters filters={filters} onFiltersChange={setFilters} resultCount={totalCount} />
        <CommitList
          commits={commits}
          selectedCommit={selectedCommit}
          onCommitSelect={handleCommitClick}
          isLoading={isLoading}
          hasMore={hasMore}
          onLoadMore={loadMore}
          showGraph={showGraph}
          compact={compactView}
        />
      </div>
    );
  }, [
    diffViewMode,
    selectedCommitForDiff,
    commits,
    currentProject?.path,
    handleBackToList,
    filters,
    setFilters,
    totalCount,
    selectedCommit,
    handleCommitClick,
    isLoading,
    hasMore,
    loadMore,
    showGraph,
    compactView,
  ]);

  // Render diffs view (placeholder)
  const renderDiffs = useCallback(() => {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-center text-muted-foreground py-12">
          <FileDiff className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-sm mb-2">Diff View</p>
          <p className="text-xs">Select a commit from the Commits tab to view its changes</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => setActiveTab('commits')}
          >
            Go to Commits
          </Button>
        </div>
      </div>
    );
  }, [setActiveTab]);

  // Render pull requests (placeholder for now)
  const renderPullRequests = useCallback(() => {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-center text-muted-foreground py-12">
          <GitPullRequest className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-sm mb-2">Pull Requests</p>
          <p className="text-xs">PR integration coming soon</p>
        </div>
      </div>
    );
  }, []);

  // Render active tab content
  const tabContent = useCallback(() => {
    if (error) {
      return (
        <div className="flex-1 flex items-center justify-center text-destructive">
          <div className="text-center">
            <p className="text-sm mb-1">Failed to load commits</p>
            <p className="text-xs text-muted-foreground mb-4">{error.message}</p>
            <Button variant="outline" size="sm" onClick={refresh}>
              Retry
            </Button>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'commits':
        return renderCommits();
      case 'diffs':
        return renderDiffs();
      case 'pull-requests':
        return renderPullRequests();
      default:
        return null;
    }
  }, [activeTab, error, refresh, renderCommits, renderDiffs, renderPullRequests]);

  // Wrap content with pull-to-refresh on mobile
  const content = (
    <div className="h-full flex flex-col bg-background">
      {/* Tab selector */}
      {renderTabSelector()}

      {/* Content */}
      {tabContent()}
    </div>
  );

  if (isMobile && activeTab === 'commits') {
    return (
      <PullToRefreshWrapper
        onRefresh={async () => {
          await refresh();
          toast.success('Commit history refreshed');
        }}
        threshold={80}
      >
        {content}
      </PullToRefreshWrapper>
    );
  }

  return content;
}
