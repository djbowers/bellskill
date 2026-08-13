import type { ActiveProgram } from '~/api';
import type { WorkoutGoalUnits, WorkoutOptions } from '~/types';

// Inlined rather than spread from `~/contexts`' DEFAULT_WORKOUT_OPTIONS:
// `~/examples` is imported by components, so a runtime import here would put
// contexts inside that cycle. Fixtures stay leaf modules.
const BARE_SESSION_OPTIONS: Omit<WorkoutOptions, 'startedAt'> = {
  workoutMode: 'circuit',
  sharedBell: false,
  intervalTimer: 0,
  movements: [],
  restTimer: 0,
  sharedWeightOneUnit: null,
  sharedWeightOneValue: null,
  sharedWeightTwoUnit: null,
  sharedWeightTwoValue: null,
  title: null,
  preWorkoutNotes: null,
  workoutGoal: 30,
  workoutGoalUnits: 'minutes',
};

interface ExampleActiveProgramOptions {
  id?: string;
  title?: string;
  sessionTitle?: string;
  /** Sessions already satisfied; also sets the next session's sequence index. */
  completed?: number;
  total?: number;
  activeSlot?: number;
  lastWorkedAt?: string | null;
  workoutGoal?: number;
  workoutGoalUnits?: WorkoutGoalUnits;
}

/**
 * A realistic {@link ActiveProgram} for stories and tests — one enrollment with
 * its next unsatisfied session. Defaults model a fresh Dry Fighting Weight
 * enrollment; override any field. Pass `completed === total` for the
 * program-complete state (`nextSession` becomes null).
 */
export const exampleActiveProgram = ({
  id = 'up-1',
  title = 'Dry Fighting Weight',
  sessionTitle = 'Ladders 1-2-3',
  completed = 0,
  total = 14,
  activeSlot = 1,
  lastWorkedAt = null,
  workoutGoal = 30,
  workoutGoalUnits = 'minutes',
}: ExampleActiveProgramOptions = {}): ActiveProgram => {
  const isComplete = completed >= total;
  const weekNumber = Math.floor(completed / 3) + 1;
  const dayNumber = (completed % 3) + 1;

  return {
    enrollment: {
      id,
      userId: 'user-123',
      programId: `${id}-program`,
      status: isComplete ? 'completed' : 'active',
      config: {},
      startedAt: '2026-07-01T00:00:00Z',
      completedAt: isComplete ? '2026-07-22T00:00:00Z' : null,
      activeSlot,
      autoRepeat: false,
      cyclesCompleted: 0,
      queuePosition: null,
      currentStageIndex: 0,
    },
    program: {
      id: `${id}-program`,
      ownerId: 'user-123',
      sourceProgramId: null,
      slug: null,
      title,
      description: null,
      authorName: null,
      numWeeks: Math.ceil(total / 3),
      daysPerWeek: 3,
      isPublic: false,
      archivedAt: null,
      createdAt: '2026-07-01T00:00:00Z',
      defaultAutoRepeat: false,
      releasedAt: null,
      stages: null,
      focusTags: [],
      systemicDemand: null,
    },
    nextSession: isComplete
      ? null
      : {
          session: {
            id: `${id}-ps-${completed}`,
            programId: `${id}-program`,
            sequenceIndex: completed,
            weekNumber,
            dayNumber,
            title: sessionTitle,
            notes: null,
            weightLabel: null,
            workoutOptions: {
              ...BARE_SESSION_OPTIONS,
              workoutGoal,
              workoutGoalUnits,
            },
          },
          workoutOptions: {
            ...BARE_SESSION_OPTIONS,
            workoutGoal,
            workoutGoalUnits,
          },
        },
    progress: { completed, total, week: weekNumber, day: dayNumber },
    isComplete,
    lastWorkedAt,
  };
};
