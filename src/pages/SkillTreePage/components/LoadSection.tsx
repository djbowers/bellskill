import { BELL_LADDER_KG, formatBell } from '~/utils';

import { DerivedLoad } from '../utils/deriveNodeStates';

const formatReachedDate = (date: Date) =>
  date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/**
 * The ladder from the lightest bell to this node's target, filled up to the
 * heaviest the user has logged. Bells past the target are not shown — the node
 * is about reaching it, not about how far beyond you go.
 */
export const LoadSection = ({
  load,
  movements,
}: {
  load: DerivedLoad;
  movements: readonly string[];
}) => {
  const rungs = BELL_LADDER_KG.filter((bell) => bell <= load.targetKg);

  return (
    <div className="flex flex-col gap-1">
      <ul className="flex flex-wrap gap-0.5" aria-label="Bell ladder">
        {rungs.map((bell) => {
          const reached = load.edgeKg !== null && bell <= load.edgeKg;
          return (
            <li
              key={bell}
              data-reached={reached}
              className={
                reached
                  ? 'rounded border border-primary bg-primary/10 px-1 font-mono text-xs tabular-nums'
                  : 'rounded border border-border/60 px-1 font-mono text-xs tabular-nums text-muted-foreground'
              }
            >
              {bell}
            </li>
          );
        })}
      </ul>

      <p>
        {load.edgeKg === null
          ? `No bell logged yet — target ${formatBell(load.targetKg)}.`
          : `Heaviest logged: ${formatBell(load.edgeKg)}${
              load.reachedAt ? ` on ${formatReachedDate(load.reachedAt)}` : ''
            } · target ${formatBell(load.targetKg)}.`}
      </p>

      {movements.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Counts: {movements.join(', ')}.
        </p>
      )}
    </div>
  );
};
