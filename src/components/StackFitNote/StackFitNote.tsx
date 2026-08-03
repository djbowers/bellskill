import { Card, CardContent } from '~/components/ui/card';
import { Program } from '~/types';
import { assessStackFit, stackFitHeadline } from '~/utils';

interface Props {
  candidate: Program;
  /** Programs already running. Empty means there's nothing to stack against. */
  active: Program[];
}

/**
 * Pre-enroll advice on adding one more concurrent program. Renders nothing when
 * there's nothing to say — the first program, an unrated candidate, or a stack
 * with no issues worth a paragraph.
 *
 * Advisory only: it sits above the enroll buttons and never disables them.
 */
export const StackFitNote = ({ candidate, active }: Props) => {
  const fit = assessStackFit(candidate, active);
  if (!fit || fit.verdict === 'good') return null;

  const conflict = fit.verdict === 'conflict';

  return (
    <Card
      className={conflict ? 'border-destructive' : undefined}
      role="note"
      aria-label="Stacking advice"
    >
      <CardContent className="flex flex-col gap-0.5 pt-2">
        <p
          className={`text-sm font-medium ${conflict ? 'text-destructive' : ''}`}
        >
          {stackFitHeadline(fit)}
        </p>
        {fit.reasons.map((reason) => (
          <p key={reason} className="text-xs text-muted-foreground">
            {reason}
          </p>
        ))}
        <p className="text-xs text-muted-foreground">
          You can start it anyway — this is a heads-up, not a rule.
        </p>
      </CardContent>
    </Card>
  );
};
