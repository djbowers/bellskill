import { Button } from '~/components/ui/button';
import type { IssueSuggestion, WorkoutIssue } from '~/utils';
import { WORKOUT_MODE_LABELS } from '~/utils';

export interface WorkoutIssueListProps {
  errors: WorkoutIssue[];
  warnings: WorkoutIssue[];
  /** Movement names in builder order, for naming movement-scoped issues. */
  movementNames: string[];
  onApplySuggestion: (suggestion: IssueSuggestion) => void;
}

const suggestionLabel = (suggestion: IssueSuggestion) =>
  suggestion.kind === 'switchMode'
    ? `Switch to ${WORKOUT_MODE_LABELS[suggestion.mode]}`
    : `Pad to ${suggestion.targetRungs} rungs`;

const suggestionKey = (suggestion: IssueSuggestion) =>
  suggestion.kind === 'switchMode'
    ? `switchMode:${suggestion.mode}`
    : `padRungs:${suggestion.targetRungs}`;

export const WorkoutIssueList = ({
  errors,
  warnings,
  movementNames,
  onApplySuggestion,
}: WorkoutIssueListProps) => {
  if (errors.length === 0 && warnings.length === 0) return null;

  const scope = (issue: WorkoutIssue) => {
    if (issue.movementIndex === undefined) return null;
    const name = movementNames[issue.movementIndex]?.trim();
    return `${name || `Movement ${issue.movementIndex + 1}`}: `;
  };

  const renderIssue = (issue: WorkoutIssue, index: number) => (
    <div
      key={`${issue.code}-${issue.movementIndex ?? 'workout'}-${index}`}
      role={issue.severity === 'error' ? 'alert' : 'status'}
    >
      {/* The colour marks the problem, not the remedy — fix buttons stay neutral. */}
      <p
        className={
          issue.severity === 'error'
            ? 'text-sm text-destructive'
            : 'text-sm text-muted-foreground'
        }
      >
        {scope(issue)}
        {issue.message}
      </p>
      {issue.suggestions && issue.suggestions.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {issue.suggestions.map((suggestion) => (
            <Button
              key={suggestionKey(suggestion)}
              size="sm"
              variant="outline"
              onClick={() => onApplySuggestion(suggestion)}
            >
              {suggestionLabel(suggestion)}
            </Button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      {errors.map(renderIssue)}
      {warnings.map(renderIssue)}
    </div>
  );
};
