/**
 * A reusable program definition: an ordered sequence of {@link ProgramSession}s.
 * A program is either system/shared (`ownerId === null`, `isPublic === true`,
 * with a stable {@link Program.slug} like `'dry-fighting-weight'`) or a private
 * user-authored copy. Enrolling in a shared program clones it into an editable
 * user-owned copy (`sourceProgramId` points back at the original).
 *
 * camelCase mirror of the generated `programs` row.
 */
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
  numWeeks: number;
  daysPerWeek: number;
  isPublic: boolean;
  createdAt: string;
  /** Soft-archive marker: NULL when live, a timestamp once archived (hidden from the default list, restorable). */
  archivedAt: string | null;
}
