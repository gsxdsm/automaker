import { useState, useCallback } from 'react';
import {
  GitBranch,
  FolderTree,
  Archive,
  GitPullRequest,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  ArrowLeft,
  PanelLeftOpen,
  PanelRightOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/app-store';
import { useWorktrees } from '@/hooks/queries/use-worktrees';
import { toast } from 'sonner';
import { GitBranchManagement } from './git-branch-management';
import { GitPullRequests } from './git-pull-requests';
import { GitStashManagement } from './git-stash-management';

// Types for git entities
interface Branch {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
  hasChanges?: boolean;
}

type SidebarTab = 'branches' | 'worktrees' | 'stashes' | 'pull-requests';

interface GitSidebarProps {
  isCollapsed: boolean;
  onCollapseChange: (collapsed: boolean) => void;
  isMobile: boolean;
  onMobileSwitch: () => void;
}

// Constants for default state
const DEFAULT_EXPANDED_SECTIONS = new Set(['local', 'remote']);

// Tab configuration - extracted to avoid recreation on each render
const SIDEBAR_TABS = [
  { key: 'branches' as const, label: 'Branches', icon: GitBranch },
  { key: 'worktrees' as const, label: 'Worktrees', icon: FolderTree },
  { key: 'stashes' as const, label: 'Stashes', icon: Archive },
  { key: 'pull-requests' as const, label: 'PRs', icon: GitPullRequest },
] as const;

export function GitSidebar({
  isCollapsed,
  onCollapseChange,
  isMobile,
  onMobileSwitch,
}: GitSidebarProps) {
  const { currentProject } = useAppStore();
  const [activeTab, setActiveTab] = useState<SidebarTab>('branches');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(DEFAULT_EXPANDED_SECTIONS);

  // Worktree data from hook
  const { data: worktreeData } = useWorktrees(currentProject?.path);
  const worktrees = worktreeData?.worktrees ?? [];

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  const isExpanded = useCallback(
    (section: string) => expandedSections.has(section),
    [expandedSections]
  );

  // Toggle section visibility
  const renderSectionHeader = useCallback(
    (title: string, sectionKey: string, icon: React.ReactNode, count?: number) => {
      if (isCollapsed && !isMobile) {
        return (
          <div
            className="flex items-center justify-center py-3 text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={() => toggleSection(sectionKey)}
            title={title}
          >
            {icon}
          </div>
        );
      }

      const expanded = isExpanded(sectionKey);

      return (
        <button
          className={cn(
            'flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-accent/50 transition-colors',
            'text-xs font-medium text-muted-foreground uppercase tracking-wide'
          )}
          onClick={() => toggleSection(sectionKey)}
        >
          {icon}
          <span className="flex-1">{title}</span>
          {count !== undefined && <span className="text-muted-foreground/60">{count}</span>}
          {expanded ? (
            <ChevronDown className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0" />
          )}
        </button>
      );
    },
    [isCollapsed, isMobile, toggleSection, isExpanded]
  );

  // Tab selector (only visible when not collapsed)
  const renderTabSelector = useCallback(() => {
    if (isCollapsed && !isMobile) return null;

    return (
      <div className="flex border-b border-border">
        {SIDEBAR_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-xs flex-1 transition-colors',
                activeTab === tab.key
                  ? 'text-foreground bg-accent/50 border-b-2 border-brand-500'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
              )}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon className="h-3 w-3" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    );
  }, [isCollapsed, isMobile, activeTab]);

  // Render branches list - now using the new comprehensive branch management component
  const renderBranches = useCallback(() => {
    return (
      <div className="h-full flex flex-col">
        <GitBranchManagement isMobile={isMobile} />
      </div>
    );
  }, [isMobile]);

  // Render worktrees list
  const renderWorktrees = useCallback(() => {
    return (
      <div className="flex-1 overflow-y-auto">
        {renderSectionHeader(
          'Worktrees',
          'worktrees',
          <FolderTree className="h-3 w-3" />,
          worktrees.length
        )}
        {isExpanded('worktrees') && (
          <div className="py-1">
            {worktrees.map((wt) => (
              <div
                key={wt.path}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent/50 cursor-pointer group',
                  wt.isMain && 'bg-accent/30'
                )}
              >
                <FolderTree className="h-3 w-3 shrink-0 text-primary" />
                <span className="flex-1 truncate">{wt.branch}</span>
                {wt.isMain && (
                  <span className="text-[9px] text-muted-foreground shrink-0">main</span>
                )}
                {wt.hasChanges && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0"
                    title="Uncommitted changes"
                  />
                )}
                {!wt.isMain && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                      title="Delete worktree"
                      onClick={() => toast.info(`Delete worktree ${wt.branch} coming soon`)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Create new worktree button */}
        <div className="p-2 border-t border-border mt-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 h-7 text-xs"
            onClick={() => toast.info('Create new worktree coming soon')}
          >
            <Plus className="h-3 w-3" />
            New Worktree
          </Button>
        </div>
      </div>
    );
  }, [worktrees, renderSectionHeader, isExpanded]);

  // Render stashes list
  const renderStashes = useCallback(() => {
    return (
      <div className="h-full flex flex-col">
        <GitStashManagement isMobile={isMobile} />
      </div>
    );
  }, [isMobile]);

  // Memoize content rendering based on active tab
  const tabContent = useCallback(() => {
    switch (activeTab) {
      case 'branches':
        return renderBranches();
      case 'worktrees':
        return renderWorktrees();
      case 'stashes':
        return renderStashes();
      case 'pull-requests':
        return <GitPullRequests isMobile={isMobile} />;
      default:
        return null;
    }
  }, [activeTab, renderBranches, renderWorktrees, renderStashes, isMobile]);

  // Mobile view: full panel with back button
  if (isMobile) {
    return (
      <div className="h-full flex flex-col bg-card border-r border-border">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-3 border-b border-border bg-muted/30">
          <GitSidebarIcon activeTab={activeTab} />
          <span className="font-medium text-sm flex-1">
            {activeTab === 'branches' && 'Branches'}
            {activeTab === 'worktrees' && 'Worktrees'}
            {activeTab === 'stashes' && 'Stashes'}
            {activeTab === 'pull-requests' && 'Pull Requests'}
          </span>
        </div>

        {/* Tab selector */}
        {renderTabSelector()}

        {/* Content */}
        {tabContent()}
      </div>
    );
  }

  // Desktop collapsed view: icon-only sidebar
  if (isCollapsed) {
    return (
      <div className="h-full flex flex-col bg-card border-r border-border w-12 items-center">
        <div className="flex items-center justify-center py-3 w-full border-b border-border">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Tab icons */}
        <div className="flex flex-col gap-1 py-2 w-full">
          {SIDEBAR_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                className={cn(
                  'flex items-center justify-center py-2 hover:bg-accent/50 transition-colors',
                  activeTab === tab.key && 'text-brand-500'
                )}
                onClick={() => setActiveTab(tab.key)}
                title={tab.label}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>

        {/* Expand button */}
        <div className="mt-auto">
          <button
            className="flex items-center justify-center py-2 w-full hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
            onClick={() => onCollapseChange(false)}
            title="Expand sidebar"
          >
            <Plus className="h-4 w-4 rotate-180" /> {/* Using as right arrow */}
          </button>
        </div>
      </div>
    );
  }

  // Desktop expanded view
  return (
    <div className="h-full flex flex-col bg-card border-r border-border">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
        <GitSidebarIcon activeTab={activeTab} />
        <span className="font-medium text-xs text-muted-foreground uppercase tracking-wide flex-1">
          {activeTab === 'branches' && 'Branches'}
          {activeTab === 'worktrees' && 'Worktrees'}
          {activeTab === 'stashes' && 'Stashes'}
          {activeTab === 'pull-requests' && 'Pull Requests'}
        </span>
        <button
          className="p-0.5 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground"
          onClick={() => onCollapseChange(true)}
          title="Collapse sidebar"
        >
          <Plus className="h-3 w-3 rotate-180" /> {/* Using as left arrow */}
        </button>
      </div>

      {/* Tab selector */}
      {renderTabSelector()}

      {/* Content */}
      {tabContent()}
    </div>
  );
}

// Helper component for sidebar icon
function GitSidebarIcon({ activeTab }: { activeTab: SidebarTab }) {
  switch (activeTab) {
    case 'branches':
      return <GitBranch className="h-4 w-4 text-brand-500" />;
    case 'worktrees':
      return <FolderTree className="h-4 w-4 text-brand-500" />;
    case 'stashes':
      return <Archive className="h-4 w-4 text-brand-500" />;
    case 'pull-requests':
      return <GitPullRequest className="h-4 w-4 text-brand-500" />;
    default:
      return <GitBranch className="h-4 w-4 text-brand-500" />;
  }
}
