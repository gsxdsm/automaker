/**
 * Git Keyboard Shortcuts Store
 *
 * Global state for keyboard shortcuts mode and help dialog visibility.
 * Uses zustand with localStorage persistence for mode preference.
 *
 * @example
 * ```tsx
 * const { mode, showHelpDialog, setMode, toggleHelpDialog } = useGitKeyboardShortcutsStore();
 * ```
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { KeyboardMode } from '@/lib/git-keyboard-shortcuts';

// Storage key for localStorage
const STORAGE_KEY = 'git-keyboard-shortcuts-storage';

// Default selected index indicating no selection
const NO_SELECTION = -1;

interface GitKeyboardShortcutsState {
  /** Current keyboard mode (standard or vim) */
  mode: KeyboardMode;

  /** Help dialog visibility state */
  showHelpDialog: boolean;

  /** @deprecated Use local state instead to avoid conflicts between multiple file lists */
  selectedFileIndex: number;

  /** @deprecated Use local state instead to avoid conflicts between multiple commit lists */
  selectedCommitIndex: number;

  /** Set the keyboard mode */
  setMode: (mode: KeyboardMode) => void;

  /** Toggle between standard and vim mode */
  toggleMode: () => void;

  /** Set help dialog visibility */
  setShowHelpDialog: (show: boolean) => void;

  /** Toggle help dialog visibility */
  toggleHelpDialog: () => void;

  /** @deprecated Set selected file index */
  setSelectedFileIndex: (index: number) => void;

  /** @deprecated Set selected commit index */
  setSelectedCommitIndex: (index: number) => void;

  /** Reset selection indices to NO_SELECTION */
  resetSelection: () => void;
}

export const useGitKeyboardShortcutsStore = create<GitKeyboardShortcutsState>()(
  persist(
    (set) => ({
      // Default to standard mode
      mode: 'standard',

      // Help dialog initially closed
      showHelpDialog: false,

      // Selection indices (default to NO_SELECTION)
      selectedFileIndex: NO_SELECTION,
      selectedCommitIndex: NO_SELECTION,

      // Actions
      setMode: (mode) => set({ mode }),

      toggleMode: () =>
        set((state) => ({
          mode: state.mode === 'standard' ? 'vim' : 'standard',
        })),

      setShowHelpDialog: (show) => set({ showHelpDialog: show }),

      toggleHelpDialog: () => set((state) => ({ showHelpDialog: !state.showHelpDialog })),

      setSelectedFileIndex: (index) => set({ selectedFileIndex: index }),

      setSelectedCommitIndex: (index) => set({ selectedCommitIndex: index }),

      resetSelection: () =>
        set({
          selectedFileIndex: NO_SELECTION,
          selectedCommitIndex: NO_SELECTION,
        }),
    }),
    {
      name: STORAGE_KEY,
      // Only persist mode, not dialog state or selection
      partialize: (state) => ({ mode: state.mode }),
    }
  )
);
