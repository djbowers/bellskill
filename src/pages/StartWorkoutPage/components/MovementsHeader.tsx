export const MovementsHeader = ({ count }: { count: number }) => {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Movements
      </h2>
      <span className="text-xs text-muted-foreground" aria-label={`${count} movements`}>
        {count}
      </span>
    </div>
  );
};
