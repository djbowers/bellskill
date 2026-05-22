import { useEffect, useRef, useState } from 'react';

import { useCreateUserMovement } from '~/api/useCreateUserMovement';
import { useMovementSearch } from '~/api/useMovementSearch';
import { useUserMovements } from '~/api/useUserMovements';
import { cn } from '~/lib/utils';

interface MovementAutocompleteProps {
  value: string;
  onChange: (name: string) => void;
  autoFocus?: boolean;
  className?: string;
}

export const MovementAutocomplete = ({
  value,
  onChange,
  autoFocus,
  className,
}: MovementAutocompleteProps) => {
  const [inputValue, setInputValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external value changes (e.g., when parent resets the field)
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const { data: recentMovements = [] } = useUserMovements();
  const { data: catalogResults = [] } = useMovementSearch(inputValue);
  const createUserMovement = useCreateUserMovement();

  const filteredRecent =
    inputValue.length >= 1
      ? recentMovements.filter((m) =>
          m.canonicalName.toLowerCase().includes(inputValue.toLowerCase()),
        )
      : recentMovements.slice(0, 8);

  const catalogNames = new Set(filteredRecent.map((m) => m.canonicalName.toLowerCase()));
  const uniqueCatalog = catalogResults.filter(
    (m) => !catalogNames.has(m.name.toLowerCase()),
  );

  const hasOptions = filteredRecent.length > 0 || uniqueCatalog.length > 0;
  const showCustomEntry =
    inputValue.length > 0 &&
    !filteredRecent.some(
      (m) => m.canonicalName.toLowerCase() === inputValue.toLowerCase(),
    );

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

  return (
    <div ref={containerRef} className="relative w-full">
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

          {uniqueCatalog.length > 0 && (
            <>
              {filteredRecent.length > 0 && (
                <li className="px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  From catalog
                </li>
              )}
              {uniqueCatalog.map((movement) => (
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
