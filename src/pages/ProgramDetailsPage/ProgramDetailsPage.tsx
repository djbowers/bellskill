import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  MAX_ACTIVE_PROGRAMS,
  useActivePrograms,
  useEnrollProgram,
  useProgram,
  useSwapProgramMovement,
} from '~/api';
import type { MovementWeight } from '~/api';
import {
  ModifyCountButtons,
  Page,
  ProgramTags,
  StackFitNote,
  WeightUnitTabs,
} from '~/components';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';
import { useSession } from '~/contexts';
import { cn } from '~/lib/utils';
import {
  MovementSwap,
  SwapMovementDialog,
} from '~/pages/ProgramProgressPage/components/SwapMovementDialog';
import { ReplaceProgramDialog } from '~/pages/ProgramsPage/components/ReplaceProgramDialog';
import { programSpanLabel } from '~/pages/ProgramsPage/utils';
import { ProgramSession, WeightUnit, WorkoutGoalUnits } from '~/types';
import {
  WEIGHT_MODE_LABELS,
  getWeightRange,
  getWeightUnitLabel,
  programCadenceLabel,
} from '~/utils';

import {
  deriveMovementWeights,
  isSharedBellProgram,
} from './utils/deriveMovementWeights';
import {
  StartingWeight,
  deriveStartingWeight,
} from './utils/deriveWeightGroups';

// Fallback weight/unit for the picker's initial state before the per-program
// pre-fill from deriveWeightGroups lands. The loading mode is fixed by the
// program's own sessions — only the weights are editable here.
const DEFAULT_STARTING_WEIGHT_VALUE = 24;
const DEFAULT_WEIGHT_UNIT: WeightUnit = 'kilograms';

const goalLabel = (goal: number, units: WorkoutGoalUnits): string | null => {
  if (units === 'minutes') return `${goal} min`;
  if (units === 'rounds') return `${goal} rounds`;
  return `${goal} kg`;
};

/**
 * The movements the whole program trains, in the order they first appear. Every
 * session of a program tends to repeat the same short list, so it reads once
 * above the week rails instead of once per day.
 */
const programMovements = (sessions: ProgramSession[]): string => {
  const names = new Set<string>();
  for (const session of sessions) {
    for (const movement of session.workoutOptions.movements) {
      if (movement.movementName.length > 0) names.add(movement.movementName);
    }
  }
  return [...names].join(' · ');
};

/** Long blurbs collapse; the toggle only appears when there's something hidden. */
const DESCRIPTION_CLAMP_LENGTH = 240;

/** Sessions grouped by their 1-based week, preserving sequenceIndex order. */
const groupByWeek = (
  sessions: ProgramSession[],
): { weekNumber: number; sessions: ProgramSession[] }[] => {
  const weeks: { weekNumber: number; sessions: ProgramSession[] }[] = [];
  for (const session of sessions) {
    const week = weeks.find((w) => w.weekNumber === session.weekNumber);
    if (week) week.sessions.push(session);
    else weeks.push({ weekNumber: session.weekNumber, sessions: [session] });
  }
  return weeks;
};

/**
 * One or two bell inputs for a single weight group. The second slot appears
 * only for double loading — a two-hand program carries `null` there and a
 * single-bell one carries `0`, neither of which is user-editable.
 */
export const WeightSlots = ({
  weight,
  onChange,
  namePrefix,
  showUnitTabs = true,
}: {
  weight: StartingWeight;
  onChange: (weight: StartingWeight) => void;
  namePrefix: string;
  /**
   * Off when the surface hoists a single unit control above a stack of these —
   * one kg/lb switch for the whole screen beats one per bell.
   */
  showUnitTabs?: boolean;
}) => {
  const setSlot = (slot: 'One' | 'Two', value: number) =>
    onChange({ ...weight, [`sharedWeight${slot}Value`]: Math.max(1, value) });

  const slots = (['One', 'Two'] as const).filter((slot) => {
    const value = weight[`sharedWeight${slot}Value`];
    return slot === 'One' ? value !== null : value !== null && value > 0;
  });

  return (
    <>
      {slots.map((slot) => {
        const value = weight[`sharedWeight${slot}Value`] as number;
        const unit = weight[`sharedWeight${slot}Unit`];
        return (
          <ModifyCountButtons
            key={slot}
            {...getWeightRange(unit)}
            bellUnit={unit}
            label={
              slots.length > 1
                ? `${namePrefix} bell ${slot === 'One' ? 1 : 2}`
                : namePrefix
            }
            onClickMinus={() => setSlot(slot, value - 1)}
            onClickPlus={() => setSlot(slot, value + 1)}
            unit={getWeightUnitLabel(unit)}
            unitTabs={
              showUnitTabs ? (
                <WeightUnitTabs
                  value={unit}
                  onChange={(nextUnit) =>
                    onChange({
                      ...weight,
                      [`sharedWeight${slot}Unit`]: nextUnit,
                    })
                  }
                />
              ) : undefined
            }
            value={value}
            onChange={(next) => setSlot(slot, next)}
          />
        );
      })}
    </>
  );
};

/**
 * Pre-enroll details view for a shared program (route `programs/:id/details`).
 * Shows the program's description, cadence, and week-by-week session breakdown,
 * hosts the starting-weight picker inline, and starts the program from here —
 * the "look before you commit" step ahead of enrollment. Own programs redirect
 * to their progress page; this view is for shared programs you don't own yet.
 */
export const ProgramDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const session = useSession();
  const { data, isLoading, isError } = useProgram(id);
  const { data: activePrograms = [] } = useActivePrograms();
  const enroll = useEnrollProgram();
  const swapMovement = useSwapProgramMovement();

  const [seeded, setSeeded] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState(false);
  const [replaceEnrollmentId, setReplaceEnrollmentId] = useState<string | null>(
    null,
  );
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  // Shared-bell path: one bell pair for every movement in the session.
  const [sharedWeightOneValue, setSharedWeightOneValue] = useState<
    number | null
  >(DEFAULT_STARTING_WEIGHT_VALUE);
  const [sharedWeightOneUnit, setSharedWeightOneUnit] =
    useState<WeightUnit | null>(DEFAULT_WEIGHT_UNIT);
  const [sharedWeightTwoValue, setSharedWeightTwoValue] = useState<
    number | null
  >(DEFAULT_STARTING_WEIGHT_VALUE);
  const [sharedWeightTwoUnit, setSharedWeightTwoUnit] =
    useState<WeightUnit | null>(DEFAULT_WEIGHT_UNIT);
  // Per-movement path: chosen starting weight per movement, keyed by name.
  const [movementWeights, setMovementWeights] = useState<
    Record<string, StartingWeight>
  >({});
  // Swaps chosen before enrolling, keyed by the OLD movement name — the enroll
  // payload still speaks the program's original names; the swap RPC renames
  // each one right after the enrollment row exists.
  const [pendingSwaps, setPendingSwaps] = useState<
    Record<string, MovementSwap>
  >({});
  // Which movement's swap dialog is open (its original name), if any.
  const [swapTarget, setSwapTarget] = useState<string | null>(null);
  // Whether the enrollment should loop on completion. Seeded from the program's
  // template default once it loads; the user can flip it before starting.
  const [autoRepeat, setAutoRepeat] = useState(false);

  const program = data?.program;
  const sessions = data?.sessions;
  const userId = session?.user?.id;
  // This route is for shared programs you don't own; redirect an own-program
  // deep link to its progress page instead of showing a starting-weight picker
  // for a program you already configured in the builder.
  const isOwnProgram = !!program && program.ownerId === userId;

  // A shared-bell program (an ABC, say) uses one bell pair throughout, so it
  // keeps a single shared-weight picker; every other program gets a control per
  // movement, each sized to that movement's own config.
  const sharedBell = useMemo(
    () => (sessions ? isSharedBellProgram(sessions) : false),
    [sessions],
  );
  const movementControls = useMemo(
    () => (sessions ? deriveMovementWeights(sessions) : []),
    [sessions],
  );

  const workingWeight: StartingWeight = {
    sharedWeightOneValue,
    sharedWeightOneUnit,
    sharedWeightTwoValue,
    sharedWeightTwoUnit,
  };

  useEffect(() => {
    if (!sessions || seeded) return;
    if (sharedBell) {
      const derived = deriveStartingWeight(sessions);
      setSharedWeightOneValue(derived.sharedWeightOneValue);
      setSharedWeightOneUnit(derived.sharedWeightOneUnit);
      setSharedWeightTwoValue(derived.sharedWeightTwoValue);
      setSharedWeightTwoUnit(derived.sharedWeightTwoUnit);
    } else {
      setMovementWeights(
        Object.fromEntries(
          movementControls.map((control) => [
            control.movementName,
            control.modalWeight,
          ]),
        ),
      );
    }
    setSeeded(true);
  }, [sessions, seeded, sharedBell, movementControls]);

  useEffect(() => {
    if (isOwnProgram && id) navigate(`/programs/${id}`, { replace: true });
  }, [isOwnProgram, id, navigate]);

  // Seed the toggle from the program's default once, when the program loads.
  useEffect(() => {
    if (program) setAutoRepeat(program.defaultAutoRepeat);
    // Keyed on program identity so a later re-render never clobbers the user's
    // choice; only a different program re-seeds the default.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program?.id]);

  const handleChangeWorkingWeight = (weight: StartingWeight) => {
    setSharedWeightOneValue(weight.sharedWeightOneValue);
    setSharedWeightOneUnit(weight.sharedWeightOneUnit);
    setSharedWeightTwoValue(weight.sharedWeightTwoValue);
    setSharedWeightTwoUnit(weight.sharedWeightTwoUnit);
  };

  const handleChangeMovementWeight = (
    movementName: string,
    weight: StartingWeight,
  ) => {
    setMovementWeights((current) => ({ ...current, [movementName]: weight }));
  };

  // One entry per movement carrying a loaded bell — bodyweight movements
  // ('none') are omitted, so the RPC keeps them bodyweight.
  const movementWeightPayload: MovementWeight[] = movementControls
    .filter((control) => control.mode !== 'none')
    .map((control) => {
      const chosen =
        movementWeights[control.movementName] ?? control.modalWeight;
      return {
        movementName: control.movementName,
        weightOneValue: chosen.sharedWeightOneValue,
        weightOneUnit: chosen.sharedWeightOneUnit,
        weightTwoValue: chosen.sharedWeightTwoValue,
        weightTwoUnit: chosen.sharedWeightTwoUnit,
      };
    });

  // Only *active* enrollments consume a parallel slot — a completed program may
  // still be returned by useActivePrograms (to drive the home "complete" card).
  const activeEnrollments = activePrograms.filter(
    (p) => p.enrollment.status === 'active',
  );
  const slotsFull = activeEnrollments.length >= MAX_ACTIVE_PROGRAMS;
  // At the cap one running program has to stop. The prompt pre-selects the
  // least-recently-worked one and lets the choice move; below the cap,
  // enrolling just claims a free slot and displaces nothing.
  const displacedId = slotsFull
    ? (replaceEnrollmentId ?? activeEnrollments[0]?.enrollment.id ?? null)
    : null;

  // The chosen weights + auto-repeat, shared by an immediate start and a
  // queue-for-later (a queued clone bakes the same weights now).
  const enrollmentConfig = () => ({
    autoRepeat,
    ...(sharedBell
      ? {
          sharedWeightOneValue,
          sharedWeightOneUnit,
          sharedWeightTwoValue,
          sharedWeightTwoUnit,
        }
      : { movementWeights: movementWeightPayload }),
  });

  // The enrollment clones the program under its original movement names; each
  // pending swap then renames its movement on the fresh clone, one at a time
  // (the RPC rewrites whole sessions, so parallel calls could clobber).
  const applyPendingSwaps = async (userProgramId: string) => {
    for (const swap of Object.values(pendingSwaps)) {
      await swapMovement.mutateAsync({ userProgramId, ...swap });
    }
  };

  const doEnroll = () => {
    if (!id) return;
    setPendingSwitch(false);
    enroll.mutate(
      {
        programId: id,
        replaceUserProgramId: displacedId ?? undefined,
        ...enrollmentConfig(),
      },
      {
        onSuccess: async (userProgramId) => {
          await applyPendingSwaps(userProgramId);
          navigate('/');
        },
      },
    );
  };

  // Queue instead of starting: no slot is claimed, so nothing is displaced.
  // Land on Programs, where "Up next" shows the new place in line.
  const queueForLater = () => {
    if (!id) return;
    setPendingSwitch(false);
    enroll.mutate(
      { programId: id, queue: true, ...enrollmentConfig() },
      {
        onSuccess: async (userProgramId) => {
          await applyPendingSwaps(userProgramId);
          navigate('/programs');
        },
      },
    );
  };

  const handleStart = () => {
    if (slotsFull) {
      setReplaceEnrollmentId(
        replaceEnrollmentId ?? activeEnrollments[0]?.enrollment.id ?? null,
      );
      setPendingSwitch(true);
    } else {
      doEnroll();
    }
  };

  // The kg/lb switch is hoisted out of the individual bell controls: one unit
  // for the screen, applied to every slot that carries a weight at all.
  const displayUnit: WeightUnit =
    (sharedBell
      ? sharedWeightOneUnit
      : movementControls
          .map((control) => movementWeights[control.movementName])
          .find((weight) => weight?.sharedWeightOneUnit)
          ?.sharedWeightOneUnit) ?? DEFAULT_WEIGHT_UNIT;

  const retuneUnits = (weight: StartingWeight, unit: WeightUnit) => ({
    ...weight,
    sharedWeightOneUnit: weight.sharedWeightOneUnit === null ? null : unit,
    sharedWeightTwoUnit: weight.sharedWeightTwoUnit === null ? null : unit,
  });

  const handleChangeUnit = (unit: WeightUnit) => {
    handleChangeWorkingWeight(retuneUnits(workingWeight, unit));
    setMovementWeights((current) =>
      Object.fromEntries(
        Object.entries(current).map(([name, weight]) => [
          name,
          retuneUnits(weight, unit),
        ]),
      ),
    );
  };

  if (isLoading) {
    return (
      <Page title="Program">
        <p className="text-sm text-muted-foreground">Loading program…</p>
      </Page>
    );
  }

  if (isError || !data) {
    return (
      <Page title="Program">
        <p className="text-sm text-muted-foreground">Program not found.</p>
        <Button variant="secondary" onClick={() => navigate('/programs')}>
          Back to programs
        </Button>
      </Page>
    );
  }

  // Redirecting an own-program deep link (the effect above fires); render
  // nothing rather than flashing a picker for a program you already configured.
  if (isOwnProgram) return null;

  const weeks = groupByWeek(data.sessions);
  const movements = programMovements(data.sessions);
  const description = data.program.description ?? '';
  const clampable = description.length > DESCRIPTION_CLAMP_LENGTH;

  return (
    <Page title={data.program.title}>
      <Link
        to="/programs"
        className="self-start text-xs font-medium text-muted-foreground"
      >
        ← Programs
      </Link>

      <Card>
        <CardContent className="flex gap-1.5 pt-2">
          {/* The same span monogram the catalog row carried, so the program you
              tapped still looks like itself here. */}
          <span
            aria-hidden
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold tabular-nums text-primary"
          >
            {programSpanLabel(data.program)}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {data.program.authorName ? `${data.program.authorName} · ` : ''}
              {programCadenceLabel(data.program) ?? 'No sessions yet'}
            </p>
            <ProgramTags tags={data.program.focusTags} />
            {description && (
              <>
                <p
                  className={cn(
                    'text-sm text-muted-foreground',
                    clampable && !descriptionExpanded && 'line-clamp-4',
                  )}
                >
                  {description}
                </p>
                {clampable && (
                  <button
                    type="button"
                    className="self-start text-xs font-medium text-primary"
                    onClick={() => setDescriptionExpanded((open) => !open)}
                  >
                    {descriptionExpanded ? 'Show less' : 'Read more'}
                  </button>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {weeks.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Sessions
          </h2>
          {movements && (
            <p className="-mt-1 text-xs text-muted-foreground">{movements}</p>
          )}
          {weeks.map((week) => (
            <div key={week.weekNumber} className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                Week {week.weekNumber}
                <span aria-hidden className="h-px flex-1 bg-border" />
              </span>
              <div className="flex flex-wrap gap-1">
                {week.sessions.map((programSession) => {
                  const { workoutGoal, workoutGoalUnits } =
                    programSession.workoutOptions;
                  const goal = goalLabel(workoutGoal, workoutGoalUnits);
                  return (
                    <span
                      key={programSession.id}
                      className="flex max-w-full items-center gap-1 rounded-md border border-border/60 px-1.5 py-1 text-xs"
                    >
                      <span className="truncate font-medium">
                        Day {programSession.dayNumber} · {programSession.title}
                      </span>
                      {goal && (
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {goal}
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      <Card>
        <CardContent className="flex min-w-0 flex-col gap-1.5 pt-2">
          <div className="flex items-center justify-between gap-1">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Starting weight
            </h2>
            <WeightUnitTabs value={displayUnit} onChange={handleChangeUnit} />
          </div>
          <p className="text-xs text-muted-foreground">
            What your working sessions start with. You can still adjust it
            session by session once you&apos;re in the program.
          </p>

          {!seeded && <p className="text-sm text-muted-foreground">Loading…</p>}

          {/* A shared-bell program uses one bell pair throughout, so a single
              picker; every other program gets one control per movement. */}
          {seeded && sharedBell && (
            <WeightSlots
              weight={workingWeight}
              onChange={handleChangeWorkingWeight}
              namePrefix="Starting weight"
              showUnitTabs={false}
            />
          )}

          {seeded &&
            !sharedBell &&
            movementControls.map((control) => (
              <div
                key={control.movementName}
                className="flex flex-col gap-0.5 border-t border-border pt-1.5"
              >
                <div className="flex items-center justify-between gap-1">
                  <h3 className="text-sm font-medium">
                    {pendingSwaps[control.movementName]?.newMovementName ??
                      control.movementName}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto px-1 py-0.5 text-xs text-muted-foreground"
                    aria-label={`Swap ${control.movementName}`}
                    onClick={() => setSwapTarget(control.movementName)}
                  >
                    {pendingSwaps[control.movementName] ? 'Swapped' : 'Swap'}
                  </Button>
                </div>
                {control.mode === 'none' ? (
                  <p className="text-xs text-muted-foreground">
                    {WEIGHT_MODE_LABELS.none}
                  </p>
                ) : (
                  <WeightSlots
                    weight={
                      movementWeights[control.movementName] ??
                      control.modalWeight
                    }
                    onChange={(next) =>
                      handleChangeMovementWeight(control.movementName, next)
                    }
                    namePrefix={control.movementName}
                    showUnitTabs={false}
                  />
                )}
              </div>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-1 pt-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Program settings
          </h2>
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-px">
              <Label htmlFor="auto-repeat" size="small">
                Repeat automatically
              </Label>
              <span
                id="auto-repeat-help"
                className="text-xs text-muted-foreground"
              >
                Finishing the last session starts the program over instead of
                ending it. Progress by adding weight over time.
              </span>
            </div>
            <Switch
              id="auto-repeat"
              className="mt-0.5"
              aria-describedby="auto-repeat-help"
              checked={autoRepeat}
              onCheckedChange={setAutoRepeat}
            />
          </div>
        </CardContent>
      </Card>

      {/* Advisory only: what this program costs on top of what's already
          running. Silent when there's nothing worth saying. */}
      {program && (
        <StackFitNote
          candidate={program}
          active={activeEnrollments.map((a) => a.program)}
        />
      )}

      {/* One primary decision — start it. Queueing is the same commitment made
          later, so it reads as the quiet alternative rather than a peer CTA. */}
      <div className="flex flex-col gap-0.5">
        <Button onClick={handleStart} disabled={enroll.isPending || !seeded}>
          Start program
        </Button>
        <Button
          variant="ghost"
          className="text-muted-foreground"
          onClick={queueForLater}
          disabled={enroll.isPending || !seeded}
        >
          Queue for later
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Queued programs start when an active program finishes.
        </p>
      </div>

      <ReplaceProgramDialog
        open={pendingSwitch}
        onOpenChange={(open) => {
          if (!open) setPendingSwitch(false);
        }}
        activeEnrollments={activeEnrollments}
        replaceEnrollmentId={replaceEnrollmentId}
        onSelectReplace={setReplaceEnrollmentId}
        onCancel={() => setPendingSwitch(false)}
        onQueueInstead={queueForLater}
        onConfirm={doEnroll}
        isPending={enroll.isPending}
      />

      {swapTarget && (
        <SwapMovementDialog
          open
          onOpenChange={(open) => {
            if (!open) setSwapTarget(null);
          }}
          movements={movementControls}
          oldMovementName={swapTarget}
          extraTakenNames={Object.entries(pendingSwaps)
            .filter(([oldName]) => oldName !== swapTarget)
            .map(([, swap]) => swap.newMovementName)}
          onPendingSwap={(swap) =>
            setPendingSwaps((current) => ({
              ...current,
              [swap.oldMovementName]: swap,
            }))
          }
        />
      )}
    </Page>
  );
};
