/**
 * A reusable program definition: an ordered sequence of {@link ProgramSession}s.
 * A program is either system/shared (`ownerId === null`, `isPublic === true`,
 * with a stable {@link Program.slug} like `'dry-fighting-weight'`) or a private
 * user-authored copy. Enrolling in a shared program clones it into an editable
 * user-owned copy (`sourceProgramId` points back at the original).
 *
 * camelCase mirror of the generated `programs` row.
 */
/** One movement of a {@link ProgramStage} complex — name and reps only; weights come from each session. */
export interface ProgramStageMovement {
  movementName: string;
  repScheme: number[];
}

/**
 * One rung of a program's milestone-gated progression ladder (e.g. A+A's
 * C+J → C+J+C → … → 3 cleans + 3 jerks, or Plan 025's Sets of 5 → Sets
 * of 10). Advancing an enrollment to a stage (`set_program_stage`) rewrites
 * every not-yet-completed session's movements and notes; weights come from
 * each session (shared weights on complex sessions, per-movement weights —
 * and the session's own title — otherwise), so stages author none.
 */
export interface ProgramStage {
  title: string;
  movements: ProgramStageMovement[];
  preWorkoutNotes?: string;
  /** Notes variant for sessions in the 'Deload weeks' weight group. */
  deloadPreWorkoutNotes?: string;
}

/**
 * What a program trains. Ordered as chips should render, so this array — not a
 * program's own tag order — is the display source of truth.
 */
export const PROGRAM_FOCUS_TAGS = [
  'strength',
  'hypertrophy',
  'power',
  'conditioning',
  'endurance',
  'skill',
  'mobility',
] as const;

export type ProgramFocusTag = (typeof PROGRAM_FOCUS_TAGS)[number];

/**
 * A program's recovery cost as written, not the difficulty of its movements.
 * This is the binding constraint when stacking: two `high` programs collide even
 * with disjoint {@link Program.focusTags}, while a `low` one stacks with almost
 * anything.
 */
export type ProgramSystemicDemand = 'low' | 'moderate' | 'high';

export interface Program {
  id: string;
  /** NULL for system/shared programs; the owning user otherwise. */
  ownerId: string | null;
  /** Set on copy-on-enroll clones, pointing at the source program. */
  sourceProgramId: string | null;
  /** Stable slug for system programs, e.g. 'dry-fighting-weight'. NULL for user copies. */
  slug: string | null;
  title: string;
  description: string | null;
  authorName: string | null;
  /**
   * Program cadence, **derived from the program's own sessions** rather than
   * declared at creation (PROD-237): `numWeeks` is the highest session week,
   * `daysPerWeek` the widest week. Both are `null` for a program with no
   * sessions yet. Seeded shared programs still carry authored values.
   */
  numWeeks: number | null;
  daysPerWeek: number | null;
  isPublic: boolean;
  createdAt: string;
  /** Soft-archive marker: NULL when live, a timestamp once archived (hidden from the default list, restorable). */
  archivedAt: string | null;
  /**
   * Template default for the per-enrollment auto-repeat toggle. `true` for
   * "repeating workouts" (Simple & Sinister, the Onnit circuit) that loop rather
   * than finish; `false` for ordinary finite programs. Copied into
   * {@link UserProgram.autoRepeat} at enroll time, where the user can override it.
   */
  defaultAutoRepeat: boolean;
  /**
   * Release gate for shared programs (PROD-246): NULL means seeded but not yet
   * released — visible only to the owner account until a manual test run
   * passes. RLS hides unreleased public programs from everyone else, so most
   * clients only ever see timestamps here.
   */
  releasedAt: string | null;
  /**
   * Ordered progression ladder, or `null` for programs without one. Copied to
   * the clone at enroll time; {@link UserProgram.currentStageIndex} tracks the
   * enrollment's position.
   */
  stages: ProgramStage[] | null;
  /**
   * Up to three focus tags describing what the program trains. Empty for
   * user-authored programs, which carry no editorial categorization. Overlap
   * between two stacked programs signals redundant work.
   */
  focusTags: ProgramFocusTag[];
  /** Editorial demand rating, or `null` on user-authored programs. */
  systemicDemand: ProgramSystemicDemand | null;
}
