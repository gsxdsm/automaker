/**
 * Git Keyboard Shortcuts Configuration
 *
 * Centralized keyboard shortcuts for git operations.
 * Supports both standard mode and vim-style mode.
 */

export interface ShortcutDefinition {
  key: string;
  cmdKey?: boolean; // Cmd/Ctrl required
  shiftKey?: boolean; // Shift required
  altKey?: boolean; // Alt/Option required
  description: string;
  category: 'file-operations' | 'commit' | 'branch' | 'navigation' | 'view' | 'vim';
  action: string;
}

// Standard mode keyboard shortcuts
export const STANDARD_SHORTCUTS: Record<string, ShortcutDefinition> = {
  // File operations
  stage_file: {
    key: ' ',
    description: 'Stage/unstage selected file',
    category: 'file-operations',
    action: 'stage-toggle',
  },
  view_diff: {
    key: 'Enter',
    description: 'View diff for selected item',
    category: 'file-operations',
    action: 'view-diff',
  },

  // Commit operations
  quick_commit: {
    key: 'Enter',
    cmdKey: true,
    description: 'Open commit dialog (Cmd+Enter)',
    category: 'commit',
    action: 'quick-commit',
  },

  // Branch operations
  checkout_branch: {
    key: 'b',
    cmdKey: true,
    shiftKey: true,
    description: 'Checkout branch (Cmd+Shift+B)',
    category: 'branch',
    action: 'checkout-branch',
  },
  create_branch: {
    key: 'n',
    cmdKey: true,
    description: 'Create new branch (Cmd+N)',
    category: 'branch',
    action: 'create-branch',
  },

  // Sync operations
  pull: {
    key: 'p',
    cmdKey: true,
    shiftKey: true,
    description: 'Pull changes (Cmd+Shift+P)',
    category: 'branch',
    action: 'pull',
  },
  push: {
    key: 'u',
    cmdKey: true,
    shiftKey: true,
    description: 'Push changes (Cmd+Shift+U)',
    category: 'branch',
    action: 'push',
  },

  // View operations
  refresh: {
    key: 'r',
    cmdKey: true,
    description: 'Refresh git status (Cmd+R)',
    category: 'view',
    action: 'refresh',
  },
  toggle_sidebar: {
    key: 'b',
    cmdKey: true,
    description: 'Toggle sidebar (Cmd+B)',
    category: 'view',
    action: 'toggle-sidebar',
  },
  show_help: {
    key: '/',
    cmdKey: true,
    description: 'Show keyboard shortcuts (Cmd+/)',
    category: 'view',
    action: 'show-help',
  },

  // Navigation
  navigate_up: {
    key: 'ArrowUp',
    description: 'Navigate up',
    category: 'navigation',
    action: 'navigate-up',
  },
  navigate_down: {
    key: 'ArrowDown',
    description: 'Navigate down',
    category: 'navigation',
    action: 'navigate-down',
  },
  navigate_left: {
    key: 'ArrowLeft',
    description: 'Navigate left/collapse',
    category: 'navigation',
    action: 'navigate-left',
  },
  navigate_right: {
    key: 'ArrowRight',
    description: 'Navigate right/expand',
    category: 'navigation',
    action: 'navigate-right',
  },
  search_commits: {
    key: 'f',
    cmdKey: true,
    description: 'Search commits (Cmd+F)',
    category: 'navigation',
    action: 'search-commits',
  },
};

// Vim-style keyboard shortcuts
export const VIM_SHORTCUTS: Record<string, ShortcutDefinition> = {
  // Vim normal mode mappings
  stage_file: {
    key: 's',
    description: 'Stage selected file (vim: s)',
    category: 'vim',
    action: 'stage-toggle',
  },
  unstage_file: {
    key: 'u',
    description: 'Unstage selected file (vim: u)',
    category: 'vim',
    action: 'unstage',
  },
  view_diff: {
    key: 'd',
    description: 'View diff (vim: d)',
    category: 'vim',
    action: 'view-diff',
  },
  commit: {
    key: 'c',
    description: 'Open commit dialog (vim: c)',
    category: 'vim',
    action: 'quick-commit',
  },
  pull: {
    key: 'p',
    description: 'Pull changes (vim: p)',
    category: 'vim',
    action: 'pull',
  },
  push: {
    key: 'P',
    shiftKey: true,
    description: 'Push changes (vim: P)',
    category: 'vim',
    action: 'push',
  },
  create_branch: {
    key: 'b',
    description: 'Create branch (vim: b)',
    category: 'vim',
    action: 'create-branch',
  },
  checkout_branch: {
    key: 'o',
    description: 'Checkout branch (vim: o)',
    category: 'vim',
    action: 'checkout-branch',
  },
  refresh: {
    key: 'r',
    description: 'Refresh (vim: r)',
    category: 'vim',
    action: 'refresh',
  },
  search: {
    key: '/',
    description: 'Search (vim: /)',
    category: 'vim',
    action: 'search-commits',
  },
  quit: {
    key: 'q',
    description: 'Close dialog/panel (vim: q)',
    category: 'vim',
    action: 'quit',
  },
  force_quit: {
    key: 'q',
    shiftKey: true,
    description: 'Force close (vim: Q)',
    category: 'vim',
    action: 'force-quit',
  },
  help: {
    key: '?',
    description: 'Show help (vim: ?)',
    category: 'vim',
    action: 'show-help',
  },
  // Navigation (same as standard)
  navigate_up: {
    key: 'k',
    description: 'Navigate up (vim: k)',
    category: 'vim',
    action: 'navigate-up',
  },
  navigate_down: {
    key: 'j',
    description: 'Navigate down (vim: j)',
    category: 'vim',
    action: 'navigate-down',
  },
  navigate_left: {
    key: 'h',
    description: 'Navigate left (vim: h)',
    category: 'vim',
    action: 'navigate-left',
  },
  navigate_right: {
    key: 'l',
    description: 'Navigate right (vim: l)',
    category: 'vim',
    action: 'navigate-right',
  },
  goto_top: {
    key: 'g',
    shiftKey: true,
    description: 'Go to top (vim: G)',
    category: 'vim',
    action: 'goto-top',
  },
  goto_bottom: {
    key: 'g',
    description: 'Go to bottom (vim: gg)',
    category: 'vim',
    action: 'goto-bottom',
  },
};

export type KeyboardMode = 'standard' | 'vim';

/**
 * Get shortcuts for current mode
 */
export function getShortcuts(mode: KeyboardMode = 'standard'): Record<string, ShortcutDefinition> {
  return mode === 'vim' ? VIM_SHORTCUTS : STANDARD_SHORTCUTS;
}

/**
 * Format shortcut for display
 */
export function formatShortcut(shortcut: ShortcutDefinition): string {
  const parts: string[] = [];

  if (shortcut.cmdKey) {
    parts.push(navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl');
  }
  if (shortcut.shiftKey) {
    parts.push('⇧');
  }
  if (shortcut.altKey) {
    parts.push(navigator.userAgent.includes('Mac') ? '⌥' : 'Alt');
  }

  let key = shortcut.key;
  if (key === ' ') {
    key = 'Space';
  } else if (key === 'ArrowUp') {
    key = '↑';
  } else if (key === 'ArrowDown') {
    key = '↓';
  } else if (key === 'ArrowLeft') {
    key = '←';
  } else if (key === 'ArrowRight') {
    key = '→';
  } else if (key === 'Enter') {
    key = '↵';
  }

  parts.push(key);

  return parts.join('+');
}

/**
 * Check if keyboard event matches a shortcut
 */
export function matchesShortcut(event: KeyboardEvent, shortcut: ShortcutDefinition): boolean {
  const cmdPressed = event.metaKey || event.ctrlKey;
  const matchesKey = event.key === shortcut.key || event.code === shortcut.key;

  return (
    matchesKey &&
    !!shortcut.cmdKey === cmdPressed &&
    !!shortcut.shiftKey === event.shiftKey &&
    !!shortcut.altKey === event.altKey
  );
}

/**
 * Get all shortcuts grouped by category
 */
export function getShortcutsByCategory(mode: KeyboardMode = 'standard') {
  const shortcuts = getShortcuts(mode);
  const grouped: Record<string, ShortcutDefinition[]> = {};

  for (const shortcut of Object.values(shortcuts)) {
    if (!grouped[shortcut.category]) {
      grouped[shortcut.category] = [];
    }
    grouped[shortcut.category].push(shortcut);
  }

  return grouped;
}

/**
 * Category display names
 */
export const CATEGORY_NAMES: Record<string, string> = {
  'file-operations': 'File Operations',
  commit: 'Commit',
  branch: 'Branch & Sync',
  navigation: 'Navigation',
  view: 'View',
  vim: 'Vim Mode',
};
