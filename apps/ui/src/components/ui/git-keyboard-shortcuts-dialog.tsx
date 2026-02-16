/**
 * Git Keyboard Shortcuts Help Dialog
 *
 * Displays all available keyboard shortcuts in a modal dialog.
 * Supports both standard and vim modes.
 */

import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  getShortcuts,
  getShortcutsByCategory,
  formatShortcut,
  CATEGORY_NAMES,
  type KeyboardMode,
} from '@/lib/git-keyboard-shortcuts';
import {
  FileDiff,
  GitCommit,
  GitBranch,
  Navigation,
  Eye,
  Type,
  X,
  Keyboard,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: KeyboardMode;
  onModeChange: (mode: KeyboardMode) => void;
}

// Category icons
const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'file-operations': FileDiff,
  commit: GitCommit,
  branch: GitBranch,
  navigation: Navigation,
  view: Eye,
  vim: Type,
};

export function GitKeyboardShortcutsDialog({
  open,
  onOpenChange,
  mode,
  onModeChange,
}: KeyboardShortcutsDialogProps) {
  const shortcutsByCategory = getShortcutsByCategory(mode);

  // Handle Esc key to close dialog
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Keyboard className="h-5 w-5 text-brand-500" />
              <DialogTitle>Keyboard Shortcuts</DialogTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription>
            Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Cmd+/</kbd> to toggle this
            dialog
          </DialogDescription>
        </DialogHeader>

        {/* Mode Toggle */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Label htmlFor="vim-mode-toggle" className="text-sm font-medium cursor-pointer">
              Vim Mode
            </Label>
            <span className="text-xs text-muted-foreground">
              ({mode === 'vim' ? 'hjkl navigation' : 'Standard shortcuts'})
            </span>
          </div>
          <Switch
            id="vim-mode-toggle"
            checked={mode === 'vim'}
            onCheckedChange={(checked) => onModeChange(checked ? 'vim' : 'standard')}
          />
        </div>

        {/* Shortcuts List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {Object.entries(shortcutsByCategory).map(([category, shortcuts]) => {
            const CategoryIcon = CATEGORY_ICONS[category] || Keyboard;
            const categoryName = CATEGORY_NAMES[category] || category;

            return (
              <div key={category}>
                <div className="flex items-center gap-2 mb-3">
                  <CategoryIcon className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">{categoryName}</h3>
                </div>
                <div className="space-y-2">
                  {shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.action}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{shortcut.description}</span>
                      </div>
                      <kbd className="px-2 py-1 bg-background border border-border rounded text-xs font-mono shadow-sm">
                        {formatShortcut(shortcut)}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer - Navigation hints */}
        <div className="flex-shrink-0 border-t border-border bg-muted/20 px-6 py-3">
          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-background border border-border rounded font-mono">
                <ArrowUp className="h-3 w-3" />
              </kbd>
              <kbd className="px-1.5 py-0.5 bg-background border border-border rounded font-mono">
                <ArrowDown className="h-3 w-3" />
              </kbd>
              <span>Navigate</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-background border border-border rounded font-mono">
                Esc
              </kbd>
              <span>Close</span>
            </div>
            {mode === 'standard' && (
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-background border border-border rounded font-mono">
                  Space
                </kbd>
                <span>Stage file</span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
