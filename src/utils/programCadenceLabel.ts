import { Program } from '~/types';

/**
 * The one-line cadence descriptor shown under a program's title in the browse
 * list and details header. A repeating workout (Simple & Sinister, the Onnit
 * circuit) has no finish line, so it reads as "Repeating workout" rather than a
 * "N weeks · X/week" span. Ordinary programs show their derived cadence, or
 * `null` before any session gives them one (see {@link Program.numWeeks}).
 */
export const programCadenceLabel = (program: Program): string | null => {
  if (program.defaultAutoRepeat) return 'Repeating workout';
  return program.numWeeks && program.daysPerWeek
    ? `${program.numWeeks} weeks · ${program.daysPerWeek}/week`
    : null;
};
