import { ChevronDownIcon } from '@heroicons/react/24/outline';

import { cn } from '~/lib/utils';
import { Program } from '~/types';

import { BrowseProgramsList } from './BrowseProgramsList';

export interface BrowseProgramsSectionProps {
  programs: Program[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Owner-only: shows a release/unrelease toggle on each shared program. */
  showReleasedBadge: boolean;
}

/**
 * The catalog, folded away by default. Your own programs are what you came for
 * on a return visit, so the seed list waits behind a disclosure instead of
 * pushing them below the fold — but it opens itself for anyone who has no
 * programs yet, because then it is the whole page.
 */
export const BrowseProgramsSection = ({
  programs,
  open,
  onOpenChange,
  showReleasedBadge,
}: BrowseProgramsSectionProps) => (
  <div className="flex flex-col gap-1">
    <h2>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="browse-programs-list"
        onClick={() => onOpenChange(!open)}
        className="flex w-full items-center gap-1.5 rounded-md border bg-card p-2 text-left shadow-sm transition-colors hover:bg-secondary"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-semibold leading-none">
            Browse programs
          </span>
          <span className="text-xs text-muted-foreground">
            {programs.length} ready-made plans to start from
          </span>
        </span>
        <ChevronDownIcon
          aria-hidden
          className={cn(
            'h-2 w-2 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
    </h2>
    {open && (
      <div id="browse-programs-list">
        <BrowseProgramsList
          programs={programs}
          showReleasedBadge={showReleasedBadge}
        />
      </div>
    )}
  </div>
);
