import { ArrowLeftIcon } from '@heroicons/react/24/outline';

import { Input } from '~/components/ui/input';

/**
 * The builder's pinned nav bar: escape hatch plus the workout title, both
 * within thumb reach no matter how far the movement list has scrolled. The
 * negative margins cancel `Page`'s padding so the bar bleeds to the page edges,
 * and `safe-area-top` paints its own notch inset — once pinned, the page
 * padding that would otherwise cover it has scrolled away.
 */
export const BuilderHeaderBar = ({
  onBack,
  showBack,
  title,
  onChangeTitle,
}: {
  onBack: () => void;
  showBack: boolean;
  title: string;
  onChangeTitle: (title: string) => void;
}) => {
  return (
    <div className="safe-area-top sticky top-0 z-20 -mx-3 -mt-3 bg-card">
      <div className="flex flex-col gap-0.5 border-b border-border px-3 pb-1 pt-3">
        {showBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-0.5 self-start text-xs font-medium text-muted-foreground"
          >
            <ArrowLeftIcon className="h-2 w-2" aria-hidden="true" />
            Home
          </button>
        )}

        <Input
          className="h-auto border-0 bg-transparent px-0 py-0.5 text-lg font-bold shadow-none placeholder:font-semibold placeholder:text-muted-foreground focus-visible:ring-0"
          value={title}
          onChange={(e) => onChangeTitle(e.target.value)}
          placeholder="Untitled workout"
          aria-label="Workout title"
        />
      </div>
    </div>
  );
};
