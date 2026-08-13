import { useState } from 'react';

import { CatalogMovement } from '~/api';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  movementNameMatchesSearchTokens,
  rankMovements,
  suggestCatalogMatch,
  tokenizeMovementSearchQuery,
} from '~/utils';

export interface LinkMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canonicalName: string;
  logCount: number;
  catalog: CatalogMovement[];
  isPending: boolean;
  onLink: (functionalMovementId: string) => void;
}

const MAX_SEARCH_RESULTS = 6;

const LinkMovementForm = ({
  canonicalName,
  logCount,
  catalog,
  isPending,
  onLink,
  onOpenChange,
}: Omit<LinkMovementDialogProps, 'open'>) => {
  const [searchQuery, setSearchQuery] = useState('');

  const suggestion = suggestCatalogMatch(canonicalName, catalog);

  const searchTokens = tokenizeMovementSearchQuery(searchQuery);
  const searchResults =
    searchQuery.length >= 2
      ? rankMovements(
          catalog.filter((movement) =>
            movementNameMatchesSearchTokens(movement.name, searchTokens),
          ),
          searchQuery,
          new Set<string>(),
        ).slice(0, MAX_SEARCH_RESULTS)
      : [];

  return (
    <>
      <DialogHeader>
        <DialogTitle>Link &ldquo;{canonicalName}&rdquo;</DialogTitle>
        <DialogDescription>
          Linking pulls in the catalog&rsquo;s pattern, equipment, and
          difficulty.
          {logCount > 0 &&
            ` Your ${logCount} ${logCount === 1 ? 'log' : 'logs'} stay attached and pick up that metadata retroactively.`}
        </DialogDescription>
      </DialogHeader>

      {suggestion && (
        <div className="flex flex-col gap-0.5">
          <Label>Suggested match</Label>
          <div className="flex items-center justify-between gap-2 rounded-md border border-input px-2 py-1">
            <span className="text-sm">{suggestion.name}</span>
            <Button
              size="sm"
              disabled={isPending}
              onClick={() => onLink(suggestion.id)}
            >
              Link
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-0.5">
        <Label htmlFor="link-movement-search">
          {suggestion ? 'Or pick another movement' : 'Find a movement'}
        </Label>
        <Input
          id="link-movement-search"
          autoFocus={!suggestion}
          placeholder="Search the catalog..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        {searchResults.length > 0 && (
          <ul className="mt-0.5 divide-y rounded-md border border-input">
            {searchResults.map((movement) => (
              <li key={movement.id}>
                <button
                  type="button"
                  disabled={isPending}
                  className="w-full px-2 py-1 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  onClick={() => onLink(movement.id)}
                >
                  {movement.name}
                </button>
              </li>
            ))}
          </ul>
        )}

        {searchQuery.length >= 2 && searchResults.length === 0 && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            No catalog movements match &ldquo;{searchQuery}&rdquo;.
          </p>
        )}
      </div>

      <DialogFooter>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
      </DialogFooter>
    </>
  );
};

/**
 * The form is remounted on each open (`open &&`) so the search box resets
 * instead of carrying a stale query over to the next movement.
 */
export const LinkMovementDialog = ({
  open,
  ...props
}: LinkMovementDialogProps) => (
  <Dialog open={open} onOpenChange={props.onOpenChange}>
    <DialogContent>{open && <LinkMovementForm {...props} />}</DialogContent>
  </Dialog>
);
