import { Button } from '~/components/ui/button';

/**
 * Each starter exercises a different slice of the context Chalk receives —
 * which is the whole pitch: it already knows the lifter's training.
 */
const STARTER_PROMPTS = [
  'What should I train today?',
  'Which patterns am I neglecting?',
  'Is Simple & Sinister right for me?',
  "How's my volume trending this month?",
];

interface EmptyStateProps {
  onPick: (prompt: string) => void;
  disabled?: boolean;
}

export const EmptyState = ({ onPick, disabled = false }: EmptyStateProps) => (
  <div className="flex flex-col items-center gap-2 px-2 py-3 text-center">
    <div>
      <div className="text-lg font-semibold">Ask Chalk</div>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Your coach knows your training history, pattern balance, programs, and
        the bells you own.
      </p>
    </div>

    <div className="flex w-full flex-col gap-1">
      {STARTER_PROMPTS.map((prompt) => (
        <Button
          key={prompt}
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onPick(prompt)}
        >
          {prompt}
        </Button>
      ))}
    </div>

    <p className="text-xs text-muted-foreground">
      Chalk gives training guidance, not medical advice. For pain or injury, see
      a qualified professional.
    </p>
  </div>
);
