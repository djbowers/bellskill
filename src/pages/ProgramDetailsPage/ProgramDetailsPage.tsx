import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  MAX_ACTIVE_PROGRAMS,
  useActivePrograms,
  useEnrollProgram,
  useProgram,
} from '~/api';
import type { MovementWeight } from '~/api';
import { ModifyCountButtons, Page, WeightUnitTabs } from '~/components';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';
import { useSession } from '~/contexts';
import {
  MovementOptions,
  ProgramSession,
  WeightUnit,
  WorkoutGoalUnits,
} from '~/types';
import {
  getWeightRange,
  getWeightUnitLabel,
  programCadenceLabel,
  WEIGHT_MODE_LABELS,
} from '~/utils';

import {
  deriveMovementWeights,
  isComplexProgram,
} from './utils/deriveMovementWeights';
import { deriveStartingWeight, StartingWeight } from './utils/deriveWeightGroups';

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

const movementsSummary = (movements: MovementOptions[]): string =>
  movements
    .map((movement) => movement.movementName)
    .filter((name) => name.length > 0)
    .join(' · ');

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
const WeightSlots = ({
  weight,
  onChange,
  namePrefix,
}: {
  weight: StartingWeight;
  onChange: (weight: StartingWeight) => void;
  namePrefix: string;
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
              <WeightUnitTabs
                value={unit}
                onChange={(nextUnit) =>
                  onChange({ ...weight, [`sharedWeight${slot}Unit`]: nextUnit })
                }
              />
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

  const [seeded, setSeeded] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState(false);
  // Complex-set path: one shared bell pair for the whole complex.
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
  // Non-complex path: chosen starting weight per movement, keyed by name.
  const [movementWeights, setMovementWeights] = useState<
    Record<string, StartingWeight>
  >({});
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

  // A complex program (ABC) uses one bell pair for the whole complex, so it
  // keeps a single shared-weight picker; every other program gets a control per
  // movement, each sized to that movement's own config.
  const complex = useMemo(
    () => (sessions ? isComplexProgram(sessions) : false),
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
    if (complex) {
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
  }, [sessions, seeded, complex, movementControls]);

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
      const chosen = movementWeights[control.movementName] ?? control.modalWeight;
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
  // At the cap this program displaces the least-recently-worked one, which the
  // confirm dialog names. Below it, enrolling just claims a free slot.
  const displaced = slotsFull ? activeEnrollments[0] : null;

  // The chosen weights + auto-repeat, shared by an immediate start and a
  // queue-for-later (a queued clone bakes the same weights now).
  const enrollmentConfig = () => ({
    autoRepeat,
    ...(complex
      ? {
          sharedWeightOneValue,
          sharedWeightOneUnit,
          sharedWeightTwoValue,
          sharedWeightTwoUnit,
        }
      : { movementWeights: movementWeightPayload }),
  });

  const doEnroll = () => {
    if (!id) return;
    setPendingSwitch(false);
    enroll.mutate(
      {
        programId: id,
        replaceUserProgramId: displaced?.enrollment.id,
        ...enrollmentConfig(),
      },
      { onSuccess: () => navigate('/') },
    );
  };

  // Queue instead of starting: no slot is claimed, so nothing is displaced.
  // Land on Programs, where "Up next" shows the new place in line.
  const queueForLater = () => {
    if (!id) return;
    enroll.mutate(
      { programId: id, queue: true, ...enrollmentConfig() },
      { onSuccess: () => navigate('/programs') },
    );
  };

  const handleStart = () => {
    if (displaced) {
      setPendingSwitch(true);
    } else {
      doEnroll();
    }
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

  return (
    <Page title={data.program.title}>
      <Link
        to="/programs"
        className="self-start text-xs font-medium text-muted-foreground"
      >
        ← Programs
      </Link>

      <Card>
        <CardContent className="flex flex-col gap-1 pt-2">
          <p className="text-xs text-muted-foreground">
            {data.program.authorName ? `${data.program.authorName} · ` : ''}
            {programCadenceLabel(data.program) ?? 'No sessions yet'}
          </p>
          {data.program.description && (
            <p className="text-sm text-muted-foreground">
              {data.program.description}
            </p>
          )}
        </CardContent>
      </Card>

      {weeks.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Sessions</h2>
          {weeks.map((week) => (
            <div key={week.weekNumber} className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-muted-foreground">
                Week {week.weekNumber}
              </span>
              <Card className="divide-y">
                {week.sessions.map((programSession) => {
                  const { movements, workoutGoal, workoutGoalUnits } =
                    programSession.workoutOptions;
                  const goal = goalLabel(workoutGoal, workoutGoalUnits);
                  const summary = movementsSummary(movements);
                  return (
                    <div
                      key={programSession.id}
                      className="flex flex-col gap-0.5 p-2"
                    >
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="text-sm font-medium">
                          Day {programSession.dayNumber} ·{' '}
                          {programSession.title}
                        </span>
                        {goal && (
                          <span className="text-xs text-muted-foreground">
                            {goal}
                          </span>
                        )}
                      </div>
                      {summary && (
                        <span className="text-xs text-muted-foreground">
                          {summary}
                        </span>
                      )}
                    </div>
                  );
                })}
              </Card>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">Starting weight</h2>
        <p className="text-xs text-muted-foreground">
          Set the weight your working sessions start with. You can still adjust
          it session by session once you&apos;re in the program.
        </p>
        {!seeded && <p className="text-sm text-muted-foreground">Loading…</p>}
        {/* Complex sets share one bell pair for the whole complex, so a single
            picker; every other program gets one control per movement. */}
        {seeded && complex && (
          <WeightSlots
            weight={workingWeight}
            onChange={handleChangeWorkingWeight}
            namePrefix="Starting weight"
          />
        )}
      </div>

      {seeded &&
        !complex &&
        movementControls.map((control) => (
          <div key={control.movementName} className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold">{control.movementName}</h2>
            {control.mode === 'none' ? (
              <p className="text-sm text-muted-foreground">
                {WEIGHT_MODE_LABELS.none}
              </p>
            ) : (
              <WeightSlots
                weight={
                  movementWeights[control.movementName] ?? control.modalWeight
                }
                onChange={(next) =>
                  handleChangeMovementWeight(control.movementName, next)
                }
                namePrefix={control.movementName}
              />
            )}
          </div>
        ))}

      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor="auto-repeat">Repeat automatically</Label>
          <span id="auto-repeat-help" className="text-xs text-muted-foreground">
            When on, finishing the last session starts the program over instead
            of ending it. Progress by adding weight over time.
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

      <Button onClick={handleStart} disabled={enroll.isPending || !seeded}>
        Start program
      </Button>
      <Button
        variant="secondary"
        onClick={queueForLater}
        disabled={enroll.isPending || !seeded}
      >
        Queue for later
      </Button>
      <p className="-mt-1 text-center text-xs text-muted-foreground">
        Queued programs start when an active program finishes.
      </p>

      <Dialog
        open={pendingSwitch}
        onOpenChange={(open) => {
          if (!open) setPendingSwitch(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace a program?</DialogTitle>
            <DialogDescription>
              You&apos;re already running {MAX_ACTIVE_PROGRAMS} programs — the
              most you can have at once. Starting this one stops
              {displaced ? ` ${displaced.program.title}` : ' your oldest one'},
              the program you&apos;ve worked least recently. Its logged workouts
              are kept, but its place in the program is cleared.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPendingSwitch(false)}>
              Cancel
            </Button>
            <Button onClick={doEnroll} disabled={enroll.isPending}>
              Replace program
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
};
