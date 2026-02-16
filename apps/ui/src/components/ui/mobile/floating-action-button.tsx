import { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Plus, GitCommit, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface FABAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  color?: string; // Optional color class for the action
  shortcut?: string; // Optional keyboard shortcut
}

export interface FloatingActionButtonProps {
  actions: FABAction[];
  mainIcon?: React.ComponentType<{ className?: string }>;
  mainLabel?: string;
  onMainClick?: () => void;
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'success' | 'destructive';
  disabled?: boolean;
  showLabels?: boolean;
  alwaysOpen?: boolean;
}

const POSITION_CLASSES = {
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
};

const SIZE_CLASSES = {
  sm: 'h-12 w-12',
  md: 'h-14 w-14',
  lg: 'h-16 w-16',
};

const VARIANT_CLASSES = {
  primary: 'bg-brand-500 hover:bg-brand-600 text-white',
  secondary: 'bg-secondary hover:bg-secondary/80 text-secondary-foreground',
  success: 'bg-green-500 hover:bg-green-600 text-white',
  destructive: 'bg-destructive hover:bg-destructive/90 text-white',
} as const;

// Constants
const FAB_ANIMATION_DELAY_MS = 50;
const FAB_ACTION_MIN_WIDTH = 120;

/**
 * Floating Action Button (FAB) for Mobile
 *
 * Provides quick access to common actions with a circular button.
 * Expands to show more actions when tapped.
 *
 * @example
 * <FloatingActionButton
 *   actions={[
 *     { id: 'commit', label: 'Commit', icon: GitCommit, onClick: handleCommit },
 *     { id: 'branch', label: 'New Branch', icon: GitBranch, onClick: handleBranch },
 *   ]}
 *   mainIcon={Plus}
 *   position="bottom-right"
 * />
 */
export function FloatingActionButton({
  actions,
  mainIcon: MainIcon = Plus,
  mainLabel = 'Actions',
  onMainClick,
  position = 'bottom-right',
  size = 'md',
  variant = 'primary',
  disabled = false,
  showLabels = true,
  alwaysOpen = false,
}: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(alwaysOpen);
  const fabRef = useRef<HTMLDivElement>(null);

  const toggleOpen = useCallback(() => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
    onMainClick?.();
  }, [disabled, onMainClick]);

  const handleActionClick = useCallback(
    (action: FABAction) => {
      action.onClick();
      if (!alwaysOpen) {
        setIsOpen(false);
      }
    },
    [alwaysOpen]
  );

  // Close FAB when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(event.target as Node)) {
        if (!alwaysOpen) {
          setIsOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, alwaysOpen]);

  // Handle escape key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !alwaysOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, alwaysOpen]);

  return (
    <div
      ref={fabRef}
      className={cn('fixed z-50 flex flex-col items-end gap-2', POSITION_CLASSES[position])}
    >
      {/* Expanded Actions */}
      {isOpen && (
        <div className="flex flex-col items-end gap-2 mb-2 animate-fab-in">
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => handleActionClick(action)}
                disabled={disabled}
                tabIndex={isOpen ? 0 : -1}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-full shadow-lg',
                  'bg-background border border-border',
                  'hover:bg-accent active:bg-accent/70',
                  'transition-all duration-200 ease-out',
                  'min-w-[120px]',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  disabled && 'opacity-50 cursor-not-allowed'
                )}
                style={{
                  animationDelay: `${index * FAB_ANIMATION_DELAY_MS}ms`,
                  transformOrigin: 'bottom right',
                }}
                aria-label={action.label}
              >
                <span className={cn('text-sm font-medium', !showLabels && 'sr-only')}>
                  {action.label}
                </span>
                <div
                  className={cn(
                    'h-8 w-8 rounded-full flex items-center justify-center',
                    action.color || VARIANT_CLASSES.primary
                  )}
                >
                  <Icon className="h-4 w-4 text-white" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Main FAB */}
      <button
        onClick={toggleOpen}
        disabled={disabled}
        tabIndex={0}
        className={cn(
          SIZE_CLASSES[size],
          'rounded-full shadow-xl',
          'flex items-center justify-center',
          'transition-all duration-300 ease-out',
          'hover:scale-105 active:scale-95',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          VARIANT_CLASSES[variant],
          isOpen && 'rotate-45',
          disabled && 'opacity-50 cursor-not-allowed hover:scale-100'
        )}
        aria-label={isOpen ? 'Close' : mainLabel}
        aria-expanded={isOpen}
        aria-haspopup={actions.length > 0 ? 'menu' : undefined}
      >
        {actions.length > 0 ? (
          isOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <MainIcon className="h-6 w-6" />
          )
        ) : (
          <MainIcon className="h-6 w-6" />
        )}
      </button>
    </div>
  );
}

/**
 * Quick Commit FAB - specialized FAB for quick commit access
 */
export interface QuickCommitFABProps {
  onCommit: () => void;
  disabled?: boolean;
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
  additionalActions?: FABAction[];
}

export function QuickCommitFAB({
  onCommit,
  disabled = false,
  position = 'bottom-right',
  additionalActions = [],
}: QuickCommitFABProps) {
  const actions: FABAction[] = [
    {
      id: 'commit',
      label: 'Commit',
      icon: GitCommit,
      onClick: onCommit,
      color: 'bg-green-500',
      shortcut: '⌘K',
    },
    ...additionalActions,
  ];

  return (
    <FloatingActionButton
      actions={actions}
      mainIcon={GitCommit}
      mainLabel="Quick Commit"
      position={position}
      variant="success"
      disabled={disabled}
    />
  );
}

/**
 * Speed Dial FAB - expands in a circular pattern
 * This is a simpler variant that shows circular buttons without labels
 */
export interface SpeedDialFABProps extends Omit<FloatingActionButtonProps, 'showLabels'> {
  direction?: 'up' | 'left' | 'right';
}

export function SpeedDialFAB({
  actions,
  direction = 'up',
  mainIcon,
  mainLabel,
  onMainClick,
  position = 'bottom-right',
  size = 'md',
  variant = 'primary',
  disabled = false,
  alwaysOpen = false,
}: SpeedDialFABProps) {
  // Use FloatingActionButton without labels for speed dial
  return (
    <FloatingActionButton
      actions={actions}
      mainIcon={mainIcon}
      mainLabel={mainLabel}
      onMainClick={onMainClick}
      position={position}
      size={size}
      variant={variant}
      disabled={disabled}
      showLabels={false}
      alwaysOpen={alwaysOpen}
    />
  );
}
