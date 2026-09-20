import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  useDeleteProgramSession,
  useDeleteProgramWeek,
  useDuplicateProgramSession,
  useDuplicateProgramWeek,
  useProgram,
  useSaveProgramSession,
  useSetProgramSessionLayout,
  useUpdateProgramSession,
  useUpdateProgramSessionsForward,
} from '~/api';
import { ConfirmDialog, OverflowMenuAction, Page } from '~/components';
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
import { useSession, useToast } from '~/contexts';
import { ProgramSession, WorkoutOptions } from '~/types';

import { StartWorkoutPage } from '../StartWorkoutPage';
import { SessionWeekList } from './components';
import {
  WeekGroup,
  flattenLayout,
  groupByWeek,
  isSameLayout,
  layoutOf,
  moveWeek,
  nextSlotInWeek,
  trailingEmptyWeekCount,
  withEmptyWeeks,
} from './utils';

/**
 * Renders the builder in "save session" mode for a program. The builder itself
 * (goal, movements, rep schemes, weights) is reused verbatim from
 * {@link StartWorkoutPage}; this wrapper owns program data, every session and
 * week mutation, and the week-grouped list the builder opens from.
 */
export const ProgramSessionBuilderPage = () => {
  const { id, sessionId } = useParams<{ id: string; sessionId?: string }>();
  const navigate = useNavigate();
  const session = useSession();
  const { showToast } = useToast();
  const { data, isLoading, isError } = useProgram(id);
  const saveSession = useSaveProgramSession();
  const updateSession = useUpdateProgramSession();
  const updateForward = useUpdateProgramSessionsForward();

  // Edit save stashed while the "this session only vs all future" choice
  // dialog is open.
  const [pendingSave, setPendingSave] = useState<{
    options: Omit<WorkoutOptions, 'startedAt'>;
    title: string;
  } | null>(null);
  // The builder opens on demand from the session list, targeting one week; an
  // empty program forces it open below, since there is no list to show instead.
  const [builderWeek, setBuilderWeek] = useState<number | null>(null);
  // Weeks added but not yet given a session exist only here, after the last
  // stored week, until the page unmounts.
  const [emptyWeekCount, setEmptyWeekCount] = useState(0);
  // Session / week queued for deletion while its confirm dialog is open.
  const [pendingDelete, setPendingDelete] = useState<ProgramSession | null>(
    null,
  );
  const [pendingDeleteWeek, setPendingDeleteWeek] = useState<WeekGroup | null>(
    null,
  );
  const duplicateSession = useDuplicateProgramSession();
  const duplicateWeek = useDuplicateProgramWeek();
  const setLayout = useSetProgramSessionLayout();
  const deleteSession = useDeleteProgramSession();
  const deleteWeek = useDeleteProgramWeek();

  // Edit mode when the route carries a session id; the builder is then seeded
  // from that session and saving rewrites it in place.
  const isEditing = !!sessionId;
  const pageTitle = isEditing ? 'Edit session' : 'Add session';

  if (isLoading) {
    return (
      <Page title={pageTitle}>
        <p className="text-sm text-muted-foreground">Loading program…</p>
      </Page>
    );
  }

  if (isError || !data) {
    return (
      <Page title={pageTitle}>
        <p className="text-sm text-muted-foreground">Program not found.</p>
        <Button variant="secondary" onClick={() => navigate('/programs')}>
          Back to programs
        </Button>
      </Page>
    );
  }

  const { program, sessions } = data;
  const nextSequenceIndex = sessions.length;
  const maxWeek = sessions.reduce((max, s) => Math.max(max, s.weekNumber), 0);
  const weekGroups = withEmptyWeeks(groupByWeek(sessions), emptyWeekCount);

  // Layout/delete write to program_sessions, which RLS restricts to the program
  // owner — so only show those controls on an owned program (the shared
  // read-only DFW is never editable here).
  const canEdit = !!session?.user?.id && program.ownerId === session.user.id;
  const busy =
    setLayout.isPending || deleteSession.isPending || deleteWeek.isPending;

  const builderTarget = builderWeek ?? (sessions.length === 0 ? 1 : null);
  const showBuilder = builderTarget !== null;

  // A saved session returns to the list, where the new row is the confirmation.
  // The builder is remounted by key on reopen, so the next session starts from
  // a clean slate (title cleared, movements reset to defaults).
  const handleSave = (
    options: Omit<WorkoutOptions, 'startedAt'>,
    title: string,
  ) => {
    const slot = nextSlotInWeek(weekGroups, builderTarget ?? 1);
    saveSession.mutate(
      {
        programId: program.id,
        sequenceIndex: nextSequenceIndex,
        ...slot,
        title: title || `Session ${nextSequenceIndex + 1}`,
        workoutOptions: options,
      },
      {
        onSuccess: () => {
          setBuilderWeek(null);
          if (slot.weekNumber > maxWeek) setEmptyWeekCount((c) => c - 1);
        },
      },
    );
  };

  const handleDuplicateSession = (session: ProgramSession) => {
    duplicateSession.mutate({
      session,
      sequenceIndex: nextSequenceIndex,
      ...nextSlotInWeek(weekGroups, session.weekNumber),
    });
  };

  const handleDuplicateWeek = (group: WeekGroup) => {
    duplicateWeek.mutate({
      programId: program.id,
      sessions: group.sessions,
      newWeekNumber: maxWeek + 1,
      startSequenceIndex: nextSequenceIndex,
    });
  };

  // Persist a regrouping (drop or week move). Reindexing goes through the RPC
  // because the UNIQUE (program_id, sequence_index) constraint is not deferrable.
  const handleLayoutChange = (next: WeekGroup[]) => {
    setEmptyWeekCount(trailingEmptyWeekCount(next));
    const layout = flattenLayout(next);
    if (isSameLayout(layout, layoutOf(sessions))) return;
    setLayout.mutate({ programId: program.id, layout });
  };

  const handleDeleteWeek = (group: WeekGroup) => {
    if (group.sessions.length === 0) setEmptyWeekCount((c) => c - 1);
    else setPendingDeleteWeek(group);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteSession.mutate(
      { sessionId: pendingDelete.id, programId: program.id },
      { onSettled: () => setPendingDelete(null) },
    );
  };

  const confirmDeleteWeek = () => {
    if (!pendingDeleteWeek) return;
    const { weekNumber } = pendingDeleteWeek;
    deleteWeek.mutate(
      { programId: program.id, weekNumber },
      {
        onSuccess: (count) =>
          showToast(
            `Deleted week ${weekNumber} (${count} ${count === 1 ? 'session' : 'sessions'})`,
          ),
        onSettled: () => setPendingDeleteWeek(null),
      },
    );
  };

  const weekActions = (
    group: WeekGroup,
    index: number,
  ): OverflowMenuAction[] => {
    const isEmpty = group.sessions.length === 0;
    if (!canEdit) {
      return [
        {
          label: 'Duplicate week',
          onSelect: () => handleDuplicateWeek(group),
          disabled: duplicateWeek.isPending || isEmpty,
        },
      ];
    }
    return [
      {
        label: 'Add session',
        onSelect: () => setBuilderWeek(group.weekNumber),
        disabled: busy,
      },
      {
        label: 'Duplicate week',
        onSelect: () => handleDuplicateWeek(group),
        disabled: duplicateWeek.isPending || isEmpty,
      },
      {
        label: 'Move week up',
        onSelect: () =>
          handleLayoutChange(moveWeek(weekGroups, group.weekNumber, -1)),
        disabled: busy || isEmpty || index === 0,
      },
      {
        label: 'Move week down',
        onSelect: () =>
          handleLayoutChange(moveWeek(weekGroups, group.weekNumber, 1)),
        disabled:
          busy ||
          isEmpty ||
          index >= weekGroups.length - 1 ||
          weekGroups[index + 1].sessions.length === 0,
      },
      {
        label: 'Delete week',
        onSelect: () => handleDeleteWeek(group),
        disabled: busy,
        destructive: true,
      },
    ];
  };

  const sessionActions = (
    groupSession: ProgramSession,
  ): OverflowMenuAction[] => [
    ...(canEdit
      ? [
          {
            label: 'Edit session',
            onSelect: () =>
              navigate(
                `/programs/${program.id}/sessions/${groupSession.id}/edit`,
              ),
            disabled: busy,
          },
        ]
      : []),
    {
      label: 'Duplicate session',
      onSelect: () => handleDuplicateSession(groupSession),
      disabled: duplicateSession.isPending,
    },
    ...(canEdit
      ? [
          {
            label: 'Delete session',
            onSelect: () => setPendingDelete(groupSession),
            disabled: busy,
            destructive: true,
          },
        ]
      : []),
  ];

  const backToBuilder = () => navigate(`/programs/${program.id}/sessions/new`);

  // Edit mode: seed the builder from the target session and rewrite it in place
  // (title + options), then return to the builder's session list.
  if (isEditing) {
    const editingSession = sessions.find((s) => s.id === sessionId);

    if (!canEdit || !editingSession) {
      return (
        <Page title="Edit session">
          <p className="text-sm text-muted-foreground">
            {editingSession
              ? "You can't edit this program's sessions."
              : 'Session not found.'}
          </p>
          <Button variant="secondary" onClick={backToBuilder}>
            Back to sessions
          </Button>
        </Page>
      );
    }

    const laterSessionCount = sessions.filter(
      (s) => s.sequenceIndex > editingSession.sequenceIndex,
    ).length;

    const updateThisSessionOnly = (
      options: Omit<WorkoutOptions, 'startedAt'>,
      title: string,
    ) => {
      updateSession.mutate(
        {
          sessionId: editingSession.id,
          programId: program.id,
          title: title || editingSession.title,
          workoutOptions: options,
        },
        { onSuccess: backToBuilder },
      );
    };

    const updateThisAndFutureSessions = (
      options: Omit<WorkoutOptions, 'startedAt'>,
      title: string,
    ) => {
      updateForward.mutate(
        {
          sessionId: editingSession.id,
          programId: program.id,
          title: title || editingSession.title,
          workoutOptions: options,
        },
        {
          onSuccess: (updatedCount) => {
            showToast(
              updatedCount === 1
                ? 'Updated 1 upcoming session'
                : `Updated ${updatedCount} upcoming sessions`,
            );
            backToBuilder();
          },
        },
      );
    };

    // With later sessions, saving asks whether the movement change should
    // carry forward; on the last session there's nothing ahead, so save
    // directly.
    const handleUpdate = (
      options: Omit<WorkoutOptions, 'startedAt'>,
      title: string,
    ) => {
      if (laterSessionCount > 0) setPendingSave({ options, title });
      else updateThisSessionOnly(options, title);
    };

    const saving = updateSession.isPending || updateForward.isPending;

    return (
      <>
        <Dialog
          open={pendingSave !== null}
          onOpenChange={(open) => {
            if (!open && !saving) setPendingSave(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Apply changes to…</DialogTitle>
              <DialogDescription>
                Save these movements and weights here, or carry them into the{' '}
                {laterSessionCount === 1
                  ? 'next session'
                  : `next ${laterSessionCount} sessions`}{' '}
                as well. Later sessions keep their own titles, goals, and rep
                schemes; completed sessions are never changed.
              </DialogDescription>
            </DialogHeader>
            {/* Narrowest blast radius reads as the default; carrying the edit
                across the rest of the program takes the deliberate second
                choice, and the escape hatch is last where the thumb lands. */}
            <DialogFooter className="flex-col gap-1 sm:flex-col sm:gap-1">
              <Button
                className="w-full"
                disabled={saving}
                onClick={() => {
                  if (pendingSave)
                    updateThisSessionOnly(
                      pendingSave.options,
                      pendingSave.title,
                    );
                }}
              >
                This session only
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                disabled={saving}
                onClick={() => {
                  if (pendingSave)
                    updateThisAndFutureSessions(
                      pendingSave.options,
                      pendingSave.title,
                    );
                }}
              >
                This and all future sessions
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                disabled={saving}
                onClick={() => setPendingSave(null)}
              >
                Keep editing
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <StartWorkoutPage
          key={`edit-${editingSession.id}`}
          programSaveMode={{
            onSave: handleUpdate,
            saving,
            initialSession: {
              workoutOptions: editingSession.workoutOptions,
              title: editingSession.title,
            },
            beforeBuilder: (
              <>
                <button
                  type="button"
                  onClick={backToBuilder}
                  className="self-start text-xs font-medium text-muted-foreground"
                >
                  ← Sessions
                </button>
                <div className="text-xl font-semibold">Edit session</div>
              </>
            ),
          }}
        />
      </>
    );
  }

  const backLink = (
    <Link
      to="/programs"
      className="self-start text-xs font-medium text-muted-foreground"
    >
      ← Programs
    </Link>
  );

  // The builder is a mode, not the page's resting state: with sessions already
  // saved, the list leads and "Add session" opens the builder. An empty program
  // has no list to lead with, so it opens straight into the builder.
  if (showBuilder) {
    return (
      <StartWorkoutPage
        key={`session-${builderTarget}-${sessions.length}`}
        programSaveMode={{
          onSave: handleSave,
          saving: saveSession.isPending,
          beforeBuilder: (
            <>
              {sessions.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setBuilderWeek(null)}
                  className="self-start text-xs font-medium text-muted-foreground"
                >
                  ← Sessions
                </button>
              ) : (
                backLink
              )}
              <div className="text-xl font-semibold">
                {sessions.length > 0
                  ? `New session · Week ${builderTarget}`
                  : program.title}
              </div>
            </>
          ),
        }}
      />
    );
  }

  return (
    <Page>
      {backLink}

      <div className="text-xl font-semibold">{program.title}</div>

      {sessions.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-1.5 pt-2">
            <p className="text-sm font-semibold">
              Saved sessions ({sessions.length})
            </p>
            <SessionWeekList
              groups={weekGroups}
              canEdit={canEdit}
              busy={busy}
              onLayoutChange={handleLayoutChange}
              weekActions={weekActions}
              sessionActions={sessionActions}
              onAddSession={setBuilderWeek}
            />
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleteSession.isPending) setPendingDelete(null);
        }}
        title="Delete this session?"
        description={
          pendingDelete
            ? `"${pendingDelete.title}" is removed from the program and the sessions after it move up. This can't be undone.`
            : ''
        }
        confirmLabel="Delete session"
        confirmVariant="destructive"
        dismissLabel="Keep session"
        onConfirm={confirmDelete}
        onDismiss={() => setPendingDelete(null)}
        isPending={deleteSession.isPending}
      />

      <ConfirmDialog
        open={pendingDeleteWeek !== null}
        onOpenChange={(open) => {
          if (!open && !deleteWeek.isPending) setPendingDeleteWeek(null);
        }}
        title={`Delete week ${pendingDeleteWeek?.weekNumber}?`}
        description={
          pendingDeleteWeek
            ? `Its ${pendingDeleteWeek.sessions.length === 1 ? 'session is' : `${pendingDeleteWeek.sessions.length} sessions are`} removed from the program and the weeks after it move up. This can't be undone.`
            : ''
        }
        confirmLabel="Delete week"
        confirmVariant="destructive"
        dismissLabel="Keep week"
        onConfirm={confirmDeleteWeek}
        onDismiss={() => setPendingDeleteWeek(null)}
        isPending={deleteWeek.isPending}
      />

      {canEdit && (
        <Button
          className="w-full"
          onClick={() => setEmptyWeekCount((c) => c + 1)}
          disabled={busy}
        >
          Add week
        </Button>
      )}
    </Page>
  );
};
