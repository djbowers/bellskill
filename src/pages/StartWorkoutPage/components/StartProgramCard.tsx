import { ArrowRightIcon, MapIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';

import { Card } from '~/components/ui/card';

/**
 * The un-enrolled counterpart to BuildCustomCard: a quiet bordered entry into
 * the programs catalog, kept calm so the quick-start hero stays the focus.
 */
export const StartProgramCard = () => {
  return (
    <Card>
      <Link to="/programs" className="flex w-full items-center gap-2 p-2">
        <span
          aria-hidden="true"
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          <MapIcon className="h-2.5 w-2.5" />
        </span>
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-sm font-semibold leading-none">
            Start a program
          </span>
          <span className="text-sm text-muted-foreground">
            Follow a structured plan, week by week.
          </span>
        </span>
        <ArrowRightIcon
          className="h-2.5 w-2.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </Link>
    </Card>
  );
};
