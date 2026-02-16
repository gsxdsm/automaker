import { useState, useCallback, useEffect, useRef } from 'react';
import {
  GitBranch,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  ArrowLeft,
  Keyboard,
} from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { GitSidebar } from './git-view/git-sidebar';
import { GitMainContent } from './git-view/git-main-content';
import { GitActionPanel } from './git-view/git-action-panel';
import { GitKeyboardShortcutsDialog } from '@/components/ui/git-keyboard-shortcuts-dialog';
import { useGitKeyboardShortcuts } from '@/hooks/use-git-keyboard-shortcuts';
import { useGitKeyboardShortcutsStore } from '@/store/git-keyboard-shortcuts-store';
import { useIsMobile } from '@/hooks/use-media-query';

// Constants for panel sizing
const PANEL_SIZES = {
  SIDEBAR: {
    DEFAULT: 20,
    MIN: 12,
    MAX: 35,
    COLLAPSED: 3,
  },
  MAIN: {
    DEFAULT: 60,
    MIN: 30,
  },
  ACTION_PANEL: {
    DEFAULT: 20,
    MIN: 15,
    MAX: 30,
    COLLAPSED: 3,
  },
} as const;

// Keyboard shortcuts
const KEYBOARD_SHORTCUTS = {
  TOGGLE_SIDEBAR: 'b',
  TOGGLE_ACTION_PANEL: 'B',
} as const;

/**
 * GitView - Responsive layout with resizable panels for git operations.
 *
 * Features:
 * - Left sidebar: Branches, Worktrees, Stashes navigation
 * - Main content: Commit history, diffs, PR details
 * - Right action panel: Quick actions (commit, branch, merge, stash)
 * - Collapsible panels with drag handles
 * - Mobile-responsive design with view switching
 * - Keyboard shortcuts for panel navigation
 */
export function GitView() {
  const { currentProject } = useAppStore();
  const isMobile = useIsMobile();

  // Keyboard shortcuts state
  const { mode, showHelpDialog, setMode, setShowHelpDialog, toggleHelpDialog } =
    useGitKeyboardShortcutsStore();

  // Local commit dialog state
  const [localCommitDialogOpen, setLocalCommitDialogOpen] = useState(false);

  // Panel refs for collapse/expand control
  const leftPanelRef = useRef<ImperativePanelHandle>(null);
  const rightPanelRef = useRef<ImperativePanelHandle>(null);

  // Panel collapsed state
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);

  // Mobile view state (true = sidebar, false = main content)
  const [mobileShowSidebar, setMobileShowSidebar] = useState(true);
  // Mobile action panel state (true = action panel, false = current view)
  const [mobileShowActionPanel, setMobileShowActionPanel] = useState(false);

  // Selected commit for detail view
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);

  // Collapse/expand handlers for desktop
  const handleLeftPanelCollapse = useCallback(() => {
    setLeftPanelCollapsed(true);
  }, []);

  const handleLeftPanelExpand = useCallback(() => {
    setLeftPanelCollapsed(false);
  }, []);

  const handleRightPanelCollapse = useCallback(() => {
    setRightPanelCollapsed(true);
  }, []);

  const handleRightPanelExpand = useCallback(() => {
    setRightPanelCollapsed(false);
  }, []);

  // Toggle handlers
  const toggleLeftPanel = useCallback(() => {
    const panel = leftPanelRef.current;
    if (panel) {
      if (leftPanelCollapsed) {
        panel.expand();
      } else {
        panel.collapse();
      }
    }
  }, [leftPanelCollapsed]);

  const toggleRightPanel = useCallback(() => {
    const panel = rightPanelRef.current;
    if (panel) {
      if (rightPanelCollapsed) {
        panel.expand();
      } else {
        panel.collapse();
      }
    }
  }, [rightPanelCollapsed]);

  // Mobile view handlers
  const showMobileSidebar = useCallback(() => {
    setMobileShowSidebar(true);
    setMobileShowActionPanel(false);
  }, []);

  const showMobileMain = useCallback(() => {
    setMobileShowSidebar(false);
    setMobileShowActionPanel(false);
  }, []);

  const showMobileActionPanel = useCallback(() => {
    setMobileShowSidebar(false);
    setMobileShowActionPanel(true);
  }, []);

  // Setup keyboard shortcuts for git operations
  useGitKeyboardShortcuts({
    mode,
    enabled: !isMobile && !!currentProject,
    handlers: {
      onQuickCommit: () => setLocalCommitDialogOpen(true),
      onRefresh: () => window.location.reload(),
      onToggleSidebar: () => toggleLeftPanel(),
      onShowHelp: toggleHelpDialog,
      // Panel navigation
      onNavigateLeft: () => {
        if (leftPanelCollapsed) {
          handleLeftPanelExpand();
        }
      },
      onNavigateRight: () => {
        if (rightPanelCollapsed) {
          handleRightPanelExpand();
        }
      },
      // Branch operations (to be implemented)
      onCheckoutBranch: () => {
        // TODO: Open branch checkout dialog
        console.log('Checkout branch shortcut triggered');
      },
      onCreateBranch: () => {
        // TODO: Open branch creation dialog
        console.log('Create branch shortcut triggered');
      },
      // Sync operations (to be implemented)
      onPull: () => {
        // TODO: Implement pull
        console.log('Pull shortcut triggered');
      },
      onPush: () => {
        // TODO: Implement push
        console.log('Push shortcut triggered');
      },
      // Search (to be implemented)
      onSearchCommits: () => {
        // TODO: Open search dialog
        console.log('Search commits shortcut triggered');
      },
    },
  });

  // No project selected state
  if (!currentProject) {
    return (
      <div className="flex-1 flex items-center justify-center" data-testid="git-view-no-project">
        <div className="text-center text-muted-foreground">
          <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-sm">No project selected</p>
          <p className="text-xs mt-1 text-muted-foreground/60">
            Open a project to use git features
          </p>
        </div>
      </div>
    );
  }

  // Mobile layout: full-screen switching
  if (isMobile) {
    return (
      <div
        className="flex-1 flex flex-col overflow-hidden content-bg"
        data-testid="git-view-mobile"
      >
        {/* Mobile: Sidebar */}
        {mobileShowSidebar && !mobileShowActionPanel && (
          <div className="h-full flex flex-col" data-testid="mobile-git-sidebar">
            {/* Header with back button */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/20">
              <button
                className="p-1 rounded hover:bg-accent/50 text-muted-foreground"
                onClick={showMobileMain}
                data-testid="mobile-back-to-main"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <span className="font-medium text-sm">Git Navigation</span>
            </div>
            <GitSidebar
              isCollapsed={false}
              onCollapseChange={() => {}}
              isMobile={true}
              onMobileSwitch={showMobileMain}
            />
          </div>
        )}

        {/* Mobile: Main content */}
        {!mobileShowSidebar && !mobileShowActionPanel && (
          <div className="h-full flex flex-col" data-testid="mobile-git-main">
            {/* Header with navigation buttons */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/20">
              <button
                className="p-1 rounded hover:bg-accent/50 text-muted-foreground"
                onClick={showMobileSidebar}
                title="Navigation"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
              <span className="font-medium text-sm flex-1">Git Editor</span>
              <button
                className="p-1 rounded hover:bg-accent/50 text-muted-foreground"
                onClick={toggleHelpDialog}
                title="Keyboard shortcuts"
              >
                <Keyboard className="h-4 w-4" />
              </button>
              <button
                className="p-1 rounded hover:bg-accent/50 text-muted-foreground"
                onClick={showMobileActionPanel}
                title="Actions"
              >
                <PanelRightOpen className="h-4 w-4" />
              </button>
            </div>
            <GitMainContent selectedCommit={selectedCommit} onCommitSelect={setSelectedCommit} />
          </div>
        )}

        {/* Mobile: Action panel */}
        {mobileShowActionPanel && (
          <div className="h-full flex flex-col" data-testid="mobile-git-action-panel">
            {/* Header with back button */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/20">
              <button
                className="p-1 rounded hover:bg-accent/50 text-muted-foreground"
                onClick={showMobileMain}
                data-testid="mobile-back-from-actions"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <span className="font-medium text-sm">Quick Actions</span>
            </div>
            <GitActionPanel isCollapsed={false} onCollapseChange={() => {}} isMobile={true} />
          </div>
        )}
      </div>
    );
  }

  // Desktop layout: resizable three-panel layout
  return (
    <div className="flex-1 flex flex-col overflow-hidden content-bg" data-testid="git-view">
      <PanelGroup direction="horizontal" autoSaveId="git-view-layout">
        {/* Left Sidebar Panel */}
        <Panel
          ref={leftPanelRef}
          id="git-sidebar-panel"
          defaultSize={PANEL_SIZES.SIDEBAR.DEFAULT}
          minSize={PANEL_SIZES.SIDEBAR.MIN}
          maxSize={PANEL_SIZES.SIDEBAR.MAX}
          collapsible
          collapsedSize={PANEL_SIZES.SIDEBAR.COLLAPSED}
          onCollapse={handleLeftPanelCollapse}
          onExpand={handleLeftPanelExpand}
          data-testid="git-left-panel"
        >
          <GitSidebar
            isCollapsed={leftPanelCollapsed}
            onCollapseChange={(collapsed) => {
              if (collapsed && leftPanelRef.current) {
                leftPanelRef.current.collapse();
              } else if (!collapsed && leftPanelRef.current) {
                leftPanelRef.current.expand();
              }
            }}
            isMobile={false}
            onMobileSwitch={() => {}}
          />
        </Panel>

        {/* Left resize handle */}
        <PanelResizeHandle
          className={cn(
            'w-[1px] bg-border hover:bg-primary/50 transition-colors data-[resize-handle-active]:bg-primary',
            leftPanelCollapsed && 'w-0'
          )}
          data-testid="left-panel-resize-handle"
        />

        {/* Main Content Panel */}
        <Panel
          id="git-main-panel"
          defaultSize={PANEL_SIZES.MAIN.DEFAULT}
          minSize={PANEL_SIZES.MAIN.MIN}
          data-testid="git-main-panel"
        >
          {/* Main content toolbar (shown when panels are collapsed) */}
          {(leftPanelCollapsed || rightPanelCollapsed) && (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/20">
              {leftPanelCollapsed && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={toggleLeftPanel}
                  title={`Show sidebar (Cmd/${navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl'}+B)`}
                >
                  <PanelLeftOpen className="h-3.5 w-3.5" />
                </Button>
              )}
              <span className="font-medium text-sm flex-1">Git Editor</span>
              {/* Keyboard shortcuts button */}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={toggleHelpDialog}
                title={`Keyboard shortcuts (Cmd+?)`}
              >
                <Keyboard className="h-3.5 w-3.5" />
              </Button>
              {rightPanelCollapsed && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={toggleRightPanel}
                  title={`Show actions (Cmd/${navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl'}+Shift+B)`}
                >
                  <PanelRightOpen className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
          <GitMainContent selectedCommit={selectedCommit} onCommitSelect={setSelectedCommit} />
        </Panel>

        {/* Right resize handle */}
        <PanelResizeHandle
          className={cn(
            'w-[1px] bg-border hover:bg-primary/50 transition-colors data-[resize-handle-active]:bg-primary',
            rightPanelCollapsed && 'w-0'
          )}
          data-testid="right-panel-resize-handle"
        />

        {/* Right Action Panel */}
        <Panel
          ref={rightPanelRef}
          id="git-action-panel"
          defaultSize={PANEL_SIZES.ACTION_PANEL.DEFAULT}
          minSize={PANEL_SIZES.ACTION_PANEL.MIN}
          maxSize={PANEL_SIZES.ACTION_PANEL.MAX}
          collapsible
          collapsedSize={PANEL_SIZES.ACTION_PANEL.COLLAPSED}
          onCollapse={handleRightPanelCollapse}
          onExpand={handleRightPanelExpand}
          data-testid="git-right-panel"
        >
          <GitActionPanel
            isCollapsed={rightPanelCollapsed}
            onCollapseChange={(collapsed) => {
              if (collapsed && rightPanelRef.current) {
                rightPanelRef.current.collapse();
              } else if (!collapsed && rightPanelRef.current) {
                rightPanelRef.current.expand();
              }
            }}
            isMobile={false}
            commitDialogOpen={localCommitDialogOpen}
            onCommitDialogOpenChange={setLocalCommitDialogOpen}
          />
        </Panel>
      </PanelGroup>

      {/* Keyboard shortcuts help dialog */}
      <GitKeyboardShortcutsDialog
        open={showHelpDialog}
        onOpenChange={setShowHelpDialog}
        mode={mode}
        onModeChange={setMode}
      />
    </div>
  );
}
