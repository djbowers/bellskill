import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  useDeleteProgramSession,
  useDuplicateProgramSession,
  useDuplicateProgramWeek,
  useProgram,
  useReorderProgramSessions,
  useSaveProgramSession,
  useUpdateProgramSession,
  useUpdateProgramSessionsForward,
} from '~/api';
import {
  ConfirmDialog,
  OverflowMenu,
  OverflowMenuAction,
  Page,
} from '~/components';
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

interface WeekGroup {
  weekNumber: number;
  sessions: ProgramSession[];
}

/** Group ordered sessions by week for the saved-session list. */
const groupByWeek = (sessions: ProgramSession[]): WeekGroup[] => {
  const groups: WeekGroup[] = [];
  for (const session of sessions) {
    const group = groups.find((g) => g.weekNumber === session.weekNumber);
    if (group) group.sessions.push(session);
    else groups.push({ weekNumber: session.weekNumber, sessions: [session] });
  }
  return groups;
};

/**
 * Renders the builder in "save session" mode for a program. The builder itself
 * (goal, movements, rep schemes, weights) is reused verbatim from
 * {@link StartWorkoutPage}; this wrapper owns program data, the save mutation,
 * and the duplicate-session / duplicate-week helpers shown above the builder.
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
  // The builder opens on demand from the session list; an empty program forces
  // it open below, since there is no list to show instead.
  const [builderOpen, setBuilderOpen] = useState(false);
  // Session queued for deletion while its confirm dialog is open.
  const [pendingDelete, setPendingDelete] = useState<ProgramSession | null>(
    null,
  );
  const duplicateSession = useDuplicateProgramSession();
  const duplicateWeek = useDuplicateProgramWeek();
  const reorderSessions = useReorderProgramSessions();
  const deleteSession = useDeleteProgramSession();

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
  const daysPerWeek = program.daysPerWeek || 1;
  const nextSequenceIndex = sessions.length;
  const nextWeek = Math.floor(nextSequenceIndex / daysPerWeek) + 1;
  const nextDay = (nextSequenceIndex % daysPerWeek) + 1;
  const maxWeek = sessions.reduce((max, s) => Math.max(max, s.weekNumber), 0);
  const weekGroups = groupByWeek(sessions);

  // Reorder/delete write to program_sessions, which RLS restricts to the
  // program owner — so only show those controls on an owned program (the shared
  // read-only DFW is never editable here). `sessions` is already ordered by
  // `sequenceIndex`, so its array position is the flat move index.
  const canEdit = !!session?.user?.id && program.ownerId === session.user.id;
  const reordering = reorderSessions.isPending;
  const deleting = deleteSession.isPending;

  const showBuilder = builderOpen || sessions.length === 0;

  // A saved session returns to the list, where the new row is the confirmation.
  // The builder is remounted by key on reopen, so the next session starts from
  // a clean slate (title cleared, movements reset to defaults).
  const handleSave = (
    options: Omit<WorkoutOptions, 'startedAt'>,
    title: string,
  ) => {
    saveSession.mutate(
      {
        programId: program.id,
        sequenceIndex: nextSequenceIndex,
        weekNumber: nextWeek,
        dayNumber: nextDay,
        title: title || `Session ${nextSequenceIndex + 1}`,
        workoutOptions: options,
      },
      { onSuccess: () => setBuilderOpen(false) },
    );
  };

  const handleDuplicateSession = (session: ProgramSession) => {
    duplicateSession.mutate({
      session,
      sequenceIndex: nextSequenceIndex,
      weekNumber: nextWeek,
      dayNumber: nextDay,
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

  // Move the session at flat `index` by `direction` (-1 up / +1 down), persisting
  // the full new order. Reindexing goes through the RPC because the UNIQUE
  // (program_id, sequence_index) constraint is not deferrable.
  const handleMove = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= sessions.length) return;
    const orderedIds = sessions.map((s) => s.id);
    [orderedIds[index], orderedIds[target]] = [
      orderedIds[target],
      orderedIds[index],
    ];
    reorderSessions.mutate({ programId: program.id, orderedIds });
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteSession.mutate(
      { sessionId: pendingDelete.id, programId: program.id },
      { onSettled: () => setPendingDelete(null) },
    );
  };

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
        key={`session-${sessions.length}`}
        programSaveMode={{
          onSave: handleSave,
          saving: saveSession.isPending,
          beforeBuilder: (
            <>
              {sessions.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setBuilderOpen(false)}
                  className="self-start text-xs font-medium text-muted-foreground"
                >
                  ← Sessions
                </button>
              ) : (
                backLink
              )}
              <div className="text-xl font-semibold">
                {sessions.length > 0 ? 'New session' : program.title}
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
            {weekGroups.map((group) => (
              <div key={group.weekNumber} className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Week {group.weekNumber}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground"
                    onClick={() => handleDuplicateWeek(group)}
                    disabled={duplicateWeek.isPending}
                  >
                    Duplicate week
                  </Button>
                </div>
                <ul className="flex flex-col">
                  {group.sessions.map((groupSession) => {
                    const flatIndex = sessions.findIndex(
                      (s) => s.id === groupSession.id,
                    );
                    const actions: OverflowMenuAction[] = [
                      ...(canEdit
                        ? [
                            {
                              label: 'Edit session',
                              onSelect: () =>
                                navigate(
                                  `/programs/${program.id}/sessions/${groupSession.id}/edit`,
                                ),
                              disabled: deleting || reordering,
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
                              disabled: deleting || reordering,
                              destructive: true,
                            },
                          ]
                        : []),
                    ];

                    return (
                      <li
                        key={groupSession.id}
                        className="flex items-center gap-1 border-b border-border/60 py-0.5 last:border-b-0"
                      >
                        <span
                          aria-hidden
                          className="flex h-3 w-3 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-semibold tabular-nums text-muted-foreground"
                        >
                          {groupSession.dayNumber}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm">
                          <span className="sr-only">
                            Day {groupSession.dayNumber}:{' '}
                          </span>
                          {groupSession.title}
                        </span>
                        {canEdit && sessions.length > 1 && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="shrink-0 text-muted-foreground"
                              aria-label={`Move ${groupSession.title} up`}
                              onClick={() => handleMove(flatIndex, -1)}
                              disabled={
                                reordering || deleting || flatIndex === 0
                              }
                            >
                              <ChevronUpIcon className="h-2 w-2" aria-hidden />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="shrink-0 text-muted-foreground"
                              aria-label={`Move ${groupSession.title} down`}
                              onClick={() => handleMove(flatIndex, 1)}
                              disabled={
                                reordering ||
                                deleting ||
                                flatIndex === sessions.length - 1
                              }
                            >
                              <ChevronDownIcon
                                className="h-2 w-2"
                                aria-hidden
                              />
                            </Button>
                          </>
                        )}
                        <OverflowMenu
                          actions={actions}
                          menuLabel={groupSession.title}
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null);
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
        isPending={deleting}
      />

      <Button
        className="w-full"
        onClick={() => setBuilderOpen(true)}
        disabled={reordering || deleting}
      >
        Add session
      </Button>
    </Page>
  );
};
