import { LevelSummary } from '../utils/deriveNodeStates';
import { NodeCard } from './NodeCard';

interface LevelSectionProps {
  summary: LevelSummary;
  onSelect: (nodeId: string) => void;
}

export const LevelSection = ({ summary, onSelect }: LevelSectionProps) => {
  const { level, nodes, completeCount, totalCount } = summary;
  const headingId = `skill-level-${level.level}`;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-1">
        <h2 id={headingId} className="text-sm font-semibold">
          Level {level.level} · {level.title}
        </h2>
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {completeCount} of {totalCount} nodes complete
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{level.theme}</p>
      <div className="flex flex-col gap-0.5">
        {nodes.map((derived) => (
          <NodeCard key={derived.node.id} derived={derived} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
};
