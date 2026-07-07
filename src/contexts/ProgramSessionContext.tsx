import { createContext, useContext, useState } from 'react';

/**
 * Identifies the program session a workout was started from, so the log step can
 * advance the program on completion. Slice 3: when a workout is started from the
 * NextProgramWorkoutCard, `useStartWorkout` stashes this here; `useLogWorkout`
 * reads it in `onSuccess` to write a `program_session_completions` row keyed on
 * the new `workout_logs.id`. `null` for every non-program start.
 *
 * This rides alongside `WorkoutOptionsContext` (App.tsx) rather than on the
 * committed `WorkoutOptions`, keeping the program linkage out of the
 * `workout_logs` insert payload entirely.
 */
export interface PendingProgramSession {
  userProgramId: string;
  programSessionId: string;
}

// Default to "no pending session" so consumers (and tests/stories that don't
// wrap in the provider) degrade gracefully: reading yields null and setting is a
// no-op. The real provider in App.tsx supplies the live state.
export const ProgramSessionContext = createContext<
  [
    PendingProgramSession | null,
    (session: PendingProgramSession | null) => void,
  ]
>([null, () => {}]);

export const ProgramSessionProvider = ({ ...props }) => {
  const [programSession, setProgramSession] =
    useState<PendingProgramSession | null>(null);

  return (
    <ProgramSessionContext.Provider
      value={[programSession, setProgramSession]}
      {...props}
    />
  );
};

export const useProgramSession = () => useContext(ProgramSessionContext);
