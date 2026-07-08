import { useToast } from '~/contexts';

/**
 * The single, human-readable message shown when any program mutation fails.
 * Kept generic so every program edit surfaces identical feedback.
 */
export const PROGRAM_MUTATION_ERROR_MESSAGE =
  'Something went wrong. Please try again.';

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
  return () =>
    showToast(PROGRAM_MUTATION_ERROR_MESSAGE, { variant: 'destructive' });
};
