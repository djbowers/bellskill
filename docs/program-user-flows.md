# Programs — User Flows

Data model, RPCs, and backend behaviors live in `docs/program-tracking.md`. This
doc maps the feature's user-facing flows to routes/components/hooks and their
test coverage.

## 1. Browse & details

- **Purpose:** discover public/shared programs and preview a program before enrolling.
- **Entry point:** `ProgramsPage` "Browse programs" list (each row's Start button / title link).
- **Screens/routes:** `ProgramsPage` (`/programs`) → `ProgramDetailsPage` (`programs/:id/details`).
- **Key files:** `src/pages/ProgramsPage/ProgramsPage.tsx`, `src/pages/ProgramDetailsPage/ProgramDetailsPage.tsx`, `src/api/usePrograms.ts`, `src/api/useProgram.ts`.
- **Traceability:**
  - Unit: `src/pages/ProgramsPage/ProgramsPage.test.tsx`, `src/pages/ProgramDetailsPage/ProgramDetailsPage.test.tsx`, `src/api/usePrograms.test.ts`.
  - `useProgram.ts` has no dedicated unit test (NONE FOUND).
  - e2e: `e2e/program-schema.spec.ts` (seed shape/ordering assertions consumed by these pages).

## 2. Enroll

- **Purpose:** configure starting weight(s) and cadence, then start or queue an enrollment.
- **Entry point:** `ProgramDetailsPage` enroll form.
- **Screens/routes:** `programs/:id/details`.
- **Key files:** `ProgramDetailsPage.tsx`; `src/pages/ProgramDetailsPage/utils/deriveMovementWeights.ts` (`deriveMovementWeights`, `isComplexProgram`); `src/pages/ProgramDetailsPage/utils/deriveWeightGroups.ts` (`deriveStartingWeight`, `deriveWeightGroups`, `applyGroupOffset`); auto-repeat toggle (`autoRepeat` state); Start-vs-Queue and slot-cap replace dialog gated on `MAX_ACTIVE_PROGRAMS` (`slotsFull` check); resume-vs-start-over branch. Hooks: `src/api/useEnrollProgram.ts`, `src/api/useResumeProgram.ts`, `src/api/useActivePrograms.ts`, `src/api/useQueuedPrograms.ts`.
- **Traceability:**
  - Unit: `ProgramDetailsPage.test.tsx`, `deriveMovementWeights.test.ts`, `deriveWeightGroups.test.ts` (covers `deriveStartingWeight` too), `useEnrollProgram.test.ts`, `useActivePrograms.test.ts`, `useQueuedPrograms.test.ts`.
  - `useResumeProgram.ts` has no dedicated unit test (NONE FOUND) — covered only at the e2e layer.
  - e2e: `e2e/program-parallel.spec.ts` (slot cap, replace, resume), `e2e/program-in-program-flow.spec.ts` (start-any-session, resume, cancel/reactivate), `e2e/program-queue.spec.ts` (queue vs auto-repeat).

## 3. Active-program home hero

- **Purpose:** surface the next workout for an active program on the home/start screen.
- **Entry point:** app home when ≥1 program is active — forces browse mode.
- **Screens/routes:** `StartWorkoutPage` (home route).
- **Key files:** `src/pages/StartWorkoutPage/StartWorkoutPage.tsx` — `programGatePending` flag (holds browse mode until the program query resolves), `StartWorkoutHero variant="program"`, `handleSkipProgram`; `src/pages/StartWorkoutPage/components/ProgramSwitcherTabs.tsx`; `src/contexts/ProgramSessionContext.tsx` (set by `src/hooks/useStartWorkout.ts`, read by `src/api/useLogWorkout.ts`).
- **Traceability:**
  - Unit: `StartWorkoutPage.parallelPrograms.test.jsx`, `StartWorkoutPage.startProgramCard.test.jsx`, `StartWorkoutPage.pendingGate.test.jsx` (plus general `StartWorkoutPage.test.jsx` and sibling suites).
  - e2e: `e2e/program-parallel.spec.ts`, `e2e/program-next-workout.spec.ts` (skip writes no-log completion), `e2e/program-in-program-flow.spec.ts`.

## 4. Progress & week view

- **Purpose:** show session-by-session progress, adjust weights, see queue status.
- **Entry point:** "View progress" from the home hero or a `ProgramsPage` "My programs" card.
- **Screens/routes:** `ProgramProgressPage` (`programs/:id`).
- **Key files:** `src/pages/ProgramProgressPage/ProgramProgressPage.tsx` (done/skipped/upcoming chips, auto-repeat `Switch`, "Next up" queue line), `src/pages/ProgramProgressPage/components/AdjustWeightsDialog.tsx`, `src/api/useProgramProgress.ts`, `src/api/useAdjustProgramWeights.ts`.
- **Traceability:**
  - Unit: `ProgramProgressPage.test.tsx` (also exercises `AdjustWeightsDialog` — no dedicated test file for the dialog itself).
  - `useAdjustProgramWeights.ts` has no dedicated unit test (NONE FOUND).
  - e2e: `e2e/program-progress.spec.ts`, `e2e/program-adjust-weights.spec.ts`.

## 5. Authoring

- **Purpose:** create/edit a program's sessions.
- **Entry point:** create from `ProgramsPage`; edit from `ProgramSessionBuilderPage`'s per-session controls.
- **Screens/routes:** `ProgramSessionBuilderPage` (`programs/:id/sessions/new`, `programs/:id/sessions/:sessionId/edit`) — wraps `StartWorkoutPage` via `programSaveMode` (the `ProgramSaveMode` interface is defined in `StartWorkoutPage.tsx`, not the builder).
- **Key files:** `src/pages/ProgramSessionBuilderPage/ProgramSessionBuilderPage.tsx`; hooks `useReorderProgramSession.ts` (exports `useReorderProgramSessions`), `useUpdateProgramSession.ts`, `useDuplicateProgramSession.ts` (also exports `useDuplicateProgramWeek`), `useDeleteProgramSession.ts`, `useUpdateProgramSessionsForward.ts`. Apply-forward dialog: "This session only" vs "This and all future sessions".
- **Traceability:**
  - Unit: `ProgramSessionBuilderPage.test.tsx`, `useUpdateProgramSession.test.ts`, `useReorderProgramSession.test.ts`, `useDeleteProgramSession.test.ts`.
  - `useUpdateProgramSessionsForward.ts` has no dedicated unit test (NONE FOUND).
  - e2e: `e2e/program-reorder-delete.spec.ts`, `e2e/program-update-forward.spec.ts`.

## 6. Completion & advancement

- **Purpose:** logging a workout for an active program session advances the enrollment.
- **Entry point:** finishing a workout started from a program card (any of flows 1–5).
- **Key files:** `src/api/useLogWorkout.ts` — reads `useProgramSession()` (from `ProgramSessionContext`) and on success calls `completeProgramSession` (`src/api/useCompleteProgramSession.ts`), which invokes the `complete_program_session` RPC. Skip path: `handleSkipProgram` in `StartWorkoutPage.tsx` (writes a skipped completion, no `workout_logs` row). Auto-repeat restart and queue promotion are implemented **inside the SQL function itself**, not in client code — `useLogWorkout.ts` only forwards the call and contains no auto-repeat/queue branching.
- **Traceability:**
  - Unit: `useLogWorkout.test.ts` (completion-wiring describe block: RPC payload with the real log id, context clear, `ACTIVE_PROGRAM` invalidation, non-program no-op, RPC-failure isolation, full `ProgramSessionProvider` round-trip), `useCompleteProgramSession.test.ts` (skip payload + invalidation semantics), `ProgramSessionContext.test.tsx`, `StartWorkoutPage.parallelPrograms.test.jsx` (start stashes the selected program's session in context).
  - e2e: `e2e/program-next-workout.spec.ts` (advance, skip, terminal completion, idempotent duplicate completion), `e2e/program-queue.spec.ts` (auto-repeat vs queue promotion, FIFO queue), `e2e/program-parallel.spec.ts`.

## 7. Lifecycle

- **Purpose:** cancel, archive/restore, or delete an owned enrollment/program; manage the queue.
- **Entry point:** `ProgramsPage` "My programs" card actions and queue section.
- **Key files:** `ProgramsPage.tsx`; hooks `useCancelProgram.ts`, `useSetProgramArchived.ts`, `useDeleteProgram.ts`, `useDequeueProgram.ts` (also defines `useStartQueuedProgram` in the same file, not a standalone module).
- **Traceability:**
  - Unit: `useCancelProgram.test.ts`, `useSetProgramArchived.test.ts`, `useDeleteProgram.test.ts`, `useDequeueProgram.test.ts` (covers `useStartQueuedProgram` too), `ProgramsPage.test.tsx`.
  - e2e: `e2e/program-crud.spec.ts` (cancel/abandon, hard-delete cascade, archive/restore, owner-only protection), `e2e/program-queue.spec.ts` (dequeue never promoted).

## Notes on gaps found while verifying

- The gaps originally listed here (`useProgram.ts`, `useResumeProgram.ts`, `useAdjustProgramWeights.ts`, `useUpdateProgramSessionsForward.ts`, standalone `AdjustWeightsDialog.tsx`, `program.ts` mappers, `programCadenceLabel.ts`, and the `useLogWorkout` → `completeProgramSession` wiring) now have colocated unit tests. Auto-repeat restart and queue promotion remain SQL-only logic inside `complete_program_session`, exercised by the e2e suite rather than unit tests.
