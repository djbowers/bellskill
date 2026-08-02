import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';

import { ProgramTags } from '~/components';
import { Card } from '~/components/ui/card';
import { Program } from '~/types';
import { programCadenceLabel } from '~/utils';

import { programSpanLabel } from '../utils';

export interface BrowseProgramsListProps {
  programs: Program[];
  /** Owner-only: surfaces the release state of a shared program. */
  showReleasedBadge: boolean;
}

/**
 * The catalog. Each row leads with a span monogram — "8w", "∞", "–" — so the
 * list can be scanned by commitment length before it's read by title. Rows
 * navigate to the pre-enroll details page; nothing enrolls from here.
 */
export const BrowseProgramsList = ({
  programs,
  showReleasedBadge,
}: BrowseProgramsListProps) => (
  <Card className="divide-y overflow-hidden">
    {programs.map((program) => (
      <Link
        key={program.id}
        to={`/programs/${program.id}/details`}
        aria-label={`View ${program.title}`}
        className="flex items-center gap-1.5 p-2 transition-colors hover:bg-secondary"
      >
        <span
          aria-hidden
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold tabular-nums text-primary"
        >
          {programSpanLabel(program)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-sm font-semibold leading-tight">
            {program.title}
            {program.defaultAutoRepeat && (
              <span className="rounded bg-secondary px-0.5 text-xs font-normal text-muted-foreground">
                Repeats
              </span>
            )}
            {showReleasedBadge && program.releasedAt && (
              <span className="rounded bg-secondary px-0.5 text-xs font-normal text-muted-foreground">
                Released
              </span>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {program.authorName ? `${program.authorName} · ` : ''}
            {programCadenceLabel(program) ?? 'No sessions yet'}
          </p>
          <ProgramTags tags={program.focusTags} className="mt-0.5" />
        </div>
        <ChevronRightIcon
          aria-hidden
          className="h-2 w-2 shrink-0 text-muted-foreground"
        />
      </Link>
    ))}
  </Card>
);
