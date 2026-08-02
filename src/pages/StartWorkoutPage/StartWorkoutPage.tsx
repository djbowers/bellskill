import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  AnalyticsEvent,
  RepeatableWorkout,
  trackEvent,
  useActivePrograms,
  useCompleteProgramSession,
  useFeatureFlags,
  useMovements,
  useWorkoutLogs,
} from '~/api';
import { Page, PageLoading } from '~/components';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { CURATED_WORKOUTS_VERSION } from '~/constants';
import {
  DEFAULT_MOVEMENT_OPTIONS,
  DEFAULT_WORKOUT_OPTIONS,
  PendingProgramSession,
  useSession,
  useWorkoutOptions,
} from '~/contexts';
import { useFeatures, useStartWorkout } from '~/hooks';
import type { WorkoutStartSource } from '~/hooks';
import {
  CuratedWorkout,
  MovementOptions,
  ProgramSession,
  Recommendation,
  WeightUnit,
  WorkoutGoalUnits,
  WorkoutOptions,
} from '~/types';
import {
  applySharedWeights,
  getWeightRange,
  getWeightTabValue,
  getWeightUnitLabel,
} from '~/utils';

import {
  AddToWorkoutSection,
  BuildCustomCard,
  BuilderActionBar,
  BuilderHeaderBar,
  HubHeader,
  ModifyCountButtons,
  MovementCard,
  MovementsHeader,
  ProgramSwitcherTabs,
  RecommendSessionSection,
  RecommendedWorkoutsSection,
  Section,
  StartProgramCard,
  StartWorkoutHero,
  WeightModeTabs,
  WeightUnitTabs,
} from './components';
import type { SummaryLoad } from './components';
import { useRecommendedWorkouts } from './hooks';
import { INCREMENT_VOLUME, getGoalRange } from './utils/goalRange';
import {
  RecommendationCatalog,
  buildRecommendationCatalog,
  recommendationToWorkoutOptions,
} from './utils/recommendationToMovements';

// One page comfortably covers the whole ~250-row catalog, so the recommender
// can infer each movement's loading mode without paginating.
const MOVEMENT_CATALOG_PAGE_SIZE: number = 500;

const DEFAULT_INTERVAL_TIMER: number = 30; // seconds
const DEFAULT_REST_TIMER: number = 30; // seconds
const DEFAULT_RUNG_REPS: number = 10;
const DEFAULT_RUNG_SECONDS: number = 30;
const DEFAULT_WEIGHT_UNIT: WeightUnit =
  DEFAULT_MOVEMENT_OPTIONS.weightOneUnit ?? 'kilograms';
const DEFAULT_WEIGHT_VALUE: number =
  DEFAULT_MOVEMENT_OPTIONS.weightOneValue ?? 16;

const INCREMENT_DURATION: number = 1; // minutes
const INCREMENT_INTERVAL_TIMER: number = 5; // seconds
const INCREMENT_REST_TIMER: number = 5; // seconds
const TIMER_BOUNDS = { min: 5, max: 300 }; // seconds
const DEFAULT_VOLUME: number = 1000; // kg
const DEFAULT_MINUTES: number = 10; // minutes
const DEFAULT_ROUNDS: number = 10; // rounds

/**
 * The History-facing title for a program-started workout: the program name plus
 * a week/day tag and the session's short label, composed at start time (program
 * sessions never persist a title — `workoutOptions.title` is null for them).
 */
const composeProgramSessionTitle = (
  programTitle: string,
  session: ProgramSession,
): string =>
  `${programTitle} · W${session.weekNumber}D${session.dayNumber} ${session.title}`;

/**
 * Save-session mode (Slice 2): the builder authors a program session instead of
 * starting a workout. When provided, the footer swaps from "Start workout" to
 * "Save session" and everything above it — the whole builder — is reused as-is.
 * This is `loadIntoBuilder` in reverse.
 */
export interface ProgramSaveMode {
  /** Persist the builder's current options as a program session. */
  onSave: (options: Omit<WorkoutOptions, 'startedAt'>, title: string) => void;
  /** Whether a save is in flight (disables the footer). */
  saving: boolean;
  /** Program-specific UI (saved-session list + duplicate helpers) rendered above the builder. */
  beforeBuilder?: ReactNode;
  /**
   * When editing an existing session, its stored options + title. The builder is
   * seeded with these once on mount (instead of starting from defaults) and the
   * footer reads "Update session".
   */
  initialSession?: {
    workoutOptions: Omit<WorkoutOptions, 'startedAt'>;
    title: string;
  };
}

interface StartWorkoutPageProps {
  programSaveMode?: ProgramSaveMode;
}

export const StartWorkoutPage = ({
  programSaveMode,
}: StartWorkoutPageProps = {}) => {
  const features = useFeatures();
  // Runtime flags (PROD-175) settle at app init (`FeatureFlagsGate`) before
  // this page mounts, so there's no pending state to gate on; they default to
  // all-OFF (pure builder) on error.
  const { features: experimentFeatures } = useFeatureFlags();
  const navigate = useNavigate();
  const startWorkout = useStartWorkout();
  const [workoutOptions] = useWorkoutOptions();
  const { curated, recentRepeats } = useRecommendedWorkouts();

  // Program tracking, behind the `programs` flag (query gated so non-program
  // builds fire zero requests). `programGatePending` holds the page in browse
  // mode until the query settles, avoiding a builder→card flash on open. The
  // `!isError` escape matters: `data` stays undefined after a failed fetch (no
  // `placeholderData`), so without it an error would strand the page on the
  // blocking skeleton instead of falling through to the builder.
  const activeProgramsQuery = useActivePrograms({ enabled: features.programs });
  const activePrograms = activeProgramsQuery.data ?? [];
  const hasActiveProgram = activePrograms.length > 0;
  const programGatePending =
    features.programs &&
    !programSaveMode &&
    activeProgramsQuery.data === undefined &&
    !activeProgramsQuery.isError;
  const completeProgramSession = useCompleteProgramSession();

  // Which of the parallel programs the card below offers. Null until the user
  // picks one in the switcher, then that wins; the default is index 0, which
  // `useActivePrograms` has already sorted to least-recently-worked. A stale id
  // (its program was just completed away) falls back to the default.
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<
    string | null
  >(null);
  const primaryProgram =
    activePrograms.find((p) => p.enrollment.id === selectedEnrollmentId) ??
    activePrograms[0] ??
    null;

  // Population signal for the launchpad (PROD-171): a user with zero workout
  // logs is "new". `isFirstWorkout` is tri-state — null while the logs query
  // loads, so we never treat a genuine first-timer as returning before it
  // resolves. The funnel effect below reuses these, so they're derived once.
  const session = useSession();
  const userId = session?.user?.id;
  const { data: workoutLogs } = useWorkoutLogs();
  const isFirstWorkout =
    workoutLogs === undefined ? null : workoutLogs.length === 0;
  const population: 'new' | 'returning' | null =
    isFirstWorkout === null ? null : isFirstWorkout ? 'new' : 'returning';

  // Most recent training date for the hub header's "last trained" line. Null
  // until the logs resolve or for a user who hasn't trained yet.
  const lastWorkoutAt = useMemo<Date | null>(() => {
    if (!workoutLogs || workoutLogs.length === 0) return null;
    return workoutLogs.reduce(
      (latest, log) => (log.startedAt > latest ? log.startedAt : latest),
      workoutLogs[0].startedAt,
    );
  }, [workoutLogs]);

  // Master gate (PROD-171): the launchpad shell replaces the pure custom builder
  // when its flag resolves to treatment; control drops straight into the builder
  // (the true baseline). Content inside the shell is routed by population, not by
  // standalone content flags. An active program still forces the shell — it's a
  // separate release feature, orthogonal to the experiment. Save-session mode
  // never browses.
  // The hub is the default home surface for everyone now — the launchpad shell
  // graduated from experiment to baseline, so browse is no longer gated behind
  // its flag or an active program. `shellOn` is retained only so the exposure
  // event still records which flag arm a user was assigned to. Save-session mode
  // never browses.
  const shellOn = experimentFeatures.launchpadShell;
  const showBrowse = !programSaveMode;

  // Hub suggestions stay behind their own flags and are routed by population:
  // curated first workout for new users, repeat-previous for returning, and the
  // Phase-2 AI recommender for returning users. The hub shell itself no longer
  // depends on any of them.
  const showCurated =
    experimentFeatures.curatedFirstWorkout && population === 'new';
  const showRepeat =
    experimentFeatures.repeatPrevious && population === 'returning';
  const showRecommender =
    experimentFeatures.recommender && population === 'returning';

  // The recommender prescribes a single weight per movement; the catalog's
  // primary-item count + arm split tell us whether that load means two-hand,
  // single, or two-bell so an accepted recommendation opens in the right mode
  // (PROD-238). Only fetched when the recommender surface is actually shown.
  const movementCatalogQuery = useMovements(
    { limit: MOVEMENT_CATALOG_PAGE_SIZE },
    { enabled: showRecommender },
  );
  const recommendationCatalog = useMemo<RecommendationCatalog>(
    () =>
      buildRecommendationCatalog(
        movementCatalogQuery.data?.movements ?? [],
        movementCatalogQuery.data?.hasNextPage,
      ),
    [movementCatalogQuery.data],
  );

  // Browse mode shows recommendations plus a Build-custom button; the builder
  // opens directly when there's nothing to browse or when history's "Repeat"
  // navigates here with `editWorkout`.
  const location = useLocation();
  const editWorkout = Boolean(
    (location.state as { editWorkout?: boolean } | null)?.editWorkout,
  );
  // Committing to a mode at mount would use the still-forced `showBrowse` and
  // need a post-paint correction (a visible flash), so render neither surface
  // until the gate settles and derive the mode fresh each render.
  // `builderOverride` is null until the user explicitly switches modes, then
  // wins over the derived default. Save mode has no browse surface to race
  // against, so it's excluded from the gate.
  const [builderOverride, setBuilderOverride] = useState<boolean | null>(null);
  const showBuilder = builderOverride ?? (editWorkout || !showBrowse);
  const gatesPending = !programSaveMode && programGatePending && !editWorkout;
  // Where the (eventual) start originated, carried through any edits the user
  // makes in the builder so `workout_started` stays attributed to the surface.
  const [startSource, setStartSource] = useState<WorkoutStartSource>('builder');
  const [startSourceProps, setStartSourceProps] = useState<
    Record<string, string | number | boolean | null>
  >({});
  // Program session the builder was loaded from (Slice 3), carried into the log
  // step so completion advances the program. Cleared whenever a non-program
  // surface loads the builder, so a stale session never attaches.
  const [pendingProgramSession, setPendingProgramSession] =
    useState<PendingProgramSession | null>(null);

  // Save-session mode only: the title for the program session being authored.
  const [sessionTitle, setSessionTitle] = useState<string>('');

  const firstSessionTracked = useRef(false);

  useEffect(
    function trackFirstSession() {
      if (firstSessionTracked.current) return;
      if (!userId || !workoutLogs) return;
      if (workoutLogs.length > 0) return;

      firstSessionTracked.current = true;
      void trackEvent({
        event: AnalyticsEvent.FirstSessionStarted,
        userId,
      });
    },
    // Depend on the stable user id, not the session object (which is replaced on
    // every token refresh), so this effect doesn't needlessly re-run.
    [userId, workoutLogs],
  );

  // Launchpad exposure (PROD-171): once the shell decision is settled, log which
  // variant / population / content the user landed on, keyed by user_id so it
  // joins to the PROD-170 funnel events. Fires once per mount; the sticky
  // assignment itself lives server-side in feature_flag_assignments.
  const launchpadExposureTracked = useRef(false);

  useEffect(
    function trackLaunchpadExposure() {
      if (launchpadExposureTracked.current) return;
      if (programSaveMode || editWorkout) return;
      if (!userId || population === null || programGatePending) return;

      launchpadExposureTracked.current = true;

      const content: string[] = [];
      if (showBrowse) {
        if (hasActiveProgram) content.push('program');
        if (showCurated) content.push('curated_first');
        if (showRepeat) content.push('repeat_previous');
        if (showRecommender) content.push('recommender');
        content.push('build_custom');
      } else {
        content.push('builder');
      }

      void trackEvent({
        event: AnalyticsEvent.LaunchpadExposed,
        userId,
        properties: {
          shell_variant: shellOn ? 'on' : 'off',
          population,
          content,
          active_program_count: activePrograms.length,
        },
      });
    },
    [
      userId,
      population,
      programGatePending,
      programSaveMode,
      editWorkout,
      showBrowse,
      hasActiveProgram,
      activePrograms.length,
      showCurated,
      showRepeat,
      showRecommender,
      shellOn,
    ],
  );

  const [workoutGoal, setWorkoutGoal] = useState<number>(
    workoutOptions.workoutGoal,
  );
  const [workoutGoalUnits, setWorkoutGoalUnits] = useState<WorkoutGoalUnits>(
    workoutOptions.workoutGoalUnits,
  );
  const [movements, setMovements] = useState<MovementOptions[]>(
    workoutOptions.movements,
  );
  // Movements are expanded by default; collapsing one folds it to a scannable
  // summary. Tracked by index, so removing a movement reindexes the set.
  const [collapsedMovements, setCollapsedMovements] = useState<Set<number>>(
    () => new Set(),
  );
  const [title, setTitle] = useState<string | null>(workoutOptions.title);
  const [preWorkoutNotes, setPreWorkoutNotes] = useState<string | null>(
    workoutOptions.preWorkoutNotes,
  );
  const [intervalTimer, setIntervalTimer] = useState<number>(
    workoutOptions.intervalTimer,
  );
  const [restTimer, setRestTimer] = useState<number>(workoutOptions.restTimer);
  const [complexSet, setComplexSet] = useState<boolean>(
    workoutOptions.complexSet,
  );
  const [straightSets, setStraightSets] = useState<boolean>(
    workoutOptions.straightSets ?? false,
  );
  const [sharedWeightOneValue, setSharedWeightOneValue] = useState<
    number | null
  >(workoutOptions.sharedWeightOneValue);
  const [sharedWeightOneUnit, setSharedWeightOneUnit] =
    useState<WeightUnit | null>(workoutOptions.sharedWeightOneUnit);
  const [sharedWeightTwoValue, setSharedWeightTwoValue] = useState<
    number | null
  >(workoutOptions.sharedWeightTwoValue);
  const [sharedWeightTwoUnit, setSharedWeightTwoUnit] =
    useState<WeightUnit | null>(workoutOptions.sharedWeightTwoUnit);

  const notesRef = useRef<HTMLTextAreaElement>(null);

  // Fan a set of workout options out to the builder's local state so the user
  // can review/edit before starting. Defined ahead of the gate so the nav-start
  // effect below can reuse it without a temporal-dead-zone hazard.
  const loadIntoBuilder = (options: Omit<WorkoutOptions, 'startedAt'>) => {
    setMovements(options.movements);
    setWorkoutGoal(options.workoutGoal);
    setWorkoutGoalUnits(options.workoutGoalUnits);
    setTitle(options.title);
    setPreWorkoutNotes(options.preWorkoutNotes);
    setIntervalTimer(options.intervalTimer);
    setRestTimer(options.restTimer);
    setComplexSet(options.complexSet);
    setStraightSets(options.straightSets ?? false);
    setSharedWeightOneValue(options.sharedWeightOneValue);
    setSharedWeightOneUnit(options.sharedWeightOneUnit);
    setSharedWeightTwoValue(options.sharedWeightTwoValue);
    setSharedWeightTwoUnit(options.sharedWeightTwoUnit);
  };

  // Load a chosen program session into the builder for review/edits, tagged so
  // the eventual start attributes to `program` and the log step advances that
  // enrollment on completion. Shared by the home "next" card and the progress
  // page's per-session picker (which routes through nav state below).
  const applyProgramStart = (
    session: ProgramSession,
    userProgramId: string,
    programTitle: string,
  ) => {
    loadIntoBuilder(session.workoutOptions);
    setTitle(composeProgramSessionTitle(programTitle, session));
    setStartSource('program');
    setStartSourceProps({
      user_program_id: userProgramId,
      program_session_id: session.id,
    });
    setPendingProgramSession({
      userProgramId,
      programSessionId: session.id,
    });
    setBuilderOverride(true);
  };

  // The progress page starts an arbitrary session by navigating home with the
  // chosen session in nav state; consume it once, then clear it so a refresh or
  // back-nav doesn't restart the same session.
  useEffect(
    function startProgramSessionFromNav() {
      const navState = location.state as {
        startProgramSession?: {
          session: ProgramSession;
          userProgramId: string;
          programTitle: string;
        };
      } | null;
      const chosen = navState?.startProgramSession;
      if (!chosen) return;
      navigate(location.pathname, { replace: true, state: null });
      applyProgramStart(chosen.session, chosen.userProgramId, chosen.programTitle);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot per navigation; the handlers close over stable setters only.
    [location.key],
  );

  const handleIncrementGoalValue = () => {
    if (workoutGoalUnits === 'kilograms') {
      setWorkoutGoal((prev) => prev + INCREMENT_VOLUME);
    } else {
      setWorkoutGoal((prev) => prev + INCREMENT_DURATION);
    }
  };

  const handleDecrementGoalValue = () => {
    if (workoutGoalUnits === 'kilograms') {
      setWorkoutGoal((prev) => Math.max(1, prev - INCREMENT_VOLUME));
    } else {
      setWorkoutGoal((prev) => (prev === 0 ? prev : prev - INCREMENT_DURATION));
    }
  };

  const handleChangeWorkoutGoalUnits = (value: string) => {
    const newUnits = value as WorkoutGoalUnits;
    setWorkoutGoalUnits(newUnits);

    if (newUnits === 'kilograms') {
      setWorkoutGoal(workoutOptions.previousVolume ?? DEFAULT_VOLUME);
    } else if (newUnits === 'minutes') {
      setWorkoutGoal(workoutOptions.previousMinutes ?? DEFAULT_MINUTES);
    } else if (newUnits === 'rounds') {
      setWorkoutGoal(workoutOptions.previousRounds ?? DEFAULT_ROUNDS);
    }
  };

  const handleDecrementInterval = () =>
    setIntervalTimer((prev) =>
      prev > 0 ? prev - INCREMENT_INTERVAL_TIMER : 0,
    );

  const handleIncrementInterval = () =>
    setIntervalTimer((prev) =>
      prev > 0 ? prev + INCREMENT_INTERVAL_TIMER : DEFAULT_INTERVAL_TIMER,
    );

  const handleDecrementRest = () =>
    setRestTimer((prev) => (prev > 0 ? prev - INCREMENT_REST_TIMER : 0));

  const handleIncrementRest = () =>
    setRestTimer((prev) =>
      prev > 0 ? prev + INCREMENT_REST_TIMER : DEFAULT_REST_TIMER,
    );

  const handleBlurNotes = () => {
    setPreWorkoutNotes(notesRef.current?.value ?? '');
  };

  const handleToggleNotes = () => {
    if (preWorkoutNotes !== null) {
      setPreWorkoutNotes(null);
    } else {
      setPreWorkoutNotes('');
    }
  };

  const handleToggleInterval = () => {
    if (intervalTimer > 0) {
      setIntervalTimer(0);
    } else {
      handleIncrementInterval();
    }
  };

  const handleToggleRest = () => {
    if (restTimer > 0) {
      setRestTimer(0);
    } else {
      handleIncrementRest();
    }
  };

  // Complex holds one bell through every movement; straight sets finishes one
  // movement before the next. They describe opposite arrangements, so turning
  // either on clears the other.
  const handleToggleComplex = () => {
    setComplexSet((prev) => !prev);
    setStraightSets(false);
  };

  const handleToggleStraightSets = () => {
    setStraightSets((prev) => !prev);
    setComplexSet(false);
  };

  const handleChangeMovementName = (index: number, value: string) =>
    setMovements((prev) =>
      prev.map((movement, i) =>
        i === index ? { ...movement, movementName: value } : movement,
      ),
    );

  const handleClickRemoveMovement = (index: number) => {
    setMovements((prev) => prev.filter((_, i) => i !== index));
    setCollapsedMovements((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      });
      return next;
    });
  };

  const handleClickAddMovement = () =>
    setMovements((prev) => [...prev, DEFAULT_MOVEMENT_OPTIONS]);

  const handleToggleMovementExpanded = (index: number) =>
    setCollapsedMovements((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const handleChangeSharedWeightTab = (value: string) => {
    setSharedWeightOneValue(
      value === 'none' ? null : sharedWeightOneValue || DEFAULT_WEIGHT_VALUE,
    );
    setSharedWeightOneUnit(value === 'none' ? null : DEFAULT_WEIGHT_UNIT);
    setSharedWeightTwoValue(
      value === 'double'
        ? sharedWeightTwoValue || DEFAULT_WEIGHT_VALUE
        : value === '1h'
          ? 0
          : null,
    );
    setSharedWeightTwoUnit(value === 'double' ? DEFAULT_WEIGHT_UNIT : null);
  };

  const handleChangeSharedWeightOneValue = (value: number) =>
    setSharedWeightOneValue(Math.max(1, value));

  const handleChangeSharedWeightOneUnit = (value: WeightUnit) =>
    setSharedWeightOneUnit(value);

  const handleChangeSharedWeightTwoValue = (value: number) =>
    setSharedWeightTwoValue(Math.max(1, value));

  const handleChangeSharedWeightTwoUnit = (value: WeightUnit) =>
    setSharedWeightTwoUnit(value);

  const handleChangeWeightTab = (index: number, value: string) => {
    setMovements((prev) =>
      prev.map((movement, i) =>
        i === index
          ? {
              ...movement,
              weightOneValue:
                value === 'none'
                  ? null
                  : movement.weightOneValue || DEFAULT_WEIGHT_VALUE,
              weightOneUnit: value === 'none' ? null : DEFAULT_WEIGHT_UNIT,
              weightTwoValue:
                value === 'double'
                  ? movement.weightTwoValue || DEFAULT_WEIGHT_VALUE
                  : value === '1h'
                    ? 0
                    : null,
              weightTwoUnit: value === 'double' ? DEFAULT_WEIGHT_UNIT : null,
            }
          : movement,
      ),
    );
  };

  const handleChangeWeightOneValue = (index: number, value: number) =>
    setMovements((prev) =>
      prev.map((movement, i) =>
        i === index
          ? {
              ...movement,
              weightOneValue: Math.max(1, value),
            }
          : movement,
      ),
    );

  const handleChangeWeightOneUnit = (index: number, value: WeightUnit) =>
    setMovements((prev) =>
      prev.map((movement, i) =>
        i === index ? { ...movement, weightOneUnit: value } : movement,
      ),
    );

  const handleChangeWeightTwoValue = (index: number, value: number) =>
    setMovements((prev) =>
      prev.map((movement, i) =>
        i === index
          ? {
              ...movement,
              weightTwoValue: Math.max(1, value),
            }
          : movement,
      ),
    );

  const handleChangeWeightTwoUnit = (index: number, value: WeightUnit) =>
    setMovements((prev) =>
      prev.map((movement, i) =>
        i === index ? { ...movement, weightTwoUnit: value } : movement,
      ),
    );

  // Reps and seconds are not interchangeable magnitudes — a [5,4,3,2,1] ladder
  // reads as 5-second carries, and a 30-second plank reads as 30 reps. Flipping
  // the unit reseeds every rung to a usable default for the new one.
  const handleToggleTimedRungs = (index: number, timed: boolean) =>
    setMovements((prev) =>
      prev.map((movement, i) =>
        i === index
          ? {
              ...movement,
              timedRungs: timed,
              repScheme: movement.repScheme.map(() =>
                timed ? DEFAULT_RUNG_SECONDS : DEFAULT_RUNG_REPS,
              ),
            }
          : movement,
      ),
    );

  const handleChangeRepScheme = (
    movementIndex: number,
    rungIndex: number,
    value: number,
  ) =>
    setMovements((prev) =>
      prev.map((movement, i) =>
        i === movementIndex
          ? {
              ...movement,
              repScheme: movement.repScheme.map((rung, j) =>
                j === rungIndex ? Math.max(1, value) : rung,
              ),
            }
          : movement,
      ),
    );

  const handleRemoveRung = (movementIndex: number, rungIndex: number) =>
    setMovements((prev) =>
      prev.map((movement, i) =>
        i === movementIndex
          ? {
              ...movement,
              repScheme: movement.repScheme.filter((_, j) => j !== rungIndex),
            }
          : movement,
      ),
    );

  const handleAddRung = (index: number) =>
    setMovements((prev) =>
      prev.map((movement, i) =>
        i === index
          ? {
              ...movement,
              repScheme: [
                ...movement.repScheme,
                movement.repScheme.length > 0
                  ? movement.repScheme[movement.repScheme.length - 1]
                  : 1,
              ],
            }
          : movement,
      ),
    );

  // Edit mode (Slice 3): seed the builder from the session being edited exactly
  // once, so the user's own subsequent edits aren't clobbered on re-render.
  const editSeeded = useRef(false);
  useEffect(
    function seedBuilderForEdit() {
      const initial = programSaveMode?.initialSession;
      if (!initial || editSeeded.current) return;
      editSeeded.current = true;
      loadIntoBuilder(initial.workoutOptions);
      setSessionTitle(initial.title);
    },
    [programSaveMode?.initialSession],
  );

  const handleSelectCurated = (workout: CuratedWorkout) => {
    loadIntoBuilder(workout.workoutOptions);
    setStartSource('curated');
    setStartSourceProps({
      template_id: workout.id,
      curated_version: CURATED_WORKOUTS_VERSION,
    });
    setPendingProgramSession(null);
    setBuilderOverride(true);
  };

  const handleSelectRepeat = (repeat: RepeatableWorkout) => {
    loadIntoBuilder(repeat.workoutOptions);
    setStartSource('history_repeat');
    setStartSourceProps({ workout_log_id: repeat.workoutLogId });
    setPendingProgramSession(null);
    setBuilderOverride(true);
  };

  // Accept an AI recommendation: load it into the builder for review/edits, then
  // start via the existing Start button (attributed to the recommender source).
  const handleAcceptRecommendation = (
    recommendation: Recommendation,
    recommendationId: string,
  ) => {
    loadIntoBuilder(
      recommendationToWorkoutOptions(recommendation, recommendationCatalog),
    );
    setStartSource('recommender');
    setStartSourceProps({ recommendation_id: recommendationId });
    setPendingProgramSession(null);
    setBuilderOverride(true);
  };

  const handleClickBuildCustom = () => {
    loadIntoBuilder(DEFAULT_WORKOUT_OPTIONS);
    setStartSource('builder');
    setStartSourceProps({});
    setPendingProgramSession(null);
    setBuilderOverride(true);
  };

  // Start the selected program's next session from the home card.
  const handleStartProgram = () => {
    if (!primaryProgram?.nextSession) return;
    applyProgramStart(
      primaryProgram.nextSession.session,
      primaryProgram.enrollment.id,
      primaryProgram.program.title,
    );
  };

  // Skip the next session: writes a `skipped` completion (no workout_log), which
  // advances the cursor to the following session without leaving the home card.
  const handleSkipProgram = () => {
    if (!primaryProgram?.nextSession || completeProgramSession.isPending)
      return;
    completeProgramSession.mutate({
      userProgramId: primaryProgram.enrollment.id,
      programSessionId: primaryProgram.nextSession.session.id,
      status: 'skipped',
    });
  };

  const handleBackToRecommendations = () => {
    setStartSource('builder');
    setStartSourceProps({});
    setPendingProgramSession(null);
    setBuilderOverride(false);
  };

  const handleClickStart = () => {
    startWorkout(
      applySharedWeights({
        complexSet,
        intervalTimer,
        movements,
        restTimer,
        sharedWeightOneUnit,
        sharedWeightOneValue,
        sharedWeightTwoUnit,
        sharedWeightTwoValue,
        straightSets,
        title: title?.trim() || null,
        preWorkoutNotes: preWorkoutNotes?.trim() || null,
        workoutGoal,
        workoutGoalUnits,
      }),
      startSource,
      {
        ...startSourceProps,
        is_first_workout: isFirstWorkout,
        movement_count: movements.length,
        workout_goal_units: workoutGoalUnits,
      },
      pendingProgramSession,
    );
  };

  // Save-session mode: capture the builder's current options as a program
  // session instead of starting a workout.
  const handleSaveSession = () => {
    programSaveMode?.onSave(
      applySharedWeights({
        complexSet,
        intervalTimer,
        movements,
        restTimer,
        sharedWeightOneUnit,
        sharedWeightOneValue,
        sharedWeightTwoUnit,
        sharedWeightTwoValue,
        straightSets,
        title: null,
        preWorkoutNotes: preWorkoutNotes?.trim() || null,
        workoutGoal,
        workoutGoalUnits,
      }),
      sessionTitle.trim(),
    );
  };

  const sharedWeightTabValue = getWeightTabValue({
    weightOneValue: sharedWeightOneValue,
    weightTwoValue: sharedWeightTwoValue,
  });

  // Only the rotating order needs matching ladders — it walks every movement with
  // one shared rung pointer. Straight sets gives each movement its own ladder.
  const isDifferentRepSchemes =
    !straightSets &&
    movements.length > 1 &&
    movements.some(
      (movement) => movement.repScheme.length !== movements[0].repScheme.length,
    );

  const startDisabled =
    movements.length === 0 ||
    movements.some((movement) => movement.movementName.length === 0) ||
    isDifferentRepSchemes ||
    workoutGoal <= 0;

  // Every bell in play, for the footer's at-a-glance load range. Complex sets
  // load one shared bell (or two), so they read from the shared weights instead.
  const summaryLoads: SummaryLoad[] = (
    complexSet
      ? [
          { value: sharedWeightOneValue, unit: sharedWeightOneUnit },
          { value: sharedWeightTwoValue, unit: sharedWeightTwoUnit },
        ]
      : movements.flatMap((movement) => [
          { value: movement.weightOneValue, unit: movement.weightOneUnit },
          { value: movement.weightTwoValue, unit: movement.weightTwoUnit },
        ])
  )
    .filter((load): load is SummaryLoad => (load.value ?? 0) > 0)
    .map((load) => ({ value: load.value as number, unit: load.unit }));

  // Held below every hook so the pending→resolved gate transition can't change
  // the hook count between renders (Rules of Hooks / React #310). The mode above
  // is still derived from a forced `showBrowse` until the gate settles, so
  // withhold the real UI rather than commit to it.
  if (gatesPending) return <PageLoading />;

  return (
    <Page>
      {!showBuilder && showBrowse && (
        <>
          <HubHeader lastWorkoutAt={lastWorkoutAt} />

          {primaryProgram ? (
            <>
              <ProgramSwitcherTabs
                programs={activePrograms}
                selectedEnrollmentId={primaryProgram.enrollment.id}
                onSelect={setSelectedEnrollmentId}
              />
              <StartWorkoutHero
                variant="program"
                programTitle={primaryProgram.program.title}
                nextSession={primaryProgram.nextSession}
                progress={primaryProgram.progress}
                isComplete={primaryProgram.isComplete}
                onStart={handleStartProgram}
                onSkip={handleSkipProgram}
                skipping={completeProgramSession.isPending}
                onViewProgress={() =>
                  navigate(`/programs/${primaryProgram.program.id}`)
                }
              />
            </>
          ) : (
            <StartWorkoutHero
              variant="quickStart"
              onBuildCustom={handleClickBuildCustom}
              onRepeatLast={
                recentRepeats.length > 0
                  ? () => handleSelectRepeat(recentRepeats[0])
                  : undefined
              }
            />
          )}

          <RecommendedWorkoutsSection
            curated={showCurated ? curated : []}
            recentRepeats={showRepeat ? recentRepeats : []}
            isFirstWorkout={isFirstWorkout}
            onSelectCurated={handleSelectCurated}
            onSelectRepeat={handleSelectRepeat}
          />

          {showRecommender && (
            <RecommendSessionSection
              userId={userId}
              onAccept={handleAcceptRecommendation}
            />
          )}

          {primaryProgram ? (
            <BuildCustomCard onClick={handleClickBuildCustom} />
          ) : (
            features.programs && <StartProgramCard />
          )}
        </>
      )}

      {showBuilder && (
        <>
          {programSaveMode ? (
            <>
              {programSaveMode.beforeBuilder}
              <Card>
                <Section title="Session title">
                  <Input
                    className="w-full"
                    value={sessionTitle}
                    onChange={(e) => setSessionTitle(e.target.value)}
                    placeholder="e.g. Ladders 1-2-3"
                  />
                </Section>
              </Card>
            </>
          ) : (
            <BuilderHeaderBar
              showBack={showBrowse}
              onBack={handleBackToRecommendations}
              title={title ?? ''}
              onChangeTitle={setTitle}
            />
          )}

          <Card>
            <Section
              title="Goal"
              actions={
                <Tabs
                  value={workoutGoalUnits}
                  onValueChange={handleChangeWorkoutGoalUnits}
                >
                  <TabsList>
                    <TabsTrigger size="sm" value="minutes">
                      Time
                    </TabsTrigger>
                    <TabsTrigger size="sm" value="rounds">
                      Rounds
                    </TabsTrigger>
                    <TabsTrigger size="sm" value="kilograms">
                      Volume
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              }
            >
              <ModifyCountButtons
                {...getGoalRange(workoutGoalUnits)}
                onClickMinus={handleDecrementGoalValue}
                onClickPlus={handleIncrementGoalValue}
                onChange={setWorkoutGoal}
                unit={workoutGoalUnits}
                value={workoutGoal}
              />
            </Section>
          </Card>

          <MovementsHeader count={movements.length} />

          {movements.map((movement, index) => (
            <MovementCard
              key={index}
              index={index}
              movement={movement}
              complexSet={complexSet}
              sharedWeightTabValue={sharedWeightTabValue}
              sharedWeights={{
                sharedWeightOneUnit,
                sharedWeightOneValue,
                sharedWeightTwoUnit,
                sharedWeightTwoValue,
              }}
              expanded={!collapsedMovements.has(index)}
              intervalActive={intervalTimer > 0}
              onToggleExpanded={() => handleToggleMovementExpanded(index)}
              onRemove={() => handleClickRemoveMovement(index)}
              onChangeName={(name) => handleChangeMovementName(index, name)}
              onChangeWeightTab={(mode) =>
                complexSet
                  ? handleChangeSharedWeightTab(mode)
                  : handleChangeWeightTab(index, mode)
              }
              onChangeWeightOneValue={(value) =>
                handleChangeWeightOneValue(index, value)
              }
              onChangeWeightOneUnit={(value) =>
                handleChangeWeightOneUnit(index, value)
              }
              onChangeWeightTwoValue={(value) =>
                handleChangeWeightTwoValue(index, value)
              }
              onChangeWeightTwoUnit={(value) =>
                handleChangeWeightTwoUnit(index, value)
              }
              onChangeRung={(rungIndex, value) =>
                handleChangeRepScheme(index, rungIndex, value)
              }
              onRemoveRung={(rungIndex) => handleRemoveRung(index, rungIndex)}
              onAddRung={() => handleAddRung(index)}
              onToggleTimed={(timed) => handleToggleTimedRungs(index, timed)}
            />
          ))}

          <Button variant="secondary" onClick={handleClickAddMovement}>
            + Movement
          </Button>

          {isDifferentRepSchemes && (
            <div className="text-sm text-destructive">
              Rep schemes must contain the same number of rungs for each
              movement.
            </div>
          )}

          <AddToWorkoutSection
            complexSet={complexSet}
            hasNotes={preWorkoutNotes !== null}
            hasInterval={intervalTimer > 0}
            hasRest={restTimer > 0}
            hasTimedMovements={movements.some((m) => m.timedRungs)}
            showComplex={features.complexMode}
            straightSets={straightSets}
            onToggleComplex={handleToggleComplex}
            onToggleInterval={handleToggleInterval}
            onToggleNotes={handleToggleNotes}
            onToggleRest={handleToggleRest}
            onToggleStraightSets={handleToggleStraightSets}
          />

          {preWorkoutNotes !== null && (
            <Card>
              <Section title="Pre-workout notes">
                <Textarea
                  autoFocus
                  className="w-full"
                  defaultValue={preWorkoutNotes}
                  onBlur={handleBlurNotes}
                  ref={notesRef}
                  rows={3}
                  placeholder="Goal, cues, things to keep in mind"
                />
              </Section>
            </Card>
          )}

          {intervalTimer > 0 && (
            <Card>
              <Section title="Interval Timer">
                <ModifyCountButtons
                  {...TIMER_BOUNDS}
                  step={INCREMENT_INTERVAL_TIMER}
                  onClickMinus={handleDecrementInterval}
                  onClickPlus={handleIncrementInterval}
                  unit="sec"
                  value={intervalTimer}
                  onChange={setIntervalTimer}
                />
              </Section>
            </Card>
          )}

          {restTimer > 0 && (
            <Card>
              <Section title="Rest Timer">
                <ModifyCountButtons
                  {...TIMER_BOUNDS}
                  step={INCREMENT_REST_TIMER}
                  onClickMinus={handleDecrementRest}
                  onClickPlus={handleIncrementRest}
                  unit="sec"
                  value={restTimer}
                  onChange={setRestTimer}
                />
              </Section>
            </Card>
          )}

          {features.complexMode && complexSet && (
            <Card>
              <Section title="Shared Weight">
                <p className="text-xs text-muted-foreground">
                  Complete all movements before setting the weight down.
                </p>
                <WeightModeTabs
                  value={sharedWeightTabValue}
                  onValueChange={handleChangeSharedWeightTab}
                />
                {sharedWeightOneValue !== null && (
                  <ModifyCountButtons
                    {...getWeightRange(sharedWeightOneUnit)}
                    bellUnit={sharedWeightOneUnit}
                    onClickMinus={() =>
                      handleChangeSharedWeightOneValue(sharedWeightOneValue - 1)
                    }
                    onClickPlus={() =>
                      handleChangeSharedWeightOneValue(sharedWeightOneValue + 1)
                    }
                    unit={getWeightUnitLabel(sharedWeightOneUnit)}
                    unitTabs={
                      <WeightUnitTabs
                        value={sharedWeightOneUnit}
                        onChange={handleChangeSharedWeightOneUnit}
                      />
                    }
                    value={sharedWeightOneValue}
                    onChange={(value) =>
                      handleChangeSharedWeightOneValue(value!)
                    }
                  />
                )}
                {sharedWeightTwoValue !== null && sharedWeightTwoValue > 0 && (
                  <ModifyCountButtons
                    {...getWeightRange(sharedWeightTwoUnit)}
                    bellUnit={sharedWeightTwoUnit}
                    onClickMinus={() =>
                      handleChangeSharedWeightTwoValue(sharedWeightTwoValue - 1)
                    }
                    onClickPlus={() =>
                      handleChangeSharedWeightTwoValue(sharedWeightTwoValue + 1)
                    }
                    unit={getWeightUnitLabel(sharedWeightTwoUnit)}
                    unitTabs={
                      <WeightUnitTabs
                        value={sharedWeightTwoUnit}
                        onChange={handleChangeSharedWeightTwoUnit}
                      />
                    }
                    value={sharedWeightTwoValue}
                    onChange={(value) =>
                      handleChangeSharedWeightTwoValue(value)
                    }
                  />
                )}
              </Section>
            </Card>
          )}

          <BuilderActionBar
            workoutGoal={workoutGoal}
            workoutGoalUnits={workoutGoalUnits}
            movementCount={movements.length}
            loads={summaryLoads}
          >
            {programSaveMode ? (
              <Button
                className="w-full"
                size="lg"
                onClick={handleSaveSession}
                disabled={
                  startDisabled ||
                  sessionTitle.trim().length === 0 ||
                  programSaveMode.saving
                }
              >
                {programSaveMode.saving
                  ? programSaveMode.initialSession
                    ? 'Updating…'
                    : 'Saving…'
                  : programSaveMode.initialSession
                    ? 'Update session'
                    : 'Save session'}
              </Button>
            ) : (
              <Button
                className="w-full"
                size="lg"
                onClick={handleClickStart}
                disabled={startDisabled}
              >
                Start workout
              </Button>
            )}
          </BuilderActionBar>
        </>
      )}
    </Page>
  );
};
