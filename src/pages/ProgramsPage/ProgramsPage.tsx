import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
import { isOwner } from '~/config/features';
import { useSession } from '~/contexts';
import { Program } from '~/types';

import {
  ArchivedProgramCard,
  BrowseProgramsSection,
  ConfirmDialog,
  CreateProgramForm,
  MyProgramCard,
  QueueTimeline,
  ReplaceProgramDialog,
  ResumeProgramDialog,
} from './components';
import { myProgramCardSortWeight, myProgramCardState } from './utils';

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
  // Null until the user touches the disclosure, so the default can follow from
  // whether they have any programs of their own (resolved below).
  const [browseOpen, setBrowseOpen] = useState<boolean | null>(null);
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
  const freeSlot = [1, 2, 3].find((slot) => !takenSlots.includes(slot)) ?? null;

  const confirmSwitch = () => {
    if (!pendingSwitchId || !replaceEnrollmentId) return;
    const target = pendingSwitchId;
    const replaced = replaceEnrollmentId;
    setPendingSwitchId(null);
    setReplaceEnrollmentId(null);
    enrollIn(target, replaced);
  };

  const dismissSwitch = () => {
    setPendingSwitchId(null);
    setReplaceEnrollmentId(null);
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

  // What's running comes first, then what's queued, then what you could start
  // today, then the drafts still being built.
  const sortedLivePrograms = [...myLivePrograms].sort(
    (a, b) =>
      myProgramCardSortWeight(
        myProgramCardState(a, { isActive: isActive(a), isQueued: isQueued(a) }),
      ) -
      myProgramCardSortWeight(
        myProgramCardState(b, { isActive: isActive(b), isQueued: isQueued(b) }),
      ),
  );

  // The catalog stays folded for anyone with programs of their own; a user with
  // none gets it open, because then it's the only thing on the page worth
  // doing. An explicit toggle always wins over both.
  const isBrowseOpen = browseOpen ?? (!isLoading && myPrograms.length === 0);

  return (
    <Page title="Programs">
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
        <CreateProgramForm
          title={title}
          onTitleChange={setTitle}
          onCreate={handleCreate}
          isPending={createProgram.isPending}
        />
      )}

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading programs…</p>
      )}

      {!isLoading && myPrograms.length === 0 && (
        <p className="text-sm text-muted-foreground">
          You haven&apos;t created any programs yet. Start from a ready-made
          plan below, or build your own.
        </p>
      )}

      {sortedLivePrograms.map((program) => (
        <MyProgramCard
          key={program.id}
          program={program}
          isActive={isActive(program)}
          isQueued={isQueued(program)}
          isStarting={pendingEnrollId === program.id}
          pending={{
            enroll: enroll.isPending,
            resume: resume.isPending,
            cancel: cancelProgram.isPending,
            archive: setArchived.isPending,
            delete: deleteProgram.isPending,
          }}
          onStart={() => handleEnroll(program.id)}
          onAddSessions={() =>
            navigate(`/programs/${program.id}/sessions/new`)
          }
          onViewProgress={() => navigate(`/programs/${program.id}`)}
          onQueueForLater={() =>
            enroll.mutate({ programId: program.id, queue: true })
          }
          onCancel={() =>
            setPendingCancelId(enrollmentFor(program)?.enrollment.id ?? null)
          }
          onArchive={() =>
            setArchived.mutate({ programId: program.id, archived: true })
          }
          onDelete={() => setPendingDeleteId(program.id)}
        />
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
              <ArchivedProgramCard
                key={program.id}
                program={program}
                pending={{
                  archive: setArchived.isPending,
                  delete: deleteProgram.isPending,
                }}
                onRestore={() =>
                  setArchived.mutate({
                    programId: program.id,
                    archived: false,
                  })
                }
                onDelete={() => setPendingDeleteId(program.id)}
              />
            ))}
        </>
      )}

      {queuedPrograms.length > 0 && (
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">Up next</h2>
          <QueueTimeline
            queuedPrograms={queuedPrograms}
            freeSlot={freeSlot}
            pending={{
              start: startQueued.isPending,
              remove: dequeue.isPending,
            }}
            onStartNow={(userProgramId, slot) =>
              startQueued.mutate(
                { userProgramId, slot },
                { onSuccess: () => navigate('/') },
              )
            }
            onRemove={(userProgramId) => dequeue.mutate({ userProgramId })}
          />
        </div>
      )}

      {sharedPrograms.length > 0 && (
        <BrowseProgramsSection
          programs={sharedPrograms}
          open={isBrowseOpen}
          onOpenChange={setBrowseOpen}
          showReleasedBadge={isOwner(session)}
        />
      )}

      <ReplaceProgramDialog
        open={pendingSwitchId !== null}
        onOpenChange={(open) => {
          if (!open) dismissSwitch();
        }}
        activeEnrollments={activeEnrollments}
        replaceEnrollmentId={replaceEnrollmentId}
        onSelectReplace={setReplaceEnrollmentId}
        onCancel={dismissSwitch}
        onQueueInstead={queueInstead}
        onConfirm={confirmSwitch}
        isPending={enroll.isPending}
      />

      <ResumeProgramDialog
        open={resumeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setResumeTarget(null);
        }}
        program={resumeDialogProgram}
        displacedByResume={displacedByResume}
        onResume={confirmResume}
        onStartOver={startOverFromResume}
        isPending={enroll.isPending || resume.isPending}
      />

      <ConfirmDialog
        open={pendingCancelId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingCancelId(null);
        }}
        title="Cancel program?"
        description={
          <>
            This stops
            {pendingCancelProgram
              ? ` ${pendingCancelProgram.program.title}`
              : ' this program'}
            . Your logged workouts are kept, but your place in the program is
            cleared — restarting begins from the first session.
          </>
        }
        confirmLabel="Cancel program"
        confirmVariant="destructive"
        dismissLabel="Keep going"
        onConfirm={confirmCancel}
        onDismiss={() => setPendingCancelId(null)}
        isPending={cancelProgram.isPending}
      />

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
        title="Delete program?"
        description={
          <>
            This permanently deletes
            {pendingDeleteProgram ? ` "${pendingDeleteProgram.title}"` : ''},
            its sessions, and its history. This can&apos;t be undone
            {pendingDeleteProgram?.archivedAt
              ? '.'
              : ' — archive it instead if you just want it out of the way.'}
          </>
        }
        confirmLabel="Delete permanently"
        confirmVariant="destructive"
        dismissLabel="Keep program"
        onConfirm={confirmDelete}
        onDismiss={() => setPendingDeleteId(null)}
        isPending={deleteProgram.isPending}
      />
    </Page>
  );
};
