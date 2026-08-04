import {
  mapProgramRow,
  mapProgramSessionCompletionRow,
  mapProgramSessionRow,
  mapUserProgramRow,
  parseSessionWorkoutOptions,
  serializeSessionWorkoutOptions,
} from './program';

describe('mapProgramRow', () => {
  it('maps a raw programs row to camelCase, including stages', () => {
    const stages = [{ label: 'Base', repeatWeeks: 2 }];
    const row = {
      id: 'prog-1',
      owner_id: 'user-123',
      source_program_id: 'prog-source',
      slug: 'dry-fighting-weight',
      title: 'Dry Fighting Weight',
      description: 'A classic.',
      author_name: 'Pavel',
      num_weeks: 2,
      days_per_week: 3,
      is_public: true,
      created_at: '2026-01-01T00:00:00Z',
      archived_at: null,
      default_auto_repeat: false,
      released_at: '2026-01-01T00:00:00Z',
      stages,
    } as never;

    expect(mapProgramRow(row)).toEqual({
      id: 'prog-1',
      ownerId: 'user-123',
      sourceProgramId: 'prog-source',
      slug: 'dry-fighting-weight',
      title: 'Dry Fighting Weight',
      description: 'A classic.',
      authorName: 'Pavel',
      numWeeks: 2,
      daysPerWeek: 3,
      isPublic: true,
      createdAt: '2026-01-01T00:00:00Z',
      archivedAt: null,
      defaultAutoRepeat: false,
      releasedAt: '2026-01-01T00:00:00Z',
      stages,
    });
  });

  it('passes through a null stages column', () => {
    const row = {
      id: 'prog-1',
      owner_id: 'user-123',
      source_program_id: null,
      slug: null,
      title: 'Simple & Sinister',
      description: null,
      author_name: null,
      num_weeks: null,
      days_per_week: null,
      is_public: false,
      created_at: '2026-01-01T00:00:00Z',
      archived_at: null,
      default_auto_repeat: true,
      released_at: null,
      stages: null,
    } as never;

    expect(mapProgramRow(row).stages).toBeNull();
  });
});

describe('mapProgramSessionRow', () => {
  it('maps a raw program_sessions row to camelCase, reading the stored booleans as a workout mode', () => {
    const workoutOptions = {
      complexSet: false,
      straightSets: true,
      movements: [{ movementName: 'Kettlebell Swing' }],
    };
    const row = {
      id: 'ps-1',
      program_id: 'prog-1',
      sequence_index: 0,
      week_number: 1,
      day_number: 1,
      title: 'Week 1 Day 1',
      workout_options: workoutOptions,
      notes: 'Go easy on the swings.',
      weight_label: 'Deload weeks',
    } as never;

    expect(mapProgramSessionRow(row)).toEqual({
      id: 'ps-1',
      programId: 'prog-1',
      sequenceIndex: 0,
      weekNumber: 1,
      dayNumber: 1,
      title: 'Week 1 Day 1',
      workoutOptions: {
        movements: workoutOptions.movements,
        workoutMode: 'straightSets',
      },
      notes: 'Go easy on the swings.',
      weightLabel: 'Deload weeks',
    });
  });
});

describe('mapProgramSessionCompletionRow', () => {
  it('maps a raw program_session_completions row to camelCase', () => {
    const row = {
      id: 'comp-1',
      user_program_id: 'up-1',
      program_session_id: 'ps-1',
      user_id: 'user-123',
      workout_log_id: 42,
      status: 'done',
      completed_at: '2026-07-01T00:00:00Z',
    } as never;

    expect(mapProgramSessionCompletionRow(row)).toEqual({
      id: 'comp-1',
      userProgramId: 'up-1',
      programSessionId: 'ps-1',
      userId: 'user-123',
      workoutLogId: 42,
      status: 'done',
      completedAt: '2026-07-01T00:00:00Z',
    });
  });

  it('maps a skipped completion with no linked workout log', () => {
    const row = {
      id: 'comp-2',
      user_program_id: 'up-1',
      program_session_id: 'ps-2',
      user_id: 'user-123',
      workout_log_id: null,
      status: 'skipped',
      completed_at: '2026-07-02T00:00:00Z',
    } as never;

    expect(mapProgramSessionCompletionRow(row)).toMatchObject({
      workoutLogId: null,
      status: 'skipped',
    });
  });
});

describe('mapUserProgramRow', () => {
  it('maps a raw user_programs row to camelCase, defaulting a null config to {}', () => {
    const row = {
      id: 'up-1',
      user_id: 'user-123',
      program_id: 'prog-1',
      status: 'active',
      config: null,
      started_at: '2026-07-01T00:00:00Z',
      completed_at: null,
      active_slot: 1,
      auto_repeat: false,
      cycles_completed: 0,
      queue_position: null,
      current_stage_index: 0,
    } as never;

    expect(mapUserProgramRow(row)).toEqual({
      id: 'up-1',
      userId: 'user-123',
      programId: 'prog-1',
      status: 'active',
      config: {},
      startedAt: '2026-07-01T00:00:00Z',
      completedAt: null,
      activeSlot: 1,
      autoRepeat: false,
      cyclesCompleted: 0,
      queuePosition: null,
      currentStageIndex: 0,
    });
  });

  it('passes through a populated config', () => {
    const row = {
      id: 'up-1',
      user_id: 'user-123',
      program_id: 'prog-1',
      status: 'queued',
      config: { someKey: 'someValue' },
      started_at: null,
      completed_at: null,
      active_slot: null,
      auto_repeat: true,
      cycles_completed: 2,
      queue_position: 3,
      current_stage_index: null,
    } as never;

    expect(mapUserProgramRow(row).config).toEqual({ someKey: 'someValue' });
    expect(mapUserProgramRow(row).queuePosition).toBe(3);
  });
});

describe('program session workout_options JSONB', () => {
  const baseOptions = {
    intervalTimer: 0,
    movements: [],
    restTimer: 0,
    sharedWeightOneUnit: null,
    sharedWeightOneValue: null,
    sharedWeightTwoUnit: null,
    sharedWeightTwoValue: null,
    title: null,
    preWorkoutNotes: null,
    workoutGoal: 20,
    workoutGoalUnits: 'minutes' as const,
  };

  it.each([
    [{ complexSet: true, straightSets: false }, 'complex'],
    [{ complexSet: false, straightSets: true }, 'straightSets'],
    [{ complexSet: false, straightSets: false }, 'circuit'],
    // Sessions seeded before the flag existed carry neither key.
    [{}, 'circuit'],
  ] as const)('%o loads as %s', (stored, workoutMode) => {
    expect(
      parseSessionWorkoutOptions({ ...baseOptions, ...stored }).workoutMode,
    ).toBe(workoutMode);
  });

  it.each(['circuit', 'straightSets', 'complex'] as const)(
    '%s is written back as the original boolean pair',
    (workoutMode) => {
      const stored = serializeSessionWorkoutOptions({
        ...baseOptions,
        workoutMode,
      }) as Record<string, unknown>;

      expect(stored.workoutMode).toBeUndefined();
      expect(stored.complexSet).toBe(workoutMode === 'complex');
      expect(stored.straightSets).toBe(workoutMode === 'straightSets');
      expect(parseSessionWorkoutOptions(stored).workoutMode).toBe(workoutMode);
    },
  );
});
