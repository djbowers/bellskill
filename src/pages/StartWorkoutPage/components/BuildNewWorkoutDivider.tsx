import { Separator } from '~/components/ui/separator';

export const BuildNewWorkoutDivider = () => {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <Separator className="flex-1" />
      <span className="whitespace-nowrap text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Build new workout
      </span>
      <Separator className="flex-1" />
    </div>
  );
};
