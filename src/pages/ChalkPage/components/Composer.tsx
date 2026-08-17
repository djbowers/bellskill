import { PaperAirplaneIcon } from '@heroicons/react/24/solid';
import { FormEvent, useState } from 'react';

import { Button } from '~/components/ui/button';
import { Textarea } from '~/components/ui/textarea';

export const MAX_MESSAGE_CHARS = 2000;

interface ComposerProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export const Composer = ({ onSend, disabled = false }: ComposerProps) => {
  const [value, setValue] = useState('');

  const trimmed = value.trim();
  const tooLong = trimmed.length > MAX_MESSAGE_CHARS;
  const canSend = !!trimmed && !tooLong && !disabled;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSend) return;
    onSend(trimmed);
    setValue('');
  };

  return (
    // sticky, not fixed: a fixed composer is the classic iOS Safari bug where
    // the bar floats over the keyboard or scrolls away. `useBottomNavVisible`
    // already drops the nav (and its padding) when the keyboard opens.
    <form
      onSubmit={submit}
      className="sticky bottom-0 border-t border-border bg-background/95 p-1 backdrop-blur"
      style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex items-end gap-1">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter is a newline. On touch keyboards Enter
            // is usually a newline key, so the send button is the real path.
            if (e.key === 'Enter' && !e.shiftKey) submit(e);
          }}
          placeholder="Ask Chalk about your training…"
          aria-label="Message Chalk"
          rows={1}
          className="max-h-[120px] min-h-[40px] resize-none"
          disabled={disabled}
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Send"
          disabled={!canSend}
        >
          <PaperAirplaneIcon className="h-2 w-2" aria-hidden="true" />
        </Button>
      </div>
      {tooLong && (
        <p className="mt-0.5 text-xs text-destructive">
          That’s {trimmed.length} characters — keep it under {MAX_MESSAGE_CHARS}.
        </p>
      )}
    </form>
  );
};
