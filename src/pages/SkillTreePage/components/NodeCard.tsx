import { Badge } from '~/components/ui/badge';
import { cn } from '~/lib/utils';

import { DerivedNode } from '../utils/deriveNodeStates';
import { formatLoadEdge } from '../utils/formatLoadEdge';
import { NODE_STATE_LABELS, NODE_STATE_STYLES } from '../utils/nodeStateStyles';

interface NodeCardProps {
  derived: DerivedNode;
  onSelect: (nodeId: string) => void;
}

export const NodeCard = ({ derived, onSelect }: NodeCardProps) => {
  const { node, state, load } = derived;
  const stateLabel = NODE_STATE_LABELS[state];
  const edge = load ? formatLoadEdge(load) : null;

  return (
    <button
      type="button"
      data-state={state}
      aria-label={
        edge
          ? `${node.title}, ${stateLabel.toLowerCase()}, ${edge}`
          : `${node.title}, ${stateLabel.toLowerCase()}`
      }
      onClick={() => onSelect(node.id)}
      className={cn(
        'flex w-full items-center justify-between gap-1 rounded-md border px-2 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        NODE_STATE_STYLES[state],
      )}
    >
      <span className="flex min-w-0 items-center gap-1">
        <span className="truncate font-medium">{node.title}</span>
        {node.kind === 'mobility' && (
          <Badge variant="outline" className="shrink-0">
            Mobility
          </Badge>
        )}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {edge ? (
          <span className="font-mono tabular-nums">{edge}</span>
        ) : (
          stateLabel
        )}
      </span>
    </button>
  );
};
