import { useToast } from '~/contexts';

/**
 * The single, human-readable message shown when any program mutation fails.
 * Kept generic so every program edit surfaces identical feedback.
 */
export const PROGRAM_MUTATION_ERROR_MESSAGE =
  'Something went wrong. Please try again.';

/**
 * Sentinels raised by `enroll_in_program` / `resume_program` for the two states
 * a user can actually reach and act on. Anything else falls through to the
 * generic message above.
 */
const RPC_ERROR_MESSAGES: Record<string, string> = {
  PROGRAM_SLOTS_FULL:
    'You already have 3 programs going. Finish or cancel one first.',
  PROGRAM_ALREADY_ACTIVE: "You're already running that program.",
};

/**
 * Shared react-query `onError` handler for program mutations. Wiring this into
 * each program `useMutation` — rather than a bespoke handler per hook — gives
 * every program edit the same error toast, so a failure (most reachably a
 * concurrent multi-tab edit hitting the reindex RPC) never fails silently.
 *
 * The error-feedback behavior is scoped to the programs feature structurally:
 * program mutations only run on the (flag-gated) program surfaces, and this
 * handler is wired only into program mutations, so no non-program flow shows a
 * toast. A future program mutation reuses it by adding `onError` to its
 * `useMutation` config.
 */
export const useProgramMutationErrorHandler = () => {
  const { showToast } = useToast();
  return (error: unknown) => {
    const raised = (error as { message?: string } | null)?.message ?? '';
    const known = Object.keys(RPC_ERROR_MESSAGES).find((sentinel) =>
      raised.includes(sentinel),
    );
    showToast(known ? RPC_ERROR_MESSAGES[known] : PROGRAM_MUTATION_ERROR_MESSAGE, {
      variant: 'destructive',
    });
  };
};
