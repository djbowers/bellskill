import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import { useRef } from 'react';

import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { cn } from '~/lib/utils';

export interface OverflowMenuAction {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  /** Irreversible actions render in the destructive tone, below a separator. */
  destructive?: boolean;
}

/**
 * The shared overflow menu. Every secondary and destructive action for a row or
 * card lives here so the surface can lead with a single primary control —
 * destructive actions sit behind a deliberate second tap, below a separator.
 */
export const OverflowMenu = ({
  actions,
  menuLabel,
  triggerClassName,
}: {
  actions: OverflowMenuAction[];
  /** Names the thing being acted on, e.g. a program or session title. */
  menuLabel: string;
  /** Retones the ⋯ for surfaces that aren't the default card background. */
  triggerClassName?: string;
}) => {
  // Every action here either navigates or opens a dialog, so restoring focus to
  // the trigger on close would yank it straight back out of what just opened.
  // Suppress the restore for selections only — Escape still returns to the ⋯.
  const selectedRef = useRef(false);

  if (actions.length === 0) return null;

  const safeActions = actions.filter((action) => !action.destructive);
  const destructiveActions = actions.filter((action) => action.destructive);

  const select = (action: OverflowMenuAction) => () => {
    selectedRef.current = true;
    // Let the menu finish closing before the action runs. Several of these open
    // a dialog, and a dialog that mounts mid-close fights the menu's focus
    // scope for the active element — they trade it back and forth forever.
    window.setTimeout(action.onSelect, 0);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            '-mr-0.5 -mt-0.5 shrink-0 text-muted-foreground',
            triggerClassName,
          )}
          aria-label={`More actions for ${menuLabel}`}
        >
          <EllipsisHorizontalIcon className="h-2.5 w-2.5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onCloseAutoFocus={(event) => {
          if (selectedRef.current) event.preventDefault();
          selectedRef.current = false;
        }}
      >
        {safeActions.map((action) => (
          <DropdownMenuItem
            key={action.label}
            disabled={action.disabled}
            onSelect={select(action)}
          >
            {action.label}
          </DropdownMenuItem>
        ))}
        {safeActions.length > 0 && destructiveActions.length > 0 && (
          <DropdownMenuSeparator />
        )}
        {destructiveActions.map((action) => (
          <DropdownMenuItem
            key={action.label}
            destructive
            disabled={action.disabled}
            onSelect={select(action)}
          >
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
