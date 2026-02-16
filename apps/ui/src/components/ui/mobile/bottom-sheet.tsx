import { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  title?: string;
  description?: string;
  showCloseButton?: boolean;
  height?: 'auto' | 'half' | 'full' | number;
  snapPoints?: number[]; // Array of height percentages (e.g., [0.25, 0.5, 0.75, 1])
  defaultSnap?: number; // Index of default snap point
  dismissible?: boolean;
  onClose?: () => void;
}

// Constants
const DISMISS_THRESHOLD = 100; // px to trigger dismiss
const DEFAULT_BOTTOM_SHEET_HEIGHT = '80vh';

/**
 * Bottom Sheet Modal Component for Mobile
 *
 * Provides a slide-up modal that can be dismissed by dragging down.
 * Supports snap points at different heights.
 *
 * @example
 * <BottomSheet
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   title="Actions"
 *   height="half"
 * >
 *   <div>Content</div>
 * </BottomSheet>
 */
export function BottomSheet({
  open,
  onOpenChange,
  children,
  title,
  description,
  showCloseButton = true,
  height = 'auto',
  snapPoints,
  defaultSnap = 0,
  dismissible = true,
  onClose,
}: BottomSheetProps) {
  const [currentSnap, setCurrentSnap] = useState(defaultSnap);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  const sheetRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number>(0);
  const startHeight = useRef<number>(0);

  // Calculate height based on prop
  const getHeightClass = () => {
    if (typeof height === 'number') {
      return { maxHeight: `${height}px` };
    }
    switch (height) {
      case 'half':
        return { maxHeight: '50vh' };
      case 'full':
        return { maxHeight: '100vh' };
      case 'auto':
      default:
        return { maxHeight: DEFAULT_BOTTOM_SHEET_HEIGHT };
    }
  };

  // Handle touch start for drag
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!dismissible) return;
      startY.current = e.touches[0].clientY;
      startHeight.current = sheetRef.current?.offsetHeight || 0;
      setIsDragging(true);
    },
    [dismissible]
  );

  // Handle touch move for drag
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging || !dismissible) return;

      const currentY = e.touches[0].clientY;
      const deltaY = currentY - startY.current;

      // Only allow dragging down
      if (deltaY > 0) {
        setDragOffset(deltaY);
      }
    },
    [isDragging, dismissible]
  );

  // Handle touch end for drag
  const handleTouchEnd = useCallback(() => {
    if (!isDragging || !dismissible) return;

    if (dragOffset > DISMISS_THRESHOLD) {
      // Dismiss the sheet
      handleClose();
    } else {
      // Spring back
      setDragOffset(0);
    }

    setIsDragging(false);
  }, [isDragging, dragOffset, dismissible, handleClose]);

  // Handle close
  const handleClose = useCallback(() => {
    onOpenChange(false);
    setDragOffset(0);
    onClose?.();
  }, [onOpenChange, onClose]);

  // Handle overlay click
  const handleOverlayClick = useCallback(() => {
    if (dismissible) {
      handleClose();
    }
  }, [dismissible, handleClose]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible && open) {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [dismissible, open, handleClose]);

  // Reset drag offset when sheet opens
  useEffect(() => {
    if (open) {
      setDragOffset(0);
      setCurrentSnap(defaultSnap);
    }
  }, [open, defaultSnap]);

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    // Cleanup function to ensure body overflow is reset
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Overlay */}
      <div
        ref={overlayRef}
        className={cn('absolute inset-0 bg-black/50 transition-opacity duration-300', 'touch-none')}
        style={{
          opacity: open ? 1 : 0,
        }}
        onClick={handleOverlayClick}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          'relative z-10 w-full max-w-lg bg-background rounded-t-2xl shadow-xl',
          'transition-transform duration-300 ease-out',
          isDragging && 'transition-none'
        )}
        style={{
          ...getHeightClass(),
          transform: `translateY(${dragOffset}px)`,
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'bottom-sheet-title' : undefined}
        aria-describedby={description ? 'bottom-sheet-description' : undefined}
      >
        {/* Drag Handle */}
        <div
          className={cn(
            'flex justify-center py-3 cursor-grab active:cursor-grabbing touch-none',
            !dismissible && 'cursor-default'
          )}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1.5 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-4 pb-4 border-b border-border">
            <div className="flex-1">
              {title && (
                <h2 id="bottom-sheet-title" className="text-lg font-semibold text-foreground">
                  {title}
                </h2>
              )}
              {description && (
                <p id="bottom-sheet-description" className="text-sm text-muted-foreground mt-1">
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-8 w-8"
                onClick={handleClose}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto px-4 py-4 max-h-[calc(80vh-8rem)]">{children}</div>
      </div>
    </div>
  );
}

/**
 * Simplified bottom sheet with snap points
 * Snaps to predefined heights when dragging
 * Note: Full snap point implementation requires gesture detection
 * This is a simplified version that sets initial height
 */
export function SnapBottomSheet({
  open,
  onOpenChange,
  children,
  snapPoints = [0.25, 0.5, 0.9],
  defaultSnap = 1,
}: BottomSheetProps) {
  const snapHeight = snapPoints[Math.min(defaultSnap, snapPoints.length - 1)] * 100;

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} height={snapHeight}>
      {children}
    </BottomSheet>
  );
}
