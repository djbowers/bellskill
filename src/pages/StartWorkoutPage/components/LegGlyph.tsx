import { cn } from '~/lib/utils';

/**
 * Depicts the leg axis the way KettlebellGlyph depicts the weight axis — the
 * setup you recognize before reading. Legs only, no head or torso: the
 * bodyweight weight-mode glyph is already a whole figure, and two figures in
 * the same card would read as the same axis twice.
 *
 * Feet are what make two strokes read as legs rather than tally marks, and the
 * lifted leg is drawn without one — no ground contact is the whole point. That
 * detail needs room, so this runs larger than the bell glyph; the leg tabs are
 * two across rather than four and have it to spare.
 */
export const LegGlyph = ({
  unilateral,
  className,
}: {
  unilateral: boolean;
  className?: string;
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn('h-4 w-4', className)}
    aria-hidden
  >
    {unilateral ? (
      <>
        {/* Planted leg, with a foot. */}
        <path d="M15 3v15" />
        <path d="M13 19.5h4.5" />
        {/* Lifted leg: knee up and forward, and deliberately no foot. */}
        <path d="M9 3v6l-3.5 3" />
      </>
    ) : (
      <>
        <path d="M9 3v15" />
        <path d="M6.5 19.5H11" />
        <path d="M15 3v15" />
        <path d="M13 19.5h4.5" />
      </>
    )}
  </svg>
);
