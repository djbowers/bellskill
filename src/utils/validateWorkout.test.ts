import type { WorkoutDraft } from './validateWorkout';
import { validateWorkout } from './validateWorkout';

const movement = (
  over: Partial<WorkoutDraft['movements'][number]> = {},
): WorkoutDraft['movements'][number] => ({
  movementName: 'Swing',
  repScheme: [5, 5, 5],
  weightOneValue: 16,
  ...over,
});

const draft = (over: Partial<WorkoutDraft> = {}): WorkoutDraft => ({
  workoutMode: 'circuit',
  workoutGoal: 20,
  intervalTimer: 0,
  movements: [movement()],
  ...over,
});

const codes = (d: WorkoutDraft) => validateWorkout(d).errors.map((e) => e.code);
const warningCodes = (d: WorkoutDraft) =>
  validateWorkout(d).warnings.map((w) => w.code);

describe('validateWorkout — a valid draft', () => {
  test('a single-movement circuit workout has no issues', () => {
    expect(validateWorkout(draft())).toEqual({ errors: [], warnings: [] });
  });
});

describe('validateWorkout — no_movements', () => {
  test('errors with no movements', () => {
    expect(codes(draft({ movements: [] }))).toContain('no_movements');
  });

  test('passes with one movement', () => {
    expect(codes(draft())).not.toContain('no_movements');
  });
});

describe('validateWorkout — empty_movement_name', () => {
  test('errors on a blank name, and points at the movement', () => {
    const { errors } = validateWorkout(
      draft({ movements: [movement(), movement({ movementName: '   ' })] }),
    );
    const issue = errors.find((e) => e.code === 'empty_movement_name');
    expect(issue?.movementIndex).toBe(1);
  });

  test('passes on a named movement', () => {
    expect(codes(draft())).not.toContain('empty_movement_name');
  });
});

describe('validateWorkout — non_positive_goal', () => {
  test.each([0, -5, Number.NaN])('errors on a goal of %p', (workoutGoal) => {
    expect(codes(draft({ workoutGoal }))).toContain('non_positive_goal');
  });

  test('passes on a goal of 1', () => {
    expect(codes(draft({ workoutGoal: 1 }))).not.toContain('non_positive_goal');
  });
});

describe('validateWorkout — unequal_rungs', () => {
  const unequal = [
    movement({ repScheme: [1, 2, 3, 4] }),
    movement({ repScheme: [5, 5, 5] }),
    movement({ repScheme: [5, 5, 5] }),
  ];

  test('the 2026-08-04 bug: a 4/3/3 circuit is exactly one unequal_rungs error', () => {
    const { errors } = validateWorkout(
      draft({ workoutMode: 'circuit', movements: unequal }),
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('unequal_rungs');
  });

  test('the same movements in straight sets produce no errors', () => {
    expect(
      validateWorkout(draft({ workoutMode: 'straightSets', movements: unequal }))
        .errors,
    ).toEqual([]);
  });

  test('complex also walks one rung at a time, so it enforces the rule', () => {
    expect(codes(draft({ workoutMode: 'complex', movements: unequal }))).toContain(
      'unequal_rungs',
    );
  });

  test('equal rungs pass in every mode', () => {
    const equal = [movement(), movement()];
    for (const workoutMode of ['circuit', 'straightSets', 'complex'] as const) {
      expect(codes(draft({ workoutMode, movements: equal }))).not.toContain(
        'unequal_rungs',
      );
    }
  });

  test('a single movement can never be unequal', () => {
    expect(
      codes(draft({ movements: [movement({ repScheme: [1, 2, 3, 4] })] })),
    ).not.toContain('unequal_rungs');
  });

  test('carries both suggestions: straight sets, and padding to the longest ladder', () => {
    const { errors } = validateWorkout(draft({ movements: unequal }));
    expect(errors[0].suggestions).toEqual([
      { kind: 'switchMode', mode: 'straightSets' },
      { kind: 'padRungs', targetRungs: 4 },
    ]);
  });

  test('targetRungs is the longest ladder even when it is not first', () => {
    const { errors } = validateWorkout(
      draft({
        movements: [
          movement({ repScheme: [5] }),
          movement({ repScheme: [1, 2, 3, 4, 5, 6] }),
        ],
      }),
    );
    expect(errors[0].suggestions).toContainEqual({
      kind: 'padRungs',
      targetRungs: 6,
    });
  });
});

describe('validateWorkout — empty_rep_scheme', () => {
  test('errors on a rungless movement', () => {
    const { errors } = validateWorkout(
      draft({ movements: [movement({ repScheme: [] })] }),
    );
    const issue = errors.find((e) => e.code === 'empty_rep_scheme');
    expect(issue?.movementIndex).toBe(0);
  });

  test('passes on a one-rung movement', () => {
    expect(codes(draft({ movements: [movement({ repScheme: [1] })] }))).not.toContain(
      'empty_rep_scheme',
    );
  });

  test('an empty rep scheme does not also report invalid_reps', () => {
    expect(codes(draft({ movements: [movement({ repScheme: [] })] }))).not.toContain(
      'invalid_reps',
    );
  });
});

describe('validateWorkout — invalid_reps', () => {
  test.each([[-1], [2.5], [101]])(
    'errors on a rung of %p',
    (rung: number) => {
      expect(
        codes(draft({ movements: [movement({ repScheme: [5, rung] })] })),
      ).toContain('invalid_reps');
    },
  );

  test('passes on the boundary values 1 and 100', () => {
    expect(
      codes(draft({ movements: [movement({ repScheme: [1, 100] })] })),
    ).not.toContain('invalid_reps');
  });

  // 0 used to be rejected alongside the negatives; it is now the max sentinel.
  test('passes on 0, the max-rung sentinel', () => {
    expect(
      codes(draft({ movements: [movement({ repScheme: [5, 0] })] })),
    ).not.toContain('invalid_reps');
  });

  // Timed rungs hold seconds, so the rep ceiling would block a carry over 1:40.
  test.each([[101], [120], [300]])(
    'passes on a timed rung of %p seconds',
    (rung: number) => {
      expect(
        codes(
          draft({
            movements: [movement({ repScheme: [60, rung], timedRungs: true })],
          }),
        ),
      ).not.toContain('invalid_reps');
    },
  );

  test.each([[301], [-1], [2.5]])(
    'errors on a timed rung of %p seconds',
    (rung: number) => {
      expect(
        codes(
          draft({
            movements: [movement({ repScheme: [60, rung], timedRungs: true })],
          }),
        ),
      ).toContain('invalid_reps');
    },
  );

  test('0 is still the max sentinel on a timed movement', () => {
    expect(
      codes(
        draft({
          movements: [movement({ repScheme: [60, 0], timedRungs: true })],
        }),
      ),
    ).not.toContain('invalid_reps');
  });
});

describe('validateWorkout — non_positive_weight', () => {
  test('null is bodyweight, which is valid', () => {
    expect(
      validateWorkout(draft({ movements: [movement({ weightOneValue: null })] })),
    ).toEqual({ errors: [], warnings: [] });
  });

  test('a bodyweight complex is a real workout, not an error', () => {
    expect(
      validateWorkout(
        draft({
          workoutMode: 'complex',
          movements: [
            movement({ weightOneValue: null }),
            movement({ weightOneValue: null }),
          ],
        }),
      ).errors,
    ).toEqual([]);
  });

  test.each([0, -16])('errors on a weight of %p', (weightOneValue) => {
    expect(codes(draft({ movements: [movement({ weightOneValue })] }))).toContain(
      'non_positive_weight',
    );
  });

  test('passes on a positive weight', () => {
    expect(codes(draft())).not.toContain('non_positive_weight');
  });

  test('a zero second weight is the one-handed marker, not an error', () => {
    expect(
      validateWorkout(
        draft({
          movements: [movement({ weightOneValue: 16, weightTwoValue: 0 })],
        }),
      ),
    ).toEqual({ errors: [], warnings: [] });
  });
});

describe('validateWorkout — implausible_weight (warning)', () => {
  test('warns above 100 kg without blocking', () => {
    const { errors, warnings } = validateWorkout(
      draft({ movements: [movement({ weightOneValue: 150 })] }),
    );
    expect(errors).toEqual([]);
    expect(warnings.map((w) => w.code)).toEqual(['implausible_weight']);
    expect(warnings[0].severity).toBe('warning');
  });

  test('100 kg exactly is fine', () => {
    expect(
      warningCodes(draft({ movements: [movement({ weightOneValue: 100 })] })),
    ).not.toContain('implausible_weight');
  });
});

describe('validateWorkout — interval_with_timed_rungs (warning)', () => {
  test('warns when an interval timer meets timed rungs, without blocking', () => {
    const { errors, warnings } = validateWorkout(
      draft({
        intervalTimer: 60,
        movements: [movement({ timedRungs: true })],
      }),
    );
    expect(errors).toEqual([]);
    expect(warnings.map((w) => w.code)).toEqual(['interval_with_timed_rungs']);
    expect(warnings[0].movementIndex).toBe(0);
  });

  test('timed rungs alone are fine', () => {
    expect(
      warningCodes(
        draft({ intervalTimer: 0, movements: [movement({ timedRungs: true })] }),
      ),
    ).toEqual([]);
  });

  test('an interval timer alone is fine', () => {
    expect(warningCodes(draft({ intervalTimer: 60 }))).toEqual([]);
  });
});

describe('validateWorkout — max rungs', () => {
  test('a 0 rung is a valid ladder step, not an invalid rep count', () => {
    expect(codes(draft({ movements: [movement({ repScheme: [1, 2, 3, 0] })] })))
      .toEqual([]);
  });

  test('a negative rung is still rejected', () => {
    expect(
      codes(draft({ movements: [movement({ repScheme: [5, -1] })] })),
    ).toContain('invalid_reps');
  });

  test('blocks when an interval timer meets a max rung', () => {
    const { errors, warnings } = validateWorkout(
      draft({
        intervalTimer: 60,
        movements: [movement({ repScheme: [5, 0] })],
      }),
    );
    expect(errors.map((e) => e.code)).toEqual(['interval_with_max_reps']);
    expect(errors[0].movementIndex).toBe(0);
    expect(warnings).toEqual([]);
  });

  test('a max rung alone is fine', () => {
    expect(
      codes(draft({ intervalTimer: 0, movements: [movement({ repScheme: [0] })] })),
    ).toEqual([]);
  });
});

describe('validateWorkout — severities never cross', () => {
  test('every warning code stays out of errors, and vice versa', () => {
    const { errors, warnings } = validateWorkout(
      draft({
        workoutGoal: 0,
        intervalTimer: 60,
        movements: [movement({ weightOneValue: 150, timedRungs: true })],
      }),
    );
    expect(errors.map((e) => e.code)).toEqual(['non_positive_goal']);
    expect(warnings.map((w) => w.code).sort()).toEqual([
      'implausible_weight',
      'interval_with_timed_rungs',
    ]);
    expect(errors.every((e) => e.severity === 'error')).toBe(true);
    expect(warnings.every((w) => w.severity === 'warning')).toBe(true);
  });
});
