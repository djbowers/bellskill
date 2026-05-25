import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  useDeleteWorkoutLog,
  useMovementLogs,
  useSelectRPE,
  useUpdateWorkoutNotes,
  useWorkoutLog,
} from '~/api';
import { Loading, Page } from '~/components';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import { Textarea } from '~/components/ui/textarea';
import { useWorkoutOptions } from '~/contexts';
import { WorkoutGoalUnits, WorkoutLog } from '~/types';

import { RPESelector, WorkoutHistoryItem } from './components';
import { getShortDateAndStartTime, resolveSharedWeights } from './utils';

export const CompletedWorkoutPage = () => {
  const { id = '' } = useParams<{ id: string }>();

  const navigate = useNavigate();

  const [, updateWorkoutOptions] = useWorkoutOptions();

  const { data: workoutLog, isLoading: workoutLogLoading } = useWorkoutLog(id);
  const { data: movementLogs = [], isLoading: movementLogsLoading } =
    useMovementLogs(id);

  const {
    mutate: deleteWorkoutLog,
    data: deletedWorkoutLogId,
    isLoading: isDeletingWorkoutLog,
  } = useDeleteWorkoutLog(id);
  const { mutate: selectRPE } = useSelectRPE(id);
  const { mutate: updateWorkoutNotes } = useUpdateWorkoutNotes(id);

  const notesRef = useRef<HTMLTextAreaElement>(null);
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    if (workoutLog) {
      setShowNotes(workoutLog.workoutNotes !== null);
    }
  }, [workoutLog?.id, workoutLog?.workoutNotes]);

  useEffect(() => {
    if (deletedWorkoutLogId) navigate('/history');
  }, [deletedWorkoutLogId, navigate]);

  if (workoutLogLoading) return <Loading />;
  if (!workoutLog) return <>Not Found</>;

  const handleClickContinue = () => navigate('/history');

  const handleClickDelete = () => deleteWorkoutLog();

  const handleSelectRPE = (selectedRPE: WorkoutLog['rpe']) =>
    selectRPE(selectedRPE);

  const handleAddNotes = () => updateWorkoutNotes('');
  const handleBlurNotes = () =>
    updateWorkoutNotes(notesRef.current?.value || null);

  const handleClickNotes = () => {
    if (workoutLog.workoutNotes === null) {
      handleAddNotes();
      setShowNotes(true);
      return;
    }
    setShowNotes((prev) => !prev);
  };

  const handleClickRepeat = () => {
    const completedDurationMs =
      workoutLog.completedAt.getTime() - workoutLog.startedAt.getTime();
    const completedDurationMinutes = Math.round(completedDurationMs / 60000);

    const previousMinutes = completedDurationMinutes;
    const previousRounds = workoutLog.completedRounds ?? 0;
    const previousVolume =
      workoutLog.workoutGoalUnits === 'kilograms' && workoutLog.completedVolume
        ? workoutLog.completedVolume
        : undefined;

    const workoutGoal: number = workoutLog.workoutGoal;
    const workoutGoalUnits: WorkoutGoalUnits = workoutLog.workoutGoalUnits;

    const isComplexSet = workoutLog.complexSet === true;
    const sharedWeights = resolveSharedWeights(
      workoutLog.sharedWeightOneValue,
      workoutLog.sharedWeightOneUnit,
      workoutLog.sharedWeightTwoValue,
      workoutLog.sharedWeightTwoUnit,
      movementLogs,
    );

    updateWorkoutOptions({
      complexSet: isComplexSet,
      intervalTimer: workoutLog.intervalTimer,
      movements: movementLogs.map((movementLog) => ({
        movementName: movementLog.movementName,
        repScheme: movementLog.repScheme,
        weightOneUnit: isComplexSet
          ? sharedWeights.weightOneUnit
          : movementLog.weightOneUnit,
        weightOneValue: isComplexSet
          ? sharedWeights.weightOneValue
          : movementLog.weightOneValue,
        weightTwoUnit: isComplexSet
          ? sharedWeights.weightTwoUnit
          : movementLog.weightTwoUnit,
        weightTwoValue: isComplexSet
          ? sharedWeights.weightTwoValue
          : movementLog.weightTwoValue,
      })),
      restTimer: workoutLog.restTimer,
      sharedWeightOneUnit: isComplexSet ? sharedWeights.weightOneUnit : null,
      sharedWeightOneValue: isComplexSet ? sharedWeights.weightOneValue : null,
      sharedWeightTwoUnit: isComplexSet ? sharedWeights.weightTwoUnit : null,
      sharedWeightTwoValue: isComplexSet ? sharedWeights.weightTwoValue : null,
      workoutDetails: workoutLog.workoutDetails,
      workoutGoal,
      workoutGoalUnits,
      previousVolume,
      previousMinutes,
      previousRounds,
    });
    navigate('/');
  };

  const isComplexSet = workoutLog.complexSet === true;
  const headerDateTime = getShortDateAndStartTime(workoutLog.startedAt);

  return (
    <Dialog>
      <Page
        actions={
          <div className="flex w-full flex-col items-center gap-1">
            <div className="grid w-full grid-cols-3 gap-1">
              <Button variant="ghost" onClick={handleClickRepeat}>
                Repeat
              </Button>
              <Button
                onClick={handleClickContinue}
                className="flex items-center justify-center gap-0.5"
              >
                Continue
                <ArrowRightIcon className="h-2 w-2" />
              </Button>
              <Button variant="ghost" onClick={handleClickNotes}>
                Notes
              </Button>
            </div>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-red-500 hover:text-red-600"
              >
                Delete
              </Button>
            </DialogTrigger>
          </div>
        }
      >
        <header className="border-b border-border pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              {/* TODO: prepend workout number when backend exposes it (e.g. NO. 143) */}
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Workout
              </span>
              {isComplexSet && (
                <Badge variant="secondary" className="w-fit text-xs uppercase">
                  Complex
                </Badge>
              )}
            </div>
            <time
              className="text-xs text-muted-foreground"
              dateTime={workoutLog.startedAt.toISOString()}
            >
              {headerDateTime}
            </time>
          </div>
        </header>

        <WorkoutHistoryItem
          completedAt={workoutLog.completedAt}
          completedReps={workoutLog.completedReps}
          completedRounds={workoutLog.completedRounds}
          completedRungs={workoutLog.completedRungs}
          completedVolume={workoutLog.completedVolume ?? 0}
          complexSet={workoutLog.complexSet}
          intervalTimer={workoutLog.intervalTimer}
          movementLogs={movementLogs}
          movementLogsLoading={movementLogsLoading}
          restTimer={workoutLog.restTimer}
          sharedWeightOneUnit={workoutLog.sharedWeightOneUnit}
          sharedWeightOneValue={workoutLog.sharedWeightOneValue}
          sharedWeightTwoUnit={workoutLog.sharedWeightTwoUnit}
          sharedWeightTwoValue={workoutLog.sharedWeightTwoValue}
          startedAt={workoutLog.startedAt}
          workoutDetails={workoutLog.workoutDetails}
          workoutGoal={workoutLog.workoutGoal}
          workoutGoalUnits={workoutLog.workoutGoalUnits}
          workoutLogId={workoutLog.id}
        />

        <RPESelector onSelectRPE={handleSelectRPE} rpeValue={workoutLog.rpe} />

        {showNotes && workoutLog.workoutNotes !== null && (
          <Textarea
            aria-label="Workout Notes"
            className="w-full"
            defaultValue={workoutLog.workoutNotes}
            onBlur={handleBlurNotes}
            ref={notesRef}
          />
        )}
      </Page>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete this
            workout log.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            onClick={handleClickDelete}
            variant="destructive"
            loading={isDeletingWorkoutLog}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
