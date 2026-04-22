import { ArrowRightIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  useDeleteWorkoutLog,
  useMovementLogs,
  useSelectRPE,
  useUpdateWorkoutNotes,
  useWorkoutLog,
} from '~/api';
import { Loading, Page } from '~/components';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
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

import { Section } from '../StartWorkoutPage/components';
import { RPESelector, WorkoutHistoryItem } from './components';

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

  useEffect(() => {
    if (deletedWorkoutLogId) navigate('/history');
  }, [deletedWorkoutLogId]);

  if (workoutLogLoading) return <Loading />;
  if (!workoutLog) return <>Not Found</>;

  const handleClickContinue = () => navigate('/history');

  const handleClickDelete = () => deleteWorkoutLog();

  const handleSelectRPE = (selectedRPE: WorkoutLog['rpe']) =>
    selectRPE(selectedRPE);

  const handleAddNotes = () => updateWorkoutNotes('');
  const handleClearNotes = () => updateWorkoutNotes(null);
  const handleBlurNotes = () =>
    updateWorkoutNotes(notesRef.current?.value || null);

  const handleClickRepeat = () => {
    // Calculate actual completed duration in minutes
    const completedDurationMs =
      workoutLog.completedAt.getTime() - workoutLog.startedAt.getTime();
    const completedDurationMinutes = Math.round(completedDurationMs / 60000);

    // Use actual completed values for all unit types
    const previousMinutes = completedDurationMinutes;
    const previousRounds = workoutLog.completedRounds ?? 0;
    const previousVolume = workoutLog.completedVolume ?? 0;

    // Determine workoutGoal and workoutGoalUnits based on original workout
    let workoutGoal: number = workoutLog.workoutGoal;
    let workoutGoalUnits: WorkoutGoalUnits = workoutLog.workoutGoalUnits;

    updateWorkoutOptions({
      complexSet: false,
      intervalTimer: workoutLog.intervalTimer,
      movements: movementLogs.map((movementLog) => ({
        movementName: movementLog.movementName,
        repScheme: movementLog.repScheme,
        weightOneUnit: movementLog.weightOneUnit,
        weightOneValue: movementLog.weightOneValue,
        weightTwoUnit: movementLog.weightTwoUnit,
        weightTwoValue: movementLog.weightTwoValue,
      })),
      restTimer: workoutLog.restTimer,
      sharedWeightOneUnit: null,
      sharedWeightOneValue: null,
      sharedWeightTwoUnit: null,
      sharedWeightTwoValue: null,
      workoutDetails: workoutLog.workoutDetails,
      workoutGoal,
      workoutGoalUnits,
      previousVolume,
      previousMinutes,
      previousRounds,
    });
    navigate('/');
  };

  return (
    <Dialog>
      <Page
        title="Workout Log"
        actions={
          <div className="flex flex-col items-center gap-1">
            <div className="grid grid-cols-3 gap-1">
              <Button variant="ghost" onClick={handleClickRepeat}>
                Repeat
              </Button>
              <Button
                onClick={handleClickContinue}
                className="flex items-center gap-0.5"
              >
                Continue
                <ArrowRightIcon className="h-2 w-2" />
              </Button>
              {workoutLog.workoutNotes === null && (
                <Button variant="ghost" onClick={handleAddNotes}>
                  Add Notes
                </Button>
              )}
            </div>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-0.5 text-red-500"
              >
                Delete <TrashIcon className="h-2.5 w-2.5" />
              </Button>
            </DialogTrigger>
          </div>
        }
      >
        <WorkoutHistoryItem
          completedAt={workoutLog.completedAt}
          completedReps={workoutLog.completedReps}
          completedRounds={workoutLog.completedRounds}
          completedRungs={workoutLog.completedRungs}
          completedVolume={workoutLog.completedVolume ?? 0}
          intervalTimer={workoutLog.intervalTimer}
          movementLogs={movementLogs}
          movementLogsLoading={movementLogsLoading}
          restTimer={workoutLog.restTimer}
          startedAt={workoutLog.startedAt}
          workoutDetails={workoutLog.workoutDetails}
          workoutGoal={workoutLog.workoutGoal}
          workoutGoalUnits={workoutLog.workoutGoalUnits}
        />

        <RPESelector onSelectRPE={handleSelectRPE} rpeValue={workoutLog.rpe} />

        {workoutLog.workoutNotes !== null && (
          <Card>
            <Section
              title="Workout Notes"
              actions={
                workoutLog.workoutNotes?.length > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleClearNotes}
                  >
                    Clear Notes
                  </Button>
                )
              }
            >
              <Textarea
                aria-label="Workout Notes"
                className="w-full"
                defaultValue={workoutLog.workoutNotes}
                onBlur={handleBlurNotes}
                ref={notesRef}
              />
            </Section>
          </Card>
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
