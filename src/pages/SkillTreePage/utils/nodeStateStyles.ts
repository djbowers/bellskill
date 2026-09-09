import { NodeState } from './deriveNodeStates';

export const NODE_STATE_LABELS: Record<NodeState, string> = {
  complete: 'Passed',
  active: 'Practicing',
  available: 'Ready',
  locked: 'Locked',
};

// Mirrors the session-chip vocabulary on ProgramProgressPage: settled, raised,
// actionable, or flat — so "what can I tap" reads without a label.
export const NODE_STATE_STYLES: Record<NodeState, string> = {
  complete: 'border-transparent bg-primary/10 text-foreground',
  active: 'border-primary bg-primary/5 text-foreground shadow-sm',
  available:
    'border-border bg-card text-foreground shadow-sm hover:border-primary hover:bg-primary/5 active:translate-y-px',
  locked: 'border-border/60 bg-transparent text-muted-foreground',
};
