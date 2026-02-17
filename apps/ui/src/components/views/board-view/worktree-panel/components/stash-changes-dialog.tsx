/**
 * Stash Changes Dialog
 *
 * Prompts the user to stash their uncommitted changes before switching branches.
 * Provides clear information about what will happen and allows the user to confirm
 * or cancel the operation.
 */

import { GitBranch } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface StashChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  targetBranch: string;
  isRemoteBranch?: boolean;
}

export function StashChangesDialog({
  open,
  onOpenChange,
  onConfirm,
  targetBranch,
  isRemoteBranch = false,
}: StashChangesDialogProps) {
  const branchLabel = isRemoteBranch
    ? `remote branch "${targetBranch}"`
    : `branch "${targetBranch}"`;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      title="Stash Changes & Switch Branch"
      description={`You have uncommitted changes. To switch to ${branchLabel}, your changes will be stashed and automatically restored on the new branch. If conflicts occur, the stash will be preserved for manual resolution.`}
      icon={GitBranch}
      iconClassName="text-primary"
      confirmText="Stash & Switch"
      cancelText="Cancel"
    />
  );
}
