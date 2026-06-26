import { ReactNode } from 'react';

import { Card } from '~/components/ui/card';
import type { Recommendation } from '~/types';

import { Section } from './Section';

interface RecommendationCardProps {
  recommendation: Recommendation;
  /** Action buttons rendered at the foot of the card (e.g. Accept / Regenerate). */
  footer?: ReactNode;
}

/**
 * Presentational render of a recommendation: rationale, session meta, and each
 * movement block. Reused by the interactive section and the free-user preview.
 */
export const RecommendationCard = ({
  recommendation,
  footer,
}: RecommendationCardProps) => {
  const { rationale, duration_minutes, format, confidence, blocks } =
    recommendation;

  return (
    <Card>
      <Section
        title="Your AI session"
        actions={
          <span className="text-xs capitalize text-muted-foreground">
            {confidence} confidence
          </span>
        }
      >
        <p className="text-sm text-muted-foreground">{rationale}</p>

        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {duration_minutes} min · {format}
        </p>

        <ul className="flex flex-col gap-1">
          {blocks.map((block, i) => (
            <li
              key={`${block.user_movement_id}-${i}`}
              className="rounded-md bg-muted/50 p-1.5"
            >
              <div className="flex items-baseline justify-between gap-1">
                <span className="text-sm font-medium">
                  {block.movement_name}
                </span>
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {block.weight_kg} kg · {block.rep_scheme.join(' / ')}
                </span>
              </div>
              {block.notes && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {block.notes}
                </p>
              )}
            </li>
          ))}
        </ul>

        {footer && <div className="flex gap-1 pt-0.5">{footer}</div>}
      </Section>
    </Card>
  );
};
