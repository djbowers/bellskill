import { Program } from '~/types';

import { StackFitNote } from './StackFitNote';

const program = (
  title: string,
  focusTags: Program['focusTags'],
  systemicDemand: Program['systemicDemand'],
) => ({ id: title, title, focusTags, systemicDemand }) as Program;

const dfw = program(
  'Dry Fighting Weight',
  ['strength', 'hypertrophy', 'conditioning'],
  'high',
);
const swings = program(
  '10,000 Swing Challenge',
  ['conditioning', 'endurance', 'power'],
  'high',
);
const easyStrength = program('Easy Strength', ['strength', 'skill'], 'low');
const aaProtocol = program(
  'A+A Protocol "Plan A"',
  ['power', 'endurance', 'conditioning'],
  'moderate',
);
const kettlebellMile = program(
  'The Kettlebell Mile',
  ['endurance', 'conditioning'],
  'moderate',
);

export default {
  component: StackFitNote,
};

/** Two high-demand programs: over the recovery budget. */
export const Conflict = {
  args: { candidate: swings, active: [dfw] },
};

/** The classic hard/easy pairing — workable, but the budget is full. */
export const AtBudget = {
  args: { candidate: dfw, active: [easyStrength] },
};

/** Same adaptation bought twice. */
export const Redundant = {
  args: { candidate: kettlebellMile, active: [aaProtocol] },
};

/** A clean pairing renders nothing at all. */
export const GoodPairing = {
  args: {
    candidate: easyStrength,
    active: [
      program('Simple & Sinister', ['power', 'strength', 'mobility'], 'low'),
    ],
  },
};
