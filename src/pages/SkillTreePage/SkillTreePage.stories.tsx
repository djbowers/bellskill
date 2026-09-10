import { SkillNodeProgressRow } from '~/api';
import { SKILL_LEVELS, SKILL_NODES } from '~/config/skillTree';
import { LoadEdge } from '~/utils';

import { LevelSection } from './components/LevelSection';
import { NodeCard } from './components/NodeCard';
import { NodeDialog } from './components/NodeDialog';
import { deriveNodeStates, groupByLevel } from './utils/deriveNodeStates';

/**
 * Static compositions — no network, no providers — so each node state is
 * inspectable on its own and cheap to screenshot for a PR gallery.
 */
export default {
  title: 'Pages/SkillTreePage',
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

const rows: SkillNodeProgressRow[] = [
  { nodeId: 'L1-N1', status: 'complete', completedAt: '2026-09-01T00:00:00Z' },
  { nodeId: 'L1-N2', status: 'active', completedAt: null },
];

// A lifter mid-ladder: swinging 16kg toward 24kg, already snatching 24kg.
const edges = new Map<string, LoadEdge>([
  ['L2-N2', { edgeKg: 16, reachedAt: new Date('2026-08-30T00:00:00Z') }],
  ['L8-N1', { edgeKg: 24, reachedAt: new Date('2026-07-04T00:00:00Z') }],
]);

const movementsByNodeId = new Map<string, string[]>([
  ['L2-N2', ['Kettlebell Swing']],
  [
    'L8-N1',
    ['One-Arm Kettlebell Snatch', 'Kettlebell Dead Snatch', 'Kettlebell Hang Snatch'],
  ],
]);

const derived = deriveNodeStates(SKILL_NODES, rows, edges);
const noop = () => {};
const dialogProps = {
  derivedById: derived,
  movementsByNodeId,
  isPending: false,
  onClose: noop,
  onStart: noop,
  onPass: noop,
  onUndo: noop,
};

export const NodeCardStates = {
  render: () => (
    <div className="flex max-w-md flex-col gap-1 p-3">
      {['L1-N1', 'L1-N2', 'L1-N3', 'L1-N4', 'L2-M1'].map((id) => (
        <NodeCard key={id} derived={derived.get(id)!} onSelect={noop} />
      ))}
    </div>
  ),
};

export const LevelInProgress = {
  render: () => (
    <div className="max-w-md p-3">
      <LevelSection
        summary={groupByLevel(derived, SKILL_LEVELS)[0]}
        onSelect={noop}
      />
    </div>
  ),
};

export const NodeDialogLocked = {
  render: () => <NodeDialog {...dialogProps} derived={derived.get('L1-N4')!} />,
};

export const NodeDialogActive = {
  render: () => <NodeDialog {...dialogProps} derived={derived.get('L1-N2')!} />,
};

export const NodeDialogComplete = {
  render: () => <NodeDialog {...dialogProps} derived={derived.get('L1-N1')!} />,
};

export const NodeCardLoadEdges = {
  render: () => (
    <div className="flex max-w-md flex-col gap-1 p-3">
      {['L2-N2', 'L3-N1', 'L8-N1'].map((id) => (
        <NodeCard key={id} derived={derived.get(id)!} onSelect={noop} />
      ))}
    </div>
  ),
};

/** Passed by the logs rather than by hand: a ladder, a date, and no Undo. */
export const NodeDialogPassedFromLogs = {
  render: () => <NodeDialog {...dialogProps} derived={derived.get('L8-N1')!} />,
};

export const NodeDialogClimbing = {
  render: () => <NodeDialog {...dialogProps} derived={derived.get('L2-N2')!} />,
};
