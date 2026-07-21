import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  AnalyticsEvent,
  trackEvent,
  useActiveProgram,
  useCancelProgram,
  useCreateProgram,
  useDeleteProgram,
  useEnrollProgram,
  useProgramProgress,
  usePrograms,
  useResumeProgram,
  useSetProgramArchived,
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
import { Program } from '~/types';

// "5 weeks · 3/week" from the program's derived cadence, or null before any
// session gives it one (see Program.numWeeks — derived from the sessions).
const cadenceLabel = (program: Program): string | null =>
  program.numWeeks && program.daysPerWeek
    ? `${program.numWeeks} weeks · ${program.daysPerWeek}/week`
    : null;

export const ProgramsPage = () => {
  const navigate = useNavigate();
  const session = useSession();
  const { data: programs = [], isLoading } = usePrograms();
  const { data: activeProgram } = useActiveProgram();
  const userId = session?.user?.id;
  const createProgram = useCreateProgram();
  const enroll = useEnrollProgram();
  const resume = useResumeProgram();
  const cancelProgram = useCancelProgram();
  const deleteProgram = useDeleteProgram();
  const setArchived = useSetProgramArchived();

  const [showCreate, setShowCreate] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  // Program pending an irreversible hard-delete confirm.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  // Active enrollment pending a cancel confirm (discards in-progress progress).
  const [pendingCancel, setPendingCancel] = useState<boolean>(false);
  const [title, setTitle] = useState('');

  // Program the user is trying to switch to while another is already active.
  const [pendingSwitchId, setPendingSwitchId] = useState<string | null>(null);
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

  const enrollIn = (programId: string) =>
    enroll.mutate({ programId }, { onSuccess: () => navigate('/') });

  // Only an *active* enrollment blocks a fresh enroll — a completed program may
  // still be returned by useActiveProgram (to drive the home "complete" card),
  // but starting a new program then needs no "switch?" confirmation.
  const activeEnrollment =
    activeProgram?.enrollment.status === 'active' ? activeProgram : null;

  // Routes a "Start" click once its prior progress is known: prior progress →
  // resume-vs-start-over prompt; else an active program on a different program →
  // switch prompt; else a direct enroll.
  const routeEnroll = (programId: string) => {
    const enr = candidateProgress?.enrollment;
    const hasPriorProgress =
      !candidateProgressError &&
      !!enr &&
      enr.status !== 'active' &&
      (candidateProgress?.completedCount ?? 0) > 0;

    if (hasPriorProgress) {
      setResumeTarget({ programId, userProgramId: enr!.id });
    } else if (
      activeEnrollment &&
      activeEnrollment.enrollment.programId !== programId
    ) {
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
    if (
      activeEnrollment &&
      activeEnrollment.enrollment.programId !== programId
    ) {
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

  const confirmSwitch = () => {
    if (!pendingSwitchId) return;
    const target = pendingSwitchId;
    setPendingSwitchId(null);
    enrollIn(target);
  };

  const resumeDialogProgram =
    programs.find((p) => p.id === resumeTarget?.programId) ?? null;

  const confirmResume = () => {
    if (!resumeTarget) return;
    const { programId, userProgramId } = resumeTarget;
    setResumeTarget(null);
    resume.mutate(
      { userProgramId },
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
    enrollIn(programId);
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
    activeEnrollment?.enrollment.programId === program.id;

  const pendingDeleteProgram =
    programs.find((p) => p.id === pendingDeleteId) ?? null;

  const confirmDelete = () => {
    if (!pendingDeleteId) return;
    const target = pendingDeleteId;
    setPendingDeleteId(null);
    deleteProgram.mutate({ programId: target });
  };

  const confirmCancel = () => {
    setPendingCancel(false);
    if (!activeEnrollment) return;
    cancelProgram.mutate({ userProgramId: activeEnrollment.enrollment.id });
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
                  <p className="truncate text-sm font-medium">
                    {program.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {program.authorName ? `${program.authorName} · ` : ''}
                    {cadenceLabel(program) ?? 'No sessions yet'}
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
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {cadenceLabel(program) ?? 'No sessions yet'}
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
                  pendingEnrollId === program.id
                }
              >
                {isActive(program) ? 'Enrolled' : 'Start program'}
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/programs/${program.id}`)}
            >
              View progress
            </Button>
            <div className="flex gap-2">
              {isActive(program) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 text-muted-foreground"
                  onClick={() => setPendingCancel(true)}
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
          if (!open) setPendingSwitchId(null);
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
            <Button
              variant="secondary"
              onClick={() => setPendingSwitchId(null)}
            >
              Cancel
            </Button>
            <Button onClick={confirmSwitch} disabled={enroll.isPending}>
              Switch program
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
              {activeEnrollment &&
              resumeTarget &&
              activeEnrollment.enrollment.programId !== resumeTarget.programId
                ? ` Either way, this replaces your active program (${activeEnrollment.program.title}).`
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
        open={pendingCancel}
        onOpenChange={(open) => {
          if (!open) setPendingCancel(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel program?</DialogTitle>
            <DialogDescription>
              This stops your active program
              {activeEnrollment ? ` (${activeEnrollment.program.title})` : ''}.
              Your logged workouts are kept, but your place in the program is
              cleared — restarting begins from the first session.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPendingCancel(false)}>
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
