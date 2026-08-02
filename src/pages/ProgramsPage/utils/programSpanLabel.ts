import { Program } from '~/types';

/**
 * The scan-rail monogram for a program: how long a commitment it is, in the
 * fewest characters that still say something true. A repeating workout has no
 * finish line, so it reads as a loop rather than a week count; a program with
 * no sessions yet has no span to show. The full cadence still reads out in the
 * row's subtitle — this is a scanning aid, not the authority.
 */
export const programSpanLabel = (program: Program): string => {
  if (program.defaultAutoRepeat) return '∞';
  return program.numWeeks ? `${program.numWeeks}w` : '–';
};
