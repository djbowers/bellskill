import { useMemo, useState } from 'react';

import {
  useResetSkillNode,
  useSetSkillNodeStatus,
  useSkillNodeProgress,
} from '~/api';
import { Page, PageLoading } from '~/components';
import { SKILL_LEVELS, SKILL_NODES } from '~/config/skillTree';

import { LevelSection } from './components/LevelSection';
import { NodeDialog } from './components/NodeDialog';
import { deriveNodeStates, groupByLevel } from './utils/deriveNodeStates';

export const SkillTreePage = () => {
  const { data: rows, isLoading, isError } = useSkillNodeProgress();
  const setStatus = useSetSkillNodeStatus();
  const resetNode = useResetSkillNode();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const derivedById = useMemo(
    () => deriveNodeStates(SKILL_NODES, rows ?? []),
    [rows],
  );
  const levels = useMemo(
    () => groupByLevel(derivedById, SKILL_LEVELS),
    [derivedById],
  );

  if (isLoading) {
    return (
      <Page title="Skill tree">
        <PageLoading />
      </Page>
    );
  }

  if (isError) {
    return (
      <Page title="Skill tree">
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t load your progress. Try again in a moment.
        </p>
      </Page>
    );
  }

  const totalComplete = levels.reduce((sum, l) => sum + l.completeCount, 0);

  return (
    <Page title="Skill tree">
      <p className="text-xs text-muted-foreground">
        Nine levels from breathing to double snatch. Benchmarks are self-assessed
        and gates only advise — practice whatever you like.
        <span className="ml-1 font-mono tabular-nums">
          {totalComplete}/{SKILL_NODES.length}
        </span>{' '}
        passed.
      </p>

      <div className="flex flex-col gap-3">
        {levels.map((summary) => (
          <LevelSection
            key={summary.level.level}
            summary={summary}
            onSelect={setSelectedNodeId}
          />
        ))}
      </div>

      <NodeDialog
        derived={selectedNodeId ? (derivedById.get(selectedNodeId) ?? null) : null}
        derivedById={derivedById}
        isPending={setStatus.isPending || resetNode.isPending}
        onClose={() => setSelectedNodeId(null)}
        onStart={(nodeId) => setStatus.mutate({ nodeId, status: 'active' })}
        onPass={(nodeId) => setStatus.mutate({ nodeId, status: 'complete' })}
        onUndo={(nodeId) => resetNode.mutate(nodeId)}
      />
    </Page>
  );
};
