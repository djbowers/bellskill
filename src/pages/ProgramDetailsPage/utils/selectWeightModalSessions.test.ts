import { ProgramSession, WorkoutOptions } from '~/types';

import {
  SessionWithState,
  selectWeightModalSessions,
} from './selectWeightModalSessions';

const session = (
  id: string,
  weight: number,
  weightLabel: string | null = null,
): ProgramSession => ({
  id,
  programId: 'p',
  sequenceIndex: 0,
  weekNumber: 1,
  dayNumber: 1,
  title: 't',
  notes: null,
  weightLabel,
  workoutOptions: {
    workoutMode: 'complex',
    intervalTimer: 30,
    restTimer: 0,
    title: null,
    preWorkoutNotes: null,
    workoutGoal: 30,
    workoutGoalUnits: 'minutes',
    sharedWeightOneValue: weight,
    sharedWeightOneUnit: 'kilograms',
    sharedWeightTwoValue: 0,
    sharedWeightTwoUnit: 'kilograms',
    movements: [
      {
        movementName: 'Clean',
        repScheme: [1],
        weightOneValue: weight,
        weightOneUnit: 'kilograms',
        weightTwoValue: 0,
        weightTwoUnit: 'kilograms',
      },
    ],
  } as Omit<WorkoutOptions, 'startedAt'>,
});

const item = (
  id: string,
  weight: number,
  state: SessionWithState['state'],
  weightLabel: string | null = null,
): SessionWithState => ({
  session: session(id, weight, weightLabel),
  state,
});

describe('selectWeightModalSessions', () => {
  it('prefers incomplete unlabeled work (A+A mid-block after a rebase)', () => {
    const items = [
      item('w1', 24, 'done'),
      item('w2', 24, 'done'),
      item('w3', 24, 'done'),
      item('w4', 24, 'done'),
      // Rebased upcoming work at 28 — must win over stale completed 24s.
      item('w5', 28, 'upcoming'),
      item('w6', 28, 'upcoming'),
      item('d1', 20, 'upcoming', 'Deload weeks'),
      item('d2', 20, 'upcoming', 'Deload weeks'),
    ];

    const modal = selectWeightModalSessions(items);
    expect(modal.map((s) => s.id)).toEqual(['w5', 'w6']);
  });

  it('falls back to completed unlabeled work when only deload remains (A+A week 4)', () => {
    const items = [
      item('w1', 28, 'done'),
      item('w2', 28, 'done'),
      item('w3', 28, 'done'),
      item('w4', 28, 'done'),
      item('w5', 28, 'done'),
      item('w6', 28, 'done'),
      item('d1', 20, 'upcoming', 'Deload weeks'),
      item('d2', 20, 'upcoming', 'Deload weeks'),
    ];

    const modal = selectWeightModalSessions(items);
    expect(modal.map((s) => s.id)).toEqual([
      'w1',
      'w2',
      'w3',
      'w4',
      'w5',
      'w6',
    ]);
  });

  it('uses all incomplete sessions when every session is unlabeled', () => {
    const items = [
      item('a', 24, 'done'),
      item('b', 28, 'upcoming'),
      item('c', 28, 'upcoming'),
    ];

    const modal = selectWeightModalSessions(items);
    expect(modal.map((s) => s.id)).toEqual(['b', 'c']);
  });

  it('falls back to incomplete when every session is labeled (Snatch Test)', () => {
    const items = [
      item('h1', 28, 'done', 'Heavy days'),
      item('m1', 24, 'upcoming', 'Medium days'),
      item('l1', 20, 'upcoming', 'Light days'),
      item('h2', 28, 'upcoming', 'Heavy days'),
    ];

    const modal = selectWeightModalSessions(items);
    expect(modal.map((s) => s.id)).toEqual(['m1', 'l1', 'h2']);
  });
});
