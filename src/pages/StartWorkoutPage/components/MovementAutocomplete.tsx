import { useEffect, useRef, useState } from 'react';

import { useCreateUserMovement } from '~/api/useCreateUserMovement';
import { useMovementSearch } from '~/api/useMovementSearch';
import { useUserMovementFrequency } from '~/api/useUserMovementFrequency';
import { cn } from '~/lib/utils';
import { WeightTabValue } from '~/types';
import { rankMovements, recentMovementMatchesWeightMode, movementNameMatchesSearchTokens, tokenizeMovementSearchQuery, WEIGHT_MODE_LABELS } from '~/utils';

import { WeightModeTabs } from './WeightModeTabs';

interface MovementAutocompleteProps {
  value: string;
  onChange: (name: string) => void;
  weightMode: WeightTabValue;
  onWeightModeChange: (mode: WeightTabValue) => void;
  weightSummary?: string | null;
  showWeightModeTabs?: boolean;
  weightModeHint?: string | null;
  autoFocus?: boolean;
  className?: string;
}

export const MovementAutocomplete = ({
  value,
  onChange,
  weightMode,
  onWeightModeChange,
  weightSummary = null,
  showWeightModeTabs = true,
  weightModeHint = null,
  autoFocus,
  className,
}: MovementAutocompleteProps) => {
  const [inputValue, setInputValue] = useState(value);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
    setDebouncedSearchQuery(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(inputValue), 150);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const { data: frequentMovements = [] } = useUserMovementFrequency();
  const {
    data: catalogResults = [],
    isFetching: isCatalogFetching,
    isLoading: isCatalogLoading,
  } = useMovementSearch(debouncedSearchQuery, weightMode);
  const createUserMovement = useCreateUserMovement();

  const frequentNames = new Set(
    frequentMovements.map((m) => m.canonicalName.toLowerCase()),
  );

  const weightModeFilteredRecent = frequentMovements.filter((m) =>
    recentMovementMatchesWeightMode(m.catalogWeightFields, weightMode),
  );

  const searchTokens = tokenizeMovementSearchQuery(inputValue);

  const filteredRecentMatches =
    inputValue.length >= 1
      ? weightModeFilteredRecent.filter((m) =>
          movementNameMatchesSearchTokens(m.canonicalName, searchTokens),
        )
      : weightModeFilteredRecent.slice(0, 8);

  const filteredRecent =
    inputValue.length >= 1
      ? rankMovements(
          filteredRecentMatches.map((movement) => ({
            ...movement,
            name: movement.canonicalName,
          })),
          inputValue,
          frequentNames,
        )
      : filteredRecentMatches;

  const catalogNames = new Set(filteredRecent.map((m) => m.canonicalName.toLowerCase()));
  const uniqueCatalog = catalogResults.filter(
    (m) => !catalogNames.has(m.name.toLowerCase()),
  );
  const rankedCatalog =
    inputValue.length >= 2
      ? rankMovements(uniqueCatalog, inputValue, frequentNames).slice(0, 20)
      : uniqueCatalog;

  const catalogSearched = debouncedSearchQuery.length >= 2;
  const catalogSearchPending = isCatalogLoading || isCatalogFetching;
  const showCatalogEmpty =
    catalogSearched && rankedCatalog.length === 0 && !catalogSearchPending;

  const showCustomEntry =
    inputValue.length > 0 &&
    !filteredRecent.some(
      (m) => m.canonicalName.toLowerCase() === inputValue.toLowerCase(),
    );

  const hasOptions =
    filteredRecent.length > 0 || rankedCatalog.length > 0 || showCatalogEmpty;

  const catalogSectionLabel = `Catalog (${WEIGHT_MODE_LABELS[weightMode]})`;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
    setIsOpen(true);
  };

  const handleWeightModeChange = (mode: WeightTabValue) => {
    onWeightModeChange(mode);
    setIsOpen(true);
  };

  const handleSelect = (name: string, functionalMovementId?: string | null) => {
    setInputValue(name);
    onChange(name);
    setIsOpen(false);
    createUserMovement.mutate({ canonicalName: name, functionalMovementId });
  };

  const handleCustomEntry = () => {
    createUserMovement.mutate({ canonicalName: inputValue });
    setIsOpen(false);
  };

  const showDropdown = isOpen && (hasOptions || showCustomEntry);
  const showSummaryChip = value.length > 0 && weightSummary && !isOpen;

  return (
    <div ref={containerRef} className="relative w-full">
      {showWeightModeTabs && (
        <WeightModeTabs
          value={weightMode}
          onValueChange={handleWeightModeChange}
          className="mb-1"
        />
      )}

      {weightModeHint && (
        <p className="mb-1 text-xs text-muted-foreground">{weightModeHint}</p>
      )}

      <input
        aria-label="Movement Input"
        autoFocus={autoFocus}
        autoComplete="off"
        className={cn(
          'flex h-4 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm ring-offset-background',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
      />

      {showSummaryChip && (
        <p className="mt-1 text-xs text-muted-foreground">{weightSummary}</p>
      )}

      {showDropdown && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-0.5 max-h-[220px] overflow-y-auto rounded-md border border-input bg-background shadow-md"
        >
          {filteredRecent.length > 0 && (
            <>
              <li className="px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Recent
              </li>
              {filteredRecent.map((movement) => (
                <li
                  key={movement.id}
                  role="option"
                  aria-selected={inputValue === movement.canonicalName}
                  className="cursor-pointer px-2 py-1 text-sm hover:bg-accent hover:text-accent-foreground"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(movement.canonicalName, movement.functionalMovementId);
                  }}
                >
                  {movement.canonicalName}
                </li>
              ))}
            </>
          )}

          {rankedCatalog.length > 0 && (
            <>
              <li className="px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {catalogSectionLabel}
              </li>
              {rankedCatalog.map((movement) => (
                <li
                  key={movement.id}
                  role="option"
                  aria-selected={inputValue === movement.name}
                  className="cursor-pointer px-2 py-1 text-sm hover:bg-accent hover:text-accent-foreground"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(movement.name, movement.id);
                  }}
                >
                  {movement.name}
                </li>
              ))}
            </>
          )}

          {showCatalogEmpty && (
            <li className="px-2 py-1 text-sm text-muted-foreground">
              No {WEIGHT_MODE_LABELS[weightMode].toLowerCase()} movements for &ldquo;
              {inputValue}&rdquo; — try another mode
            </li>
          )}

          {showCustomEntry && (
            <li
              role="option"
              aria-selected={false}
              className="cursor-pointer px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(e) => {
                e.preventDefault();
                handleCustomEntry();
              }}
            >
              Use &ldquo;{inputValue}&rdquo; as custom movement
            </li>
          )}
        </ul>
      )}
    </div>
  );
};
