import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  useDuplicateProgramSession,
  useDuplicateProgramWeek,
  useProgram,
  useSaveProgramSession,
} from '~/api';
import { Page } from '~/components';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
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
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useProgram(id);
  const saveSession = useSaveProgramSession();
  const duplicateSession = useDuplicateProgramSession();
  const duplicateWeek = useDuplicateProgramWeek();

  if (isLoading) {
    return (
      <Page title="Add session">
        <p className="text-sm text-muted-foreground">Loading program…</p>
      </Page>
    );
  }

  if (isError || !data) {
    return (
      <Page title="Add session">
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

  const handleSave = (
    options: Omit<WorkoutOptions, 'startedAt'>,
    title: string,
  ) => {
    saveSession.mutate({
      programId: program.id,
      sequenceIndex: nextSequenceIndex,
      weekNumber: nextWeek,
      dayNumber: nextDay,
      title: title || `Session ${nextSequenceIndex + 1}`,
      workoutOptions: options,
    });
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

  const beforeBuilder = (
    <>
      <Link
        to="/programs"
        className="self-start text-xs font-medium text-muted-foreground"
      >
        ← Programs
      </Link>

      <div className="text-xl font-semibold">{program.title}</div>

      {sessions.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-1.5 pt-2">
            <p className="text-sm font-semibold">
              Saved sessions ({sessions.length})
            </p>
            {weekGroups.map((group) => (
              <div key={group.weekNumber} className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Week {group.weekNumber}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDuplicateWeek(group)}
                    disabled={duplicateWeek.isLoading}
                  >
                    Duplicate week
                  </Button>
                </div>
                {group.sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>
                      Day {session.dayNumber} · {session.title}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDuplicateSession(session)}
                      disabled={duplicateSession.isLoading}
                    >
                      Duplicate
                    </Button>
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );

  return (
    // Remount the builder after each save so the next session starts from a
    // clean slate (title cleared, movements reset to defaults).
    <StartWorkoutPage
      key={`session-${sessions.length}`}
      programSaveMode={{
        onSave: handleSave,
        saving: saveSession.isLoading,
        beforeBuilder,
      }}
    />
  );
};
