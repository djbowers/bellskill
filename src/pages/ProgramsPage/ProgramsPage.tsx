import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  AnalyticsEvent,
  MAX_ACTIVE_PROGRAMS,
  trackEvent,
  useActivePrograms,
  useCancelProgram,
  useCreateProgram,
  useDeleteProgram,
  useDequeueProgram,
  useEnrollProgram,
  useProgramProgress,
  usePrograms,
  useQueuedPrograms,
  useResumeProgram,
  useSetProgramArchived,
  useStartQueuedProgram,
} from '~/api';
import { Page } from '~/components';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { useSession } from '~/contexts';
import { cn } from '~/lib/utils';
import { Program } from '~/types';
import { programCadenceLabel } from '~/utils';

export const ProgramsPage = () => {
  const navigate = useNavigate();
  const session = useSession();
  const { data: programs = [], isLoading } = usePrograms();
  const { data: activePrograms = [] } = useActivePrograms();
  const userId = session?.user?.id;
  const createProgram = useCreateProgram();
  const enroll = useEnrollProgram();
  const resume = useResumeProgram();
  const cancelProgram = useCancelProgram();
  const deleteProgram = useDeleteProgram();
  const setArchived = useSetProgramArchived();
  const { data: queuedPrograms = [] } = useQueuedPrograms();
  const dequeue = useDequeueProgram();
  const startQueued = useStartQueuedProgram();

  const [showCreate, setShowCreate] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  // Program pending an irreversible hard-delete confirm.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  // Active enrollment pending a cancel confirm (discards in-progress progress).
  // Several programs can be active at once, so this holds which one.
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [title, setTitle] = useState('');

  // Program the user is trying to start with every parallel slot taken, plus
  // the active enrollment they picked to drop for it.
  const [pendingSwitchId, setPendingSwitchId] = useState<string | null>(null);
  const [replaceEnrollmentId, setReplaceEnrollmentId] = useState<string | null>(
    null,
  );
  // Own program a "Start" click is being routed for: we read its progress first
  // to decide between the resume/start-over prompt, the switch prompt, or a
  // direct enroll.
  const [pendingEnrollId, setPendingEnrollId] = useState<string | null>(null);
  // Own program with prior progress, awaiting a resume-vs-start-over choice. We
  // hold the exact enrollment id (not just the program) so resume reactivates
  // the same enrollment whose progress the prompt is showing.
  const [resumeTarget, setResumeTarget] = useState<{
    programId: string;
    userProgramId: string;
  } | null>(null);

  const sharedPrograms = programs.filter((p) => p.isPublic);
  const myPrograms = programs.filter((p) => !p.isPublic);
  // Archived programs are hidden from the default list behind a toggle; live
  // ones (archivedAt null) are always shown.
  const myLivePrograms = myPrograms.filter((p) => !p.archivedAt);
  const myArchivedPrograms = myPrograms.filter((p) => !!p.archivedAt);

  // Prior progress for the program a "Start" click is being routed for. Drives
  // the resume-vs-start-over branch below.
  const { data: candidateProgress, isError: candidateProgressError } =
    useProgramProgress(pendingEnrollId ?? undefined);

  const enrollIn = (programId: string, replaceUserProgramId?: string | null) =>
    enroll.mutate(
      { programId, replaceUserProgramId },
      { onSuccess: () => navigate('/') },
    );

  // Only *active* enrollments consume a parallel slot — a completed program may
  // still be returned by useActivePrograms (to drive the home "complete" card),
  // but it no longer holds a slot.
  const activeEnrollments = activePrograms.filter(
    (p) => p.enrollment.status === 'active',
  );
  const slotsFull = activeEnrollments.length >= MAX_ACTIVE_PROGRAMS;

  // Routes a "Start" click once its prior progress is known: prior progress →
  // resume-vs-start-over prompt; else every slot taken → pick-one-to-replace
  // prompt; else a direct enroll that just claims a free slot.
  const routeEnroll = (programId: string) => {
    const enr = candidateProgress?.enrollment;
    const hasPriorProgress =
      !candidateProgressError &&
      !!enr &&
      enr.status !== 'active' &&
      (candidateProgress?.completedCount ?? 0) > 0;

    if (hasPriorProgress) {
      setResumeTarget({ programId, userProgramId: enr!.id });
    } else if (slotsFull) {
      setReplaceEnrollmentId(activeEnrollments[0].enrollment.id);
      setPendingSwitchId(programId);
    } else {
      enrollIn(programId);
    }
  };

  const handleEnroll = (programId: string) => {
    const program = programs.find((p) => p.id === programId);
    // Only your own program copies can carry prior progress on this same id
    // (shared programs always clone fresh), so only they need the progress read.
    // Key on ownership, not visibility, so routing stays correct even if an own
    // program is ever made public.
    if (program && program.ownerId === userId && !isActive(program)) {
      setPendingEnrollId(programId);
      return;
    }
    if (slotsFull) {
      setReplaceEnrollmentId(activeEnrollments[0].enrollment.id);
      setPendingSwitchId(programId);
    } else {
      enrollIn(programId);
    }
  };

  // Once the routed program's progress resolves (or errors), dispatch it.
  useEffect(() => {
    if (!pendingEnrollId) return;
    const ready =
      candidateProgressError ||
      (candidateProgress && candidateProgress.program.id === pendingEnrollId);
    if (!ready) return;
    const target = pendingEnrollId;
    setPendingEnrollId(null);
    routeEnroll(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispatch once the candidate's progress settles; the routing helpers are derived each render.
  }, [pendingEnrollId, candidateProgress, candidateProgressError]);

  // "Queue instead" from the replace prompt: clone + bake weights now, wait
  // for a slot. The queued row shows up in "Up next" below, so stay here.
  const queueInstead = () => {
    if (!pendingSwitchId) return;
    const target = pendingSwitchId;
    setPendingSwitchId(null);
    setReplaceEnrollmentId(null);
    enroll.mutate({ programId: target, queue: true });
  };

  // The lowest free parallel slot, or null at the cap — gates "Start now" on
  // queued programs and gives the claim its slot.
  const takenSlots = activeEnrollments.map((p) => p.enrollment.activeSlot);
  const freeSlot =
    [1, 2, 3].find((slot) => !takenSlots.includes(slot)) ?? null;

  const confirmSwitch = () => {
    if (!pendingSwitchId || !replaceEnrollmentId) return;
    const target = pendingSwitchId;
    const replaced = replaceEnrollmentId;
    setPendingSwitchId(null);
    setReplaceEnrollmentId(null);
    enrollIn(target, replaced);
  };

  const resumeDialogProgram =
    programs.find((p) => p.id === resumeTarget?.programId) ?? null;

  // A resume needs a free slot too. At the cap the least-recently-worked
  // program is the one it displaces — named in the dialog so the choice is
  // never silent.
  const displacedByResume = slotsFull ? activeEnrollments[0] : null;

  const confirmResume = () => {
    if (!resumeTarget) return;
    const { programId, userProgramId } = resumeTarget;
    setResumeTarget(null);
    resume.mutate(
      {
        userProgramId,
        replaceUserProgramId: displacedByResume?.enrollment.id,
      },
      {
        onSuccess: () => {
          if (userId) {
            void trackEvent({
              event: AnalyticsEvent.ProgramResumed,
              userId,
              properties: { program_id: programId },
            });
          }
          navigate('/');
        },
      },
    );
  };

  const startOverFromResume = () => {
    if (!resumeTarget) return;
    const { programId } = resumeTarget;
    setResumeTarget(null);
    enrollIn(programId, displacedByResume?.enrollment.id);
  };

  const handleCreate = () => {
    if (title.trim().length === 0) return;
    createProgram.mutate(
      { title: title.trim() },
      {
        onSuccess: (program) =>
          navigate(`/programs/${program.id}/sessions/new`),
      },
    );
  };

  const isActive = (program: Program) =>
    activeEnrollments.some((p) => p.enrollment.programId === program.id);

  const isQueued = (program: Program) =>
    queuedPrograms.some((q) => q.enrollment.programId === program.id);

  const enrollmentFor = (program: Program) =>
    activeEnrollments.find((p) => p.enrollment.programId === program.id) ?? null;

  const pendingDeleteProgram =
    programs.find((p) => p.id === pendingDeleteId) ?? null;

  const confirmDelete = () => {
    if (!pendingDeleteId) return;
    const target = pendingDeleteId;
    setPendingDeleteId(null);
    deleteProgram.mutate({ programId: target });
  };

  const pendingCancelProgram =
    activeEnrollments.find((p) => p.enrollment.id === pendingCancelId) ?? null;

  const confirmCancel = () => {
    const target = pendingCancelId;
    setPendingCancelId(null);
    if (!target) return;
    cancelProgram.mutate({ userProgramId: target });
  };

  return (
    <Page title="Programs">
      {sharedPrograms.length > 0 && (
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">Browse programs</h2>
          <Card className="divide-y">
            {sharedPrograms.map((program) => (
              <Link
                key={program.id}
                to={`/programs/${program.id}/details`}
                aria-label={`View ${program.title}`}
                className="flex items-center justify-between gap-2 p-2 hover:bg-secondary"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1 truncate text-sm font-medium">
                    {program.title}
                    {program.defaultAutoRepeat && (
                      <span className="rounded bg-secondary px-0.5 text-xs font-normal text-muted-foreground">
                        Repeats
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {program.authorName ? `${program.authorName} · ` : ''}
                    {programCadenceLabel(program) ?? 'No sessions yet'}
                  </p>
                </div>
                <ChevronRightIcon
                  aria-hidden
                  className="h-2 w-2 shrink-0 text-muted-foreground"
                />
              </Link>
            ))}
          </Card>
        </div>
      )}

      {queuedPrograms.length > 0 && (
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">Up next</h2>
          <Card>
            <CardContent className="flex flex-col pt-2">
              {queuedPrograms.map(({ enrollment, program }, index) => {
                const isFront = index === 0;
                const isLast = index === queuedPrograms.length - 1;
                // Each row names what it waits on: the front of the line waits
                // on a slot, everything behind waits on the row before it.
                const waitsOn = isFront
                  ? freeSlot !== null
                    ? 'A slot is open'
                    : 'Starts when an active program finishes'
                  : `After ${queuedPrograms[index - 1].program.title}`;
                return (
                  <div
                    key={enrollment.id}
                    className={cn('flex gap-1.5', !isLast && 'pb-2')}
                    data-testid="queued-program"
                  >
                    <div className="flex flex-col items-center">
                      <span
                        aria-hidden
                        className={cn(
                          'flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-full border text-xs font-medium',
                          isFront
                            ? 'border-primary text-primary'
                            : 'border-border text-muted-foreground',
                        )}
                      >
                        {index + 1}
                      </span>
                      {!isLast && <span className="w-px flex-1 bg-border" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {program.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {waitsOn}
                      </p>
                    </div>
                    {isFront && freeSlot !== null && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          startQueued.mutate(
                            { userProgramId: enrollment.id, slot: freeSlot },
                            { onSuccess: () => navigate('/') },
                          )
                        }
                        disabled={startQueued.isPending}
                      >
                        Start now
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground"
                      onClick={() =>
                        dequeue.mutate({ userProgramId: enrollment.id })
                      }
                      disabled={dequeue.isPending}
                    >
                      Remove
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">My programs</h2>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setShowCreate((v) => !v)}
        >
          Create program
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-2 pt-2">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="program-title">Title</Label>
              <Input
                id="program-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Dry Fighting Weight"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Weeks and days per week are set by the sessions you add next.
            </p>
            <Button
              onClick={handleCreate}
              disabled={title.trim().length === 0 || createProgram.isPending}
            >
              {createProgram.isPending
                ? 'Creating…'
                : 'Create and add sessions'}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading programs…</p>
      )}

      {!isLoading && myPrograms.length === 0 && (
        <p className="text-sm text-muted-foreground">
          You haven&apos;t created any programs yet.
        </p>
      )}

      {myLivePrograms.map((program) => (
        <Card key={program.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-1">
              <Link to={`/programs/${program.id}`} className="hover:underline">
                {program.title}
              </Link>
              {isActive(program) && (
                <span className="rounded bg-primary px-0.5 text-xs text-primary-foreground">
                  Active
                </span>
              )}
              {isQueued(program) && (
                <span className="rounded bg-secondary px-0.5 text-xs font-normal text-muted-foreground">
                  Queued
                </span>
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {programCadenceLabel(program) ?? 'No sessions yet'}
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => navigate(`/programs/${program.id}/sessions/new`)}
              >
                Add sessions
              </Button>
              <Button
                className="flex-1"
                onClick={() => handleEnroll(program.id)}
                disabled={
                  enroll.isPending ||
                  resume.isPending ||
                  isActive(program) ||
                  // A queued program starts from "Up next" (Start now / its
                  // turn), never a second parallel enrollment from here.
                  isQueued(program) ||
                  pendingEnrollId === program.id
                }
              >
                {isActive(program)
                  ? 'Enrolled'
                  : isQueued(program)
                    ? 'Queued'
                    : 'Start program'}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={() => navigate(`/programs/${program.id}`)}
              >
                View progress
              </Button>
              {!isActive(program) && !isQueued(program) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 text-muted-foreground"
                  onClick={() =>
                    enroll.mutate({ programId: program.id, queue: true })
                  }
                  disabled={enroll.isPending}
                >
                  Queue for later
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {isActive(program) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 text-muted-foreground"
                  onClick={() =>
                    setPendingCancelId(
                      enrollmentFor(program)?.enrollment.id ?? null,
                    )
                  }
                  disabled={cancelProgram.isPending}
                >
                  Cancel
                </Button>
              )}
              {!isActive(program) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 text-muted-foreground"
                  onClick={() =>
                    setArchived.mutate({
                      programId: program.id,
                      archived: true,
                    })
                  }
                  disabled={setArchived.isPending}
                >
                  Archive
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 text-destructive"
                onClick={() => setPendingDeleteId(program.id)}
                disabled={deleteProgram.isPending}
              >
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {myArchivedPrograms.length > 0 && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="self-start text-muted-foreground"
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived
              ? 'Hide archived'
              : `Show archived (${myArchivedPrograms.length})`}
          </Button>

          {showArchived &&
            myArchivedPrograms.map((program) => (
              <Card key={program.id}>
                <CardHeader>
                  <CardTitle className="text-muted-foreground">
                    {program.title}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Archived · {program.numWeeks} weeks · {program.daysPerWeek}
                    /week
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={() =>
                        setArchived.mutate({
                          programId: program.id,
                          archived: false,
                        })
                      }
                      disabled={setArchived.isPending}
                    >
                      Restore
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 text-destructive"
                      onClick={() => setPendingDeleteId(program.id)}
                      disabled={deleteProgram.isPending}
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
        </>
      )}

      <Dialog
        open={pendingSwitchId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingSwitchId(null);
            setReplaceEnrollmentId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace a program?</DialogTitle>
            <DialogDescription>
              You&apos;re already running {MAX_ACTIVE_PROGRAMS} programs — the
              most you can have at once. Pick one to stop so this new one can
              take its place, or queue it to start when one finishes. A
              replaced program&apos;s logged workouts are kept, but its place in
              the program is cleared.
            </DialogDescription>
          </DialogHeader>
          <div
            role="radiogroup"
            aria-label="Program to replace"
            className="flex flex-col gap-0.5"
          >
            {activeEnrollments.map(({ enrollment, program, progress }) => (
              <label
                key={enrollment.id}
                className="flex items-center gap-1 rounded p-1 hover:bg-secondary"
              >
                <input
                  type="radio"
                  name="replace-enrollment"
                  value={enrollment.id}
                  checked={replaceEnrollmentId === enrollment.id}
                  onChange={() => setReplaceEnrollmentId(enrollment.id)}
                />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {program.title}
                </span>
                <span className="text-xs text-muted-foreground">
                  {progress.completed}/{progress.total}
                </span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setPendingSwitchId(null);
                setReplaceEnrollmentId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={queueInstead}
              disabled={enroll.isPending}
            >
              Queue instead
            </Button>
            <Button
              onClick={confirmSwitch}
              disabled={enroll.isPending || !replaceEnrollmentId}
            >
              Replace program
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={resumeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setResumeTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resume this program?</DialogTitle>
            <DialogDescription>
              You already have progress in
              {resumeDialogProgram ? ` "${resumeDialogProgram.title}"` : ''}.
              Pick up where you left off, or start over from the first session.
              {displacedByResume
                ? ` You're at ${MAX_ACTIVE_PROGRAMS} programs, so either way this replaces ${displacedByResume.program.title}.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={startOverFromResume}
              disabled={enroll.isPending || resume.isPending}
            >
              Start over
            </Button>
            <Button
              onClick={confirmResume}
              disabled={enroll.isPending || resume.isPending}
            >
              Resume
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingCancelId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingCancelId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel program?</DialogTitle>
            <DialogDescription>
              This stops
              {pendingCancelProgram
                ? ` ${pendingCancelProgram.program.title}`
                : ' this program'}
              . Your logged workouts are kept, but your place in the program is
              cleared — restarting begins from the first session.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setPendingCancelId(null)}
            >
              Keep going
            </Button>
            <Button
              variant="destructive"
              onClick={confirmCancel}
              disabled={cancelProgram.isPending}
            >
              Cancel program
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete program?</DialogTitle>
            <DialogDescription>
              This permanently deletes
              {pendingDeleteProgram ? ` "${pendingDeleteProgram.title}"` : ''},
              its sessions, and its history. This can&apos;t be undone
              {pendingDeleteProgram?.archivedAt
                ? '.'
                : ' — archive it instead if you just want it out of the way.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setPendingDeleteId(null)}
            >
              Keep program
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteProgram.isPending}
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
};
