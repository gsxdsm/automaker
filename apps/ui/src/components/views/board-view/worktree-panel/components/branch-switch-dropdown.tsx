import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { GitBranch, GitBranchPlus, Check, Search, Globe } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import type { WorktreeInfo, BranchInfo } from '../types';

interface BranchSwitchDropdownProps {
  worktree: WorktreeInfo;
  isSelected: boolean;
  branches: BranchInfo[];
  filteredBranches: BranchInfo[];
  branchFilter: string;
  isLoadingBranches: boolean;
  isSwitching: boolean;
  /** When true, renders as a standalone button (not attached to another element) */
  standalone?: boolean;
  onOpenChange: (open: boolean) => void;
  onFilterChange: (value: string) => void;
  onSwitchBranch: (worktree: WorktreeInfo, branchName: string, isRemote: boolean) => void;
  onCreateBranch: (worktree: WorktreeInfo) => void;
}

export function BranchSwitchDropdown({
  worktree,
  isSelected,
  filteredBranches,
  branchFilter,
  isLoadingBranches,
  isSwitching,
  standalone = false,
  onOpenChange,
  onFilterChange,
  onSwitchBranch,
  onCreateBranch,
}: BranchSwitchDropdownProps) {
  // Separate local and remote branches
  const localBranches = filteredBranches.filter((b) => !b.isRemote);
  const remoteBranches = filteredBranches.filter((b) => b.isRemote);

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant={standalone ? 'outline' : isSelected ? 'default' : 'outline'}
          size="sm"
          className={cn(
            'h-7 w-7 p-0',
            !standalone && 'rounded-none border-r-0',
            standalone && 'h-8 w-8 shrink-0',
            !standalone && isSelected && 'bg-primary text-primary-foreground',
            !standalone && !isSelected && 'bg-secondary/50 hover:bg-secondary'
          )}
          title="Switch branch"
        >
          <GitBranch className={standalone ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs">Switch Branch</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Filter branches..."
              value={branchFilter}
              onChange={(e) => onFilterChange(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
              onKeyPress={(e) => e.stopPropagation()}
              className="h-7 pl-7 text-xs"
              autoFocus
            />
          </div>
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-[300px] overflow-y-auto overflow-x-hidden">
          {isLoadingBranches ? (
            <DropdownMenuItem disabled className="text-xs">
              <Spinner size="xs" className="mr-2" />
              Loading branches...
            </DropdownMenuItem>
          ) : filteredBranches.length === 0 ? (
            <DropdownMenuItem disabled className="text-xs">
              {branchFilter ? 'No matching branches' : 'No branches found'}
            </DropdownMenuItem>
          ) : (
            <>
              {/* Local branches */}
              {localBranches.length > 0 && (
                <>
                  {remoteBranches.length > 0 && (
                    <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground/70 font-medium px-2 py-1">
                      Local
                    </DropdownMenuLabel>
                  )}
                  {localBranches.map((branch) => (
                    <DropdownMenuItem
                      key={branch.name}
                      onClick={() => onSwitchBranch(worktree, branch.name, false)}
                      disabled={isSwitching || branch.name === worktree.branch}
                      className="text-xs font-mono"
                    >
                      {branch.name === worktree.branch ? (
                        <Check className="w-3.5 h-3.5 mr-2 flex-shrink-0" />
                      ) : (
                        <span className="w-3.5 mr-2 flex-shrink-0" />
                      )}
                      <span className="truncate">{branch.name}</span>
                    </DropdownMenuItem>
                  ))}
                </>
              )}

              {/* Remote branches */}
              {remoteBranches.length > 0 && (
                <>
                  {localBranches.length > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground/70 font-medium px-2 py-1">
                    Remote
                  </DropdownMenuLabel>
                  {remoteBranches.map((branch) => (
                    <DropdownMenuItem
                      key={branch.name}
                      onClick={() => onSwitchBranch(worktree, branch.name, true)}
                      disabled={isSwitching}
                      className="text-xs font-mono"
                    >
                      <Globe className="w-3 h-3 mr-2 flex-shrink-0 text-muted-foreground" />
                      <span className="truncate text-muted-foreground">{branch.name}</span>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onCreateBranch(worktree)} className="text-xs">
          <GitBranchPlus className="w-3.5 h-3.5 mr-2" />
          Create New Branch...
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
