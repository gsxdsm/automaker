import { useState, useCallback, useEffect, useRef } from 'react';
import { Search, Filter, X, Calendar, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { CommitHistoryFilters } from '@/hooks/git/use-commit-history';

export interface CommitFiltersProps {
  filters: CommitHistoryFilters;
  onFiltersChange: (filters: CommitHistoryFilters) => void;
  resultCount?: number;
}

// Constants
const SEARCH_DEBOUNCE_MS = 300;

export function CommitFilters({ filters, onFiltersChange, resultCount }: CommitFiltersProps) {
  const [localSearch, setLocalSearch] = useState(filters.searchQuery || '');
  const [authorFilter, setAuthorFilter] = useState(filters.author || '');
  const [sinceDate, setSinceDate] = useState(filters.since || '');
  const [untilDate, setUntilDate] = useState(filters.until || '');
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync local state when filters change externally
  useEffect(() => {
    setLocalSearch(filters.searchQuery || '');
    setAuthorFilter(filters.author || '');
    setSinceDate(filters.since || '');
    setUntilDate(filters.until || '');
  }, [filters.searchQuery, filters.author, filters.since, filters.until]);

  // Debounced search update
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== filters.searchQuery) {
        onFiltersChange({ ...filters, searchQuery: localSearch || undefined });
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [localSearch, filters, onFiltersChange]);

  const handleClearFilters = useCallback(() => {
    setAuthorFilter('');
    setSinceDate('');
    setUntilDate('');
    setLocalSearch('');
    onFiltersChange({
      ...filters,
      author: undefined,
      since: undefined,
      until: undefined,
      searchQuery: undefined,
    });
  }, [filters, onFiltersChange]);

  const handleApplyFilters = useCallback(() => {
    onFiltersChange({
      ...filters,
      author: authorFilter || undefined,
      since: sinceDate || undefined,
      until: untilDate || undefined,
    });
    setShowFilterPopover(false);
  }, [authorFilter, sinceDate, untilDate, filters, onFiltersChange]);

  const hasActiveFilters = filters.author || filters.since || filters.until || filters.searchQuery;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleApplyFilters();
      }
    },
    [handleApplyFilters]
  );

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/20">
      {/* Search input */}
      <div className="flex-1 relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          placeholder="Search commits by message, author, or hash..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="h-7 pl-8 text-xs pr-8"
        />
        {localSearch && (
          <button
            onClick={() => setLocalSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Result count */}
      {resultCount !== undefined && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {resultCount} {resultCount === 1 ? 'commit' : 'commits'}
        </span>
      )}

      {/* Filter button */}
      <Popover open={showFilterPopover} onOpenChange={setShowFilterPopover}>
        <PopoverTrigger asChild>
          <Button
            variant={hasActiveFilters ? 'default' : 'outline'}
            size="sm"
            className="h-7 px-2 gap-1.5"
          >
            <Filter className="h-3.5 w-3.5" />
            <span className="text-xs">Filter</span>
            {hasActiveFilters && (
              <span className="h-4 w-4 rounded-full bg-primary-foreground text-primary text-[10px] flex items-center justify-center">
                •
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="end">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Filters</h3>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={handleClearFilters}
                >
                  Clear all
                </Button>
              )}
            </div>

            {/* Author filter */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <User className="h-3 w-3" />
                Author
              </label>
              <Input
                placeholder="Filter by author..."
                value={authorFilter}
                onChange={(e) => setAuthorFilter(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-8 text-xs"
              />
            </div>

            {/* Date range filters */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3 w-3" />
                Date Range
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-0.5 block">Since</label>
                  <Input
                    type="date"
                    value={sinceDate}
                    onChange={(e) => setSinceDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-0.5 block">Until</label>
                  <Input
                    type="date"
                    value={untilDate}
                    onChange={(e) => setUntilDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Apply button */}
            <Button size="sm" className="w-full" onClick={handleApplyFilters}>
              Apply Filters
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
