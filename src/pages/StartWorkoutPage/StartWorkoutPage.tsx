import { ArrowLeftIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  AnalyticsEvent,
  RepeatableWorkout,
  trackEvent,
  useActiveProgram,
  useCompleteProgramSession,
  useFeatureFlags,
  useWorkoutLogs,
} from '~/api';
import { Page } from '~/components';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
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
import { getWeightsDisplayValue } from '~/pages/CompletedWorkoutPage/utils/displayValues';
import {
  CuratedWorkout,
  MovementOptions,
  Recommendation,
  WeightTabValue,
  WeightUnit,
  WorkoutGoalUnits,
  WorkoutOptions,
} from '~/types';
import {
  WEIGHT_MODE_LABELS,
  getWeightTabValue,
  getWeightUnitLabel,
} from '~/utils';

import {
  AddToWorkoutSection,
  ModifyCountButtons,
  ModifyWorkoutButtons,
  MovementAutocomplete,
  MovementsHeader,
  NextProgramWorkoutCard,
  RecommendSessionSection,
  RecommendedWorkoutsSection,
  Section,
  WeightModeTabs,
  WeightUnitTabs,
} from './components';
import { useRecommendedWorkouts } from './hooks';
import { recommendationToWorkoutOptions } from './utils/recommendationToMovements';

const DEFAULT_INTERVAL_TIMER: number = 30; // seconds
const DEFAULT_REST_TIMER: number = 30; // seconds
const DEFAULT_WEIGHT_UNIT: WeightUnit =
  DEFAULT_MOVEMENT_OPTIONS.weightOneUnit ?? 'kilograms';
const DEFAULT_WEIGHT_VALUE: number =
  DEFAULT_MOVEMENT_OPTIONS.weightOneValue ?? 16;

const INCREMENT_DURATION: number = 1; // minutes
const INCREMENT_INTERVAL_TIMER: number = 5; // seconds
const INCREMENT_REST_TIMER: number = 5; // seconds
const INCREMENT_VOLUME: number = 10; // kg
const DEFAULT_VOLUME: number = 1000; // kg
const DEFAULT_MINUTES: number = 10; // minutes
const DEFAULT_ROUNDS: number = 10; // rounds

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
}

interface StartWorkoutPageProps {
  programSaveMode?: ProgramSaveMode;
}

export const StartWorkoutPage = ({
  programSaveMode,
}: StartWorkoutPageProps = {}) => {
  const features = useFeatures();
  // Discovery surfaces (curated / repeat / recommender) migrated onto the
  // runtime feature-flag mechanism (PROD-175). Resolved per user, defaulting to
  // all-OFF (pure builder) while loading, on error, or until deliberately
  // toggled — so production behavior is unchanged. `experimentFlagsPending`
  // holds the page in browse until the (async) eval resolves, so a treatment
  // user isn't stranded in the builder by the all-OFF placeholder (mirrors
  // `programGatePending`).
  const { features: experimentFeatures, isPending: experimentFlagsPending } =
    useFeatureFlags();
  const navigate = useNavigate();
  const startWorkout = useStartWorkout();
  const [workoutOptions] = useWorkoutOptions();
  const { curated, recentRepeats } = useRecommendedWorkouts();

  // Program tracking (Slice 3), behind the `programs` flag. The query is gated so
  // non-program builds fire zero extra requests (zero regression). `data` is
  // undefined only while the enabled query is still loading, so `programGate-
  // Pending` reliably holds the page in browse mode until we know whether to
  // surface the next-workout card — avoiding a builder→card flash on open.
  const activeProgramQuery = useActiveProgram({ enabled: features.programs });
  const activeProgram = activeProgramQuery.data ?? null;
  const hasActiveProgram = Boolean(activeProgram);
  const programGatePending =
    features.programs &&
    !programSaveMode &&
    activeProgramQuery.data === undefined;
  const completeProgramSession = useCompleteProgramSession();

  // Discovery surfaces are individually flag-gated (PROD-174). With every one
  // off, there's nothing to browse, so the page is the pure custom builder. In
  // save-session mode the page is always the builder — no browse surfaces. An
  // active program forces browse so its next-workout card is the first thing the
  // user sees on open.
  const showCurated = experimentFeatures.curatedFirstWorkout;
  const showRepeat = experimentFeatures.repeatPrevious;
  const showBrowse =
    !programSaveMode &&
    (hasActiveProgram ||
      programGatePending ||
      experimentFlagsPending ||
      showCurated ||
      showRepeat ||
      experimentFeatures.recommender);

  // When a discovery surface is enabled the page opens in "browse" mode
  // (recommendations + a Build-custom button); selecting one or tapping
  // Build-custom switches to the builder. With nothing to browse, or when the
  // history "Repeat" action navigates here with `editWorkout`, the builder
  // opens directly.
  const location = useLocation();
  const [showBuilder, setShowBuilder] = useState<boolean>(
    !showBrowse ||
      Boolean(
        (location.state as { editWorkout?: boolean } | null)?.editWorkout,
      ),
  );
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

  // Activation funnel (PROD-157): a user with zero workout logs is "new".
  // While the logs query is still loading (workoutLogs === undefined) we don't
  // yet know, so emit null rather than a misleading `false` for a genuine
  // first-timer who taps Start before the query resolves.
  const session = useSession();
  const userId = session?.user?.id;
  const { data: workoutLogs } = useWorkoutLogs();
  const isFirstWorkout =
    workoutLogs === undefined ? null : workoutLogs.length === 0;
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

  useEffect(
    function dropIntoBuilderWhenNothingToBrowse() {
      // The initial `showBuilder` is fixed at mount, before the (async) program
      // and feature-flag gates resolve. Once both settle to "nothing to browse"
      // (no program, all discovery flags OFF), fall into the builder — matching
      // the non-program default — so the page never renders blank (neither
      // browse nor builder).
      if (
        !programGatePending &&
        !experimentFlagsPending &&
        !showBrowse &&
        !showBuilder
      ) {
        setShowBuilder(true);
      }
    },
    [programGatePending, experimentFlagsPending, showBrowse, showBuilder],
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
  const [workoutDetails, setWorkoutDetails] = useState<string | null>(
    workoutOptions.workoutDetails,
  );
  const [intervalTimer, setIntervalTimer] = useState<number>(
    workoutOptions.intervalTimer,
  );
  const [restTimer, setRestTimer] = useState<number>(workoutOptions.restTimer);
  const [complexSet, setComplexSet] = useState<boolean>(
    workoutOptions.complexSet,
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

  const detailsRef = useRef<HTMLInputElement>(null);

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

  const handleAddDetails = () => setWorkoutDetails('');

  const handleBlurDetails = () => {
    setWorkoutDetails(detailsRef.current?.value ?? '');
  };

  const handleToggleNotes = () => {
    if (workoutDetails !== null) {
      setWorkoutDetails(null);
    } else {
      handleAddDetails();
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

  const handleToggleComplex = () => setComplexSet((prev) => !prev);

  const handleChangeMovementName = (index: number, value: string) =>
    setMovements((prev) =>
      prev.map((movement, i) =>
        i === index ? { ...movement, movementName: value } : movement,
      ),
    );

  const handleClickRemoveMovement = (index: number) =>
    setMovements((prev) => prev.filter((_, i) => i !== index));

  const handleClickAddMovement = () =>
    setMovements((prev) => [...prev, DEFAULT_MOVEMENT_OPTIONS]);

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

  const handleClickMinusRung = (index: number) =>
    setMovements((prev) =>
      prev.map((movement, i) =>
        i === index
          ? {
              ...movement,
              repScheme: movement.repScheme.slice(0, -1),
            }
          : movement,
      ),
    );

  const handleClickPlusRung = (index: number) =>
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

  // Fan a set of workout options out to the builder's local state so the user
  // can review/edit before starting.
  const loadIntoBuilder = (options: Omit<WorkoutOptions, 'startedAt'>) => {
    setMovements(options.movements);
    setWorkoutGoal(options.workoutGoal);
    setWorkoutGoalUnits(options.workoutGoalUnits);
    setWorkoutDetails(options.workoutDetails);
    setIntervalTimer(options.intervalTimer);
    setRestTimer(options.restTimer);
    setComplexSet(options.complexSet);
    setSharedWeightOneValue(options.sharedWeightOneValue);
    setSharedWeightOneUnit(options.sharedWeightOneUnit);
    setSharedWeightTwoValue(options.sharedWeightTwoValue);
    setSharedWeightTwoUnit(options.sharedWeightTwoUnit);
  };

  const handleSelectCurated = (workout: CuratedWorkout) => {
    loadIntoBuilder(workout.workoutOptions);
    setStartSource('curated');
    setStartSourceProps({
      template_id: workout.id,
      curated_version: CURATED_WORKOUTS_VERSION,
    });
    setPendingProgramSession(null);
    setShowBuilder(true);
  };

  const handleSelectRepeat = (repeat: RepeatableWorkout) => {
    loadIntoBuilder(repeat.workoutOptions);
    setStartSource('history_repeat');
    setStartSourceProps({ workout_log_id: repeat.workoutLogId });
    setPendingProgramSession(null);
    setShowBuilder(true);
  };

  // Accept an AI recommendation: load it into the builder for review/edits, then
  // start via the existing Start button (attributed to the recommender source).
  const handleAcceptRecommendation = (
    recommendation: Recommendation,
    recommendationId: string,
  ) => {
    loadIntoBuilder(recommendationToWorkoutOptions(recommendation));
    setStartSource('recommender');
    setStartSourceProps({ recommendation_id: recommendationId });
    setPendingProgramSession(null);
    setShowBuilder(true);
  };

  const handleClickBuildCustom = () => {
    loadIntoBuilder(DEFAULT_WORKOUT_OPTIONS);
    setStartSource('builder');
    setStartSourceProps({});
    setPendingProgramSession(null);
    setShowBuilder(true);
  };

  // Load the program's next session into the builder for review/edits, tagged so
  // the eventual start attributes to `program` and the log step advances it.
  const handleStartProgram = () => {
    if (!activeProgram?.nextSession) return;
    const { session } = activeProgram.nextSession;
    loadIntoBuilder(activeProgram.nextSession.workoutOptions);
    setStartSource('program');
    setStartSourceProps({
      user_program_id: activeProgram.enrollment.id,
      program_session_id: session.id,
    });
    setPendingProgramSession({
      userProgramId: activeProgram.enrollment.id,
      programSessionId: session.id,
    });
    setShowBuilder(true);
  };

  // Skip the next session: writes a `skipped` completion (no workout_log), which
  // advances the cursor to the following session without leaving the home card.
  const handleSkipProgram = () => {
    if (!activeProgram?.nextSession || completeProgramSession.isLoading) return;
    completeProgramSession.mutate({
      userProgramId: activeProgram.enrollment.id,
      programSessionId: activeProgram.nextSession.session.id,
      status: 'skipped',
    });
  };

  const handleBackToRecommendations = () => {
    setStartSource('builder');
    setStartSourceProps({});
    setPendingProgramSession(null);
    setShowBuilder(false);
  };

  const handleClickStart = () => {
    startWorkout(
      {
        complexSet,
        intervalTimer,
        movements,
        restTimer,
        sharedWeightOneUnit,
        sharedWeightOneValue,
        sharedWeightTwoUnit,
        sharedWeightTwoValue,
        workoutDetails: workoutDetails?.trim() || null,
        workoutGoal,
        workoutGoalUnits,
      },
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
      {
        complexSet,
        intervalTimer,
        movements,
        restTimer,
        sharedWeightOneUnit,
        sharedWeightOneValue,
        sharedWeightTwoUnit,
        sharedWeightTwoValue,
        workoutDetails: workoutDetails?.trim() || null,
        workoutGoal,
        workoutGoalUnits,
      },
      sessionTitle.trim(),
    );
  };

  const sharedWeightTabValue = getWeightTabValue({
    weightOneValue: sharedWeightOneValue,
    weightTwoValue: sharedWeightTwoValue,
  });

  const isDifferentRepSchemes =
    movements.length > 1 &&
    movements.some(
      (movement) => movement.repScheme.length !== movements[0].repScheme.length,
    );

  const startDisabled =
    movements.length === 0 ||
    movements.some((movement) => movement.movementName.length === 0) ||
    isDifferentRepSchemes ||
    workoutGoal <= 0;

  return (
    <Page
      actions={
        showBuilder ? (
          programSaveMode ? (
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
              {programSaveMode.saving ? 'Saving…' : 'Save session'}
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
          )
        ) : undefined
      }
    >
      {!showBuilder && showBrowse && (
        <>
          {activeProgram && (
            <NextProgramWorkoutCard
              programTitle={activeProgram.program.title}
              nextSession={activeProgram.nextSession}
              progress={activeProgram.progress}
              isComplete={activeProgram.isComplete}
              onStart={handleStartProgram}
              onSkip={handleSkipProgram}
              skipping={completeProgramSession.isLoading}
              onViewProgress={() =>
                navigate(`/programs/${activeProgram.program.id}`)
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

          {experimentFeatures.recommender && (
            <RecommendSessionSection
              userId={userId}
              onAccept={handleAcceptRecommendation}
            />
          )}

          <Button
            variant="secondary"
            className="w-full"
            onClick={handleClickBuildCustom}
          >
            Build custom workout
          </Button>
        </>
      )}

      {showBuilder && (
        <>
          {showBrowse && (
            <button
              type="button"
              onClick={handleBackToRecommendations}
              className="flex items-center gap-0.5 self-start text-xs font-medium text-muted-foreground"
            >
              <ArrowLeftIcon className="h-2 w-2" aria-hidden="true" />
              Recommendations
            </button>
          )}

          {programSaveMode && (
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
                onClickMinus={handleDecrementGoalValue}
                onClickPlus={handleIncrementGoalValue}
                onChange={setWorkoutGoal}
                unit={workoutGoalUnits}
                value={workoutGoal}
              />
            </Section>
          </Card>

          <AddToWorkoutSection
            complexSet={complexSet}
            hasNotes={workoutDetails !== null}
            hasInterval={intervalTimer > 0}
            hasRest={restTimer > 0}
            showComplex={features.complexMode}
            onToggleComplex={handleToggleComplex}
            onToggleInterval={handleToggleInterval}
            onToggleNotes={handleToggleNotes}
            onToggleRest={handleToggleRest}
          />

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

          {workoutDetails !== null && (
            <Card>
              <Section title="Notes">
                <Input
                  autoFocus
                  className="w-full"
                  defaultValue={workoutDetails}
                  onBlur={handleBlurDetails}
                  ref={detailsRef}
                />
              </Section>
            </Card>
          )}

          {intervalTimer > 0 && (
            <Card>
              <Section title="Interval Timer">
                <ModifyCountButtons
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
                  onClickMinus={handleDecrementRest}
                  onClickPlus={handleIncrementRest}
                  unit="sec"
                  value={restTimer}
                  onChange={setRestTimer}
                />
              </Section>
            </Card>
          )}

          <MovementsHeader count={movements.length} />

          {movements.map((movement, index) => {
            const weightTabValue = getWeightTabValue(movement);
            const activeWeightMode: WeightTabValue = complexSet
              ? sharedWeightTabValue
              : weightTabValue;
            const weightSummary =
              movement.movementName.length > 0
                ? getWeightsDisplayValue(
                    movement.weightOneValue,
                    movement.weightOneUnit,
                    movement.weightTwoValue,
                    movement.weightTwoUnit,
                  )
                : null;

            return (
              <Card key={index}>
                <Section
                  title={`Movement #${index + 1}`}
                  actions={
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove movement"
                      onClick={() => handleClickRemoveMovement(index)}
                    >
                      <XMarkIcon className="h-2.5 w-2.5" />
                    </Button>
                  }
                >
                  <MovementAutocomplete
                    value={movement.movementName}
                    onChange={(name) => handleChangeMovementName(index, name)}
                    weightMode={activeWeightMode}
                    onWeightModeChange={(mode) =>
                      complexSet
                        ? handleChangeSharedWeightTab(mode)
                        : handleChangeWeightTab(index, mode)
                    }
                    showWeightModeTabs={!complexSet}
                    weightModeHint={
                      complexSet
                        ? `Using shared weight: ${WEIGHT_MODE_LABELS[sharedWeightTabValue]}`
                        : null
                    }
                    weightSummary={weightSummary}
                  />
                </Section>
                {!complexSet && weightTabValue !== 'none' && (
                  <Section title="Load">
                    <ModifyCountButtons
                      onClickMinus={() =>
                        handleChangeWeightOneValue(
                          index,
                          movement.weightOneValue! - 1,
                        )
                      }
                      onClickPlus={() =>
                        handleChangeWeightOneValue(
                          index,
                          movement.weightOneValue! + 1,
                        )
                      }
                      unit={getWeightUnitLabel(movement.weightOneUnit)}
                      unitTabs={
                        <WeightUnitTabs
                          value={movement.weightOneUnit}
                          onChange={(value) =>
                            handleChangeWeightOneUnit(index, value)
                          }
                        />
                      }
                      value={movement.weightOneValue!}
                      onChange={(value) =>
                        handleChangeWeightOneValue(index, value!)
                      }
                    />
                    {movement.weightTwoValue !== null &&
                      movement.weightTwoValue > 0 && (
                        <ModifyCountButtons
                          onClickMinus={() =>
                            handleChangeWeightTwoValue(
                              index,
                              movement.weightTwoValue! - 1,
                            )
                          }
                          onClickPlus={() =>
                            handleChangeWeightTwoValue(
                              index,
                              movement.weightTwoValue! + 1,
                            )
                          }
                          unit={getWeightUnitLabel(movement.weightTwoUnit)}
                          unitTabs={
                            <WeightUnitTabs
                              value={movement.weightTwoUnit}
                              onChange={(value) =>
                                handleChangeWeightTwoUnit(index, value)
                              }
                            />
                          }
                          value={movement.weightTwoValue}
                          onChange={(value) =>
                            handleChangeWeightTwoValue(index, value)
                          }
                        />
                      )}
                  </Section>
                )}
                <Section
                  title="Rep Scheme"
                  actions={
                    <ModifyWorkoutButtons
                      count={movement.repScheme.length}
                      label="Rung"
                      onClickMinus={() => handleClickMinusRung(index)}
                      onClickPlus={() => handleClickPlusRung(index)}
                    />
                  }
                >
                  {movement.repScheme.map((_, rungIndex) => (
                    <ModifyCountButtons
                      key={rungIndex}
                      value={movement.repScheme[rungIndex]}
                      onChange={(value) =>
                        handleChangeRepScheme(index, rungIndex, value)
                      }
                      onClickMinus={() =>
                        handleChangeRepScheme(
                          index,
                          rungIndex,
                          movement.repScheme[rungIndex] - 1,
                        )
                      }
                      onClickPlus={() =>
                        handleChangeRepScheme(
                          index,
                          rungIndex,
                          movement.repScheme[rungIndex] + 1,
                        )
                      }
                      unit="reps"
                    />
                  ))}
                </Section>
              </Card>
            );
          })}

          <Button variant="secondary" onClick={handleClickAddMovement}>
            + Movement
          </Button>

          {isDifferentRepSchemes && (
            <div className="text-sm text-red-500">
              Rep schemes must contain the same number of rungs for each
              movement.
            </div>
          )}
        </>
      )}
    </Page>
  );
};
