/**
 * Git Keyboard Shortcuts Hook
 *
 * Manages keyboard shortcuts for git operations.
 * Handles both standard and vim-style modes.
 */

import { useEffect, useCallback, useRef } from 'react';
import { getShortcuts, matchesShortcut, type KeyboardMode } from '@/lib/git-keyboard-shortcuts';

// Timeout for vim double-key sequences (ms)
const VIM_DOUBLE_KEY_TIMEOUT = 500;

// Action to handler mapping for cleaner code
const ACTION_HANDLERS: Record<string, keyof GitKeyboardShortcutHandlers> = {
  'stage-toggle': 'onStageToggle',
  unstage: 'onUnstage',
  'view-diff': 'onViewDiff',
  'quick-commit': 'onQuickCommit',
  'checkout-branch': 'onCheckoutBranch',
  'create-branch': 'onCreateBranch',
  pull: 'onPull',
  push: 'onPush',
  refresh: 'onRefresh',
  'toggle-sidebar': 'onToggleSidebar',
  'show-help': 'onShowHelp',
  'navigate-up': 'onNavigateUp',
  'navigate-down': 'onNavigateDown',
  'navigate-left': 'onNavigateLeft',
  'navigate-right': 'onNavigateRight',
  'search-commits': 'onSearchCommits',
  'goto-top': 'onGotoTop',
  'goto-bottom': 'onGotoBottom',
  quit: 'onQuit',
  'force-quit': 'onForceQuit',
};

export interface GitKeyboardShortcutHandlers {
  // File operations
  onStageToggle?: () => void;
  onViewDiff?: () => void;

  // Commit operations
  onQuickCommit?: () => void;

  // Branch operations
  onCheckoutBranch?: () => void;
  onCreateBranch?: () => void;

  // Sync operations
  onPull?: () => void;
  onPush?: () => void;

  // View operations
  onRefresh?: () => void;
  onToggleSidebar?: () => void;
  onShowHelp?: () => void;

  // Navigation
  onNavigateUp?: () => void;
  onNavigateDown?: () => void;
  onNavigateLeft?: () => void;
  onNavigateRight?: () => void;
  onSearchCommits?: () => void;
  onGotoTop?: () => void;
  onGotoBottom?: () => void;

  // Vim specific
  onUnstage?: () => void;
  onQuit?: () => void;
  onForceQuit?: () => void;
}

interface UseGitKeyboardShortcutsOptions {
  mode: KeyboardMode;
  enabled?: boolean;
  handlers: GitKeyboardShortcutHandlers;
  /**
   * Element to attach keyboard listeners to.
   * Defaults to window.
   */
  target?: HTMLElement | Window;
}

/**
 * Hook for git keyboard shortcuts
 *
 * @example
 * ```tsx
 * const handlers = {
 *   onQuickCommit: () => setCommitDialogOpen(true),
 *   onRefresh: () => refetch(),
 *   onToggleSidebar: () => toggleSidebar(),
 *   onStageToggle: () => stageSelectedFile(),
 *   onNavigateUp: () => selectPrevious(),
 *   onNavigateDown: () => selectNext(),
 * };
 *
 * useGitKeyboardShortcuts({
 *   mode: keyboardMode,
 *   enabled: true,
 *   handlers,
 * });
 * ```
 */
export function useGitKeyboardShortcuts({
  mode,
  enabled = true,
  handlers,
  target = window,
}: UseGitKeyboardShortcutsOptions) {
  const lastKeyRef = useRef<string | null>(null);
  const lastKeyTimeRef = useRef<number>(0);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore if in input/textarea/contenteditable
      const targetElement = event.target as HTMLElement;
      if (
        targetElement.tagName === 'INPUT' ||
        targetElement.tagName === 'TEXTAREA' ||
        targetElement.contentEditable === 'true'
      ) {
        return;
      }

      // Ignore if a modifier key alone is pressed
      if (
        event.key === 'Meta' ||
        event.key === 'Control' ||
        event.key === 'Alt' ||
        event.key === 'Shift'
      ) {
        return;
      }

      // Handle vim double-key sequences (gg for goto bottom)
      if (mode === 'vim' && event.key === 'g') {
        const now = Date.now();
        const isDoubleKey =
          lastKeyRef.current === 'g' && now - lastKeyTimeRef.current < VIM_DOUBLE_KEY_TIMEOUT;

        lastKeyRef.current = 'g';
        lastKeyTimeRef.current = now;

        if (isDoubleKey) {
          event.preventDefault();
          handlers.onGotoBottom?.();
          lastKeyRef.current = null;
          lastKeyTimeRef.current = 0;
        }
        return;
      }

      const shortcuts = getShortcuts(mode);

      // Check each shortcut to see if it matches
      for (const shortcut of Object.values(shortcuts)) {
        if (matchesShortcut(event, shortcut)) {
          event.preventDefault();

          // Use action-to-handler mapping
          const handlerKey = ACTION_HANDLERS[shortcut.action];
          if (handlerKey && handlers[handlerKey]) {
            (handlers[handlerKey] as () => void)();
          }

          return;
        }
      }
    },
    [enabled, mode, handlers]
  );

  // Set up keyboard event listener
  useEffect(() => {
    if (!enabled) return;

    const eventTarget = target instanceof Window ? window : target;

    eventTarget.addEventListener('keydown', handleKeyDown);
    return () => eventTarget.removeEventListener('keydown', handleKeyDown);
  }, [enabled, target, handleKeyDown]);

  return {
    /** Current keyboard mode */
    mode,
  };
}

/**
 * Check if keyboard event is a navigation key
 */
export function isNavigationKey(event: KeyboardEvent): boolean {
  const navigationKeys = [
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'PageUp',
    'PageDown',
    'Home',
    'End',
  ];
  return navigationKeys.includes(event.key) || navigationKeys.includes(event.code);
}

/**
 * Check if keyboard event should be ignored (in input field)
 */
export function shouldIgnoreKeyboardEvent(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement;
  return (
    target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true'
  );
}
