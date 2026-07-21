import { ArrowRightIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

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
import { WorkoutLog } from '~/types';
import { workoutLogToWorkoutOptions } from '~/utils';

import { Section } from '../StartWorkoutPage/components';
import { RPESelector, WorkoutHistoryItem } from './components';
import { getDuration } from './utils';

export const CompletedWorkoutPage = () => {
  const { id = '' } = useParams<{ id: string }>();

  const navigate = useNavigate();

  // The active workout navigates here with `justFinished` so the page can
  // celebrate the session; visiting from history renders the archival view.
  const location = useLocation();
  const justFinished = Boolean(
    (location.state as { justFinished?: boolean } | null)?.justFinished,
  );

  const [, updateWorkoutOptions] = useWorkoutOptions();

  const { data: workoutLog, isLoading: workoutLogLoading } = useWorkoutLog(id);
  const { data: movementLogs = [], isLoading: movementLogsLoading } =
    useMovementLogs(id);

  const {
    mutate: deleteWorkoutLog,
    data: deletedWorkoutLogId,
    isPending: isDeletingWorkoutLog,
  } = useDeleteWorkoutLog(id);
  const { mutate: selectRPE } = useSelectRPE(id);
  const { mutate: updateWorkoutNotes } = useUpdateWorkoutNotes(id);

  const notesRef = useRef<HTMLTextAreaElement>(null);

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
  const handleClearNotes = () => updateWorkoutNotes(null);
  const handleBlurNotes = () =>
    updateWorkoutNotes(notesRef.current?.value || null);

  const handleClickRepeat = () => {
    // Prefill the builder (not /active) so the user can review and adjust
    // before starting; `editWorkout` makes the Start page skip browse mode.
    updateWorkoutOptions(workoutLogToWorkoutOptions(workoutLog, movementLogs));
    navigate('/', { state: { editWorkout: true } });
  };

  return (
    <Dialog>
      <Page
        title={justFinished ? 'Workout complete' : 'Workout Log'}
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
            {!justFinished && (
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-0.5 text-red-500"
                >
                  Delete <TrashIcon className="h-2.5 w-2.5" />
                </Button>
              </DialogTrigger>
            )}
          </div>
        }
      >
        <HeadlineStats workoutLog={workoutLog} />

        <RPESelector onSelectRPE={handleSelectRPE} rpeValue={workoutLog.rpe} />

        <WorkoutHistoryItem
          completedAt={workoutLog.completedAt}
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

// The outcome of the session, front and center: what you did, not how it was
// configured. Volume is omitted for bodyweight-only sessions where it's zero.
const HeadlineStats = ({ workoutLog }: { workoutLog: WorkoutLog }) => {
  const duration = getDuration(workoutLog.startedAt, workoutLog.completedAt);
  const volume = workoutLog.completedVolume ?? 0;

  return (
    <div
      className="flex items-center justify-between rounded-md bg-accent px-2 py-1 text-accent-foreground"
      data-testid="headline-stats"
    >
      <HeadlineStat label="Elapsed" value={duration} align="left" />
      <HeadlineStat label="Rounds" value={workoutLog.completedRounds} />
      <HeadlineStat label="Reps" value={workoutLog.completedReps} />
      {volume > 0 && <HeadlineStat label="Volume" value={volume} unit="kg" />}
    </div>
  );
};

const HeadlineStat = ({
  label,
  value,
  unit,
  align = 'right',
}: {
  label: string;
  value: string | number;
  unit?: string;
  align?: 'left' | 'right';
}) => (
  <div
    className={
      align === 'left'
        ? 'flex flex-col items-start gap-0.5'
        : 'flex flex-col items-end gap-0.5'
    }
  >
    <div className="text-sm text-muted-foreground">{label}</div>
    <div className="text-lg font-semibold">
      {value}
      {unit && (
        <span className="text-sm font-medium text-muted-foreground">
          {' '}
          {unit}
        </span>
      )}
    </div>
  </div>
);
