import { useState } from 'react';

import { CatalogMovement } from '~/api';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  movementNameMatchesSearchTokens,
  rankMovements,
  suggestCatalogMatch,
  tokenizeMovementSearchQuery,
} from '~/utils';

export interface CustomMovementRowProps {
  id: string;
  canonicalName: string;
  logCount: number;
  catalog: CatalogMovement[];
  isLinking: boolean;
  onLink: (userMovementId: string, functionalMovementId: string) => void;
}

const MAX_SEARCH_RESULTS = 6;

export const CustomMovementRow = ({
  id,
  canonicalName,
  logCount,
  catalog,
  isLinking,
  onLink,
}: CustomMovementRowProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

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
    <div className="flex flex-col gap-1 px-2 py-2">
      <div className="flex flex-wrap items-center justify-between gap-1">
        <span className="flex items-center gap-1">
          <span className="text-sm">{canonicalName}</span>
          <Badge variant="secondary" className="text-[10px]">
            Custom
          </Badge>
        </span>
        <span className="text-xs text-muted-foreground">
          {logCount} {logCount === 1 ? 'log' : 'logs'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {suggestion && !isSearching && (
          <Button
            size="sm"
            disabled={isLinking}
            onClick={() => onLink(id, suggestion.id)}
          >
            Link to {suggestion.name}
          </Button>
        )}

        {!isSearching && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsSearching(true)}
          >
            {suggestion ? 'Pick another' : 'Find a match'}
          </Button>
        )}
      </div>

      {isSearching && (
        <div className="flex flex-col gap-1">
          <Input
            autoFocus
            aria-label={`Search catalog for ${canonicalName}`}
            placeholder="Search the catalog..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchResults.length > 0 && (
            <ul className="rounded-md border border-input">
              {searchResults.map((movement) => (
                <li key={movement.id}>
                  <button
                    type="button"
                    disabled={isLinking}
                    className="w-full px-2 py-1 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                    onClick={() => onLink(id, movement.id)}
                  >
                    {movement.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {searchQuery.length >= 2 && searchResults.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No catalog movements match &ldquo;{searchQuery}&rdquo;.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
