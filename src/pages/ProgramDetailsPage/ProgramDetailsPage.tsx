import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useActiveProgram, useEnrollProgram, useProgram } from '~/api';
import { ModifyCountButtons, Page, WeightUnitTabs } from '~/components';
import { WeightModeTabs } from '~/components/MovementAutocomplete';
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
import { useSession } from '~/contexts';
import {
  MovementOptions,
  Program,
  ProgramSession,
  WeightUnit,
  WorkoutGoalUnits,
} from '~/types';
import { getWeightTabValue, getWeightUnitLabel } from '~/utils';

import { deriveStartingWeight } from './utils/deriveStartingWeight';

// Fallback weight/unit for the mode-switch handlers (when the user adds a
// previously-null slot). The picker's initial pre-fill is derived per-program
// from the program's own sessions — see deriveStartingWeight.
const DEFAULT_STARTING_WEIGHT_VALUE = 24;
const DEFAULT_WEIGHT_UNIT: WeightUnit = 'kilograms';

const cadenceLabel = (program: Program): string | null =>
  program.numWeeks && program.daysPerWeek
    ? `${program.numWeeks} weeks · ${program.daysPerWeek}/week`
    : null;

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
  const { data: activeProgram } = useActiveProgram();
  const enroll = useEnrollProgram();

  const [seeded, setSeeded] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState(false);
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

  const program = data?.program;
  const sessions = data?.sessions;
  const userId = session?.user?.id;
  // This route is for shared programs you don't own; redirect an own-program
  // deep link to its progress page instead of showing a starting-weight picker
  // for a program you already configured in the builder.
  const isOwnProgram = !!program && program.ownerId === userId;

  useEffect(() => {
    if (!sessions || seeded) return;
    const derived = deriveStartingWeight(sessions);
    setSharedWeightOneValue(derived.sharedWeightOneValue);
    setSharedWeightOneUnit(derived.sharedWeightOneUnit);
    setSharedWeightTwoValue(derived.sharedWeightTwoValue);
    setSharedWeightTwoUnit(derived.sharedWeightTwoUnit);
    setSeeded(true);
  }, [sessions, seeded]);

  useEffect(() => {
    if (isOwnProgram && id) navigate(`/programs/${id}`, { replace: true });
  }, [isOwnProgram, id, navigate]);

  const sharedWeightTabValue = getWeightTabValue({
    weightOneValue: sharedWeightOneValue,
    weightTwoValue: sharedWeightTwoValue,
  });

  const handleChangeSharedWeightTab = (value: string) => {
    setSharedWeightOneValue(
      value === 'none'
        ? null
        : sharedWeightOneValue || DEFAULT_STARTING_WEIGHT_VALUE,
    );
    setSharedWeightOneUnit(
      value === 'none' ? null : sharedWeightOneUnit || DEFAULT_WEIGHT_UNIT,
    );
    setSharedWeightTwoValue(
      value === 'double'
        ? sharedWeightTwoValue || DEFAULT_STARTING_WEIGHT_VALUE
        : value === '1h'
          ? 0
          : null,
    );
    setSharedWeightTwoUnit(
      value === 'double' ? sharedWeightTwoUnit || DEFAULT_WEIGHT_UNIT : null,
    );
  };

  const handleChangeSharedWeightOneValue = (value: number) =>
    setSharedWeightOneValue(Math.max(1, value));

  const handleChangeSharedWeightTwoValue = (value: number) =>
    setSharedWeightTwoValue(Math.max(1, value));

  // Only an *active* enrollment blocks a fresh enroll — a completed program may
  // still be returned by useActiveProgram (to drive the home "complete" card).
  const activeEnrollment =
    activeProgram?.enrollment.status === 'active' ? activeProgram : null;

  const doEnroll = () => {
    if (!id) return;
    setPendingSwitch(false);
    enroll.mutate(
      {
        programId: id,
        sharedWeightOneValue,
        sharedWeightOneUnit,
        sharedWeightTwoValue,
        sharedWeightTwoUnit,
      },
      { onSuccess: () => navigate('/') },
    );
  };

  const handleStart = () => {
    if (activeEnrollment && activeEnrollment.enrollment.programId !== id) {
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
            {cadenceLabel(data.program) ?? 'No sessions yet'}
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
        {seeded && (
          <WeightModeTabs
            value={sharedWeightTabValue}
            onValueChange={handleChangeSharedWeightTab}
            hideNone
          />
        )}
        {seeded && sharedWeightOneValue !== null && (
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
                onChange={setSharedWeightOneUnit}
              />
            }
            value={sharedWeightOneValue}
            onChange={handleChangeSharedWeightOneValue}
          />
        )}
        {seeded &&
          sharedWeightTwoValue !== null &&
          sharedWeightTwoValue > 0 && (
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
                  onChange={setSharedWeightTwoUnit}
                />
              }
              value={sharedWeightTwoValue}
              onChange={handleChangeSharedWeightTwoValue}
            />
          )}
      </div>

      <Button onClick={handleStart} disabled={enroll.isLoading || !seeded}>
        Start program
      </Button>

      <Dialog
        open={pendingSwitch}
        onOpenChange={(open) => {
          if (!open) setPendingSwitch(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Switch program?</DialogTitle>
            <DialogDescription>
              You already have an active program
              {activeEnrollment ? ` (${activeEnrollment.program.title})` : ''}.
              Starting a new one abandons your current progress.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPendingSwitch(false)}>
              Cancel
            </Button>
            <Button onClick={doEnroll} disabled={enroll.isLoading}>
              Switch program
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
};
