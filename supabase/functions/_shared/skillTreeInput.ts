// Shared skill-tree fetch + prompt formatting for the recommend-session and
// recommend-program prompts. Both read the same skill_node_progress rows and
// render the same section, so the models see the lifter's self-assessed
// position on the map. Says "passed / practising / ready / not yet in reach",
// never "locked": the page only advises, and the prompts should sound like a
// coach, not a game.

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  type SkillProgressRow,
  type SkillTreeSummary,
  describeNode,
  reachLabel,
  summarizeSkillTree,
} from '../../../src/utils/skillTreeProgress.ts';

const isStatus = (value: unknown): value is SkillProgressRow['status'] =>
  value === 'active' || value === 'complete';

/**
 * Best-effort: any failure degrades to null so a recommendation is never blocked
 * on the tree, matching how equipment and pattern balance degrade. Null is also
 * the answer for a lifter who has never touched the map.
 */
export async function gatherSkillTree(
  admin: SupabaseClient,
  userId: string,
): Promise<SkillTreeSummary | null> {
  try {
    const { data, error } = await admin
      .from('skill_node_progress')
      .select('node_id, status, completed_at')
      .eq('user_id', userId);
    if (error) throw error;

    const rows: SkillProgressRow[] = (data ?? []).flatMap(
      (row: Record<string, unknown>) =>
        isStatus(row.status)
          ? [
              {
                nodeId: String(row.node_id),
                status: row.status,
                completedAt:
                  row.completed_at == null ? null : String(row.completed_at),
              },
            ]
          : [],
    );

    return summarizeSkillTree(rows);
  } catch (err) {
    console.error('skill tree fetch failed:', err);
    return null;
  }
}

const titleOf = (nodeId: string) => describeNode(nodeId)?.title ?? nodeId;

/** `Double clean, Double front squat` — for reasons and stretch annotations. */
export function formatNodeTitles(nodeIds: readonly string[]): string {
  return nodeIds.map(titleOf).join(', ');
}

/** Renders the prompt section, or '' when the lifter has no progress on the map. */
export function formatSkillTreeSection(
  summary: SkillTreeSummary | null,
): string {
  if (!summary) return '';

  const lines = [
    'SKILL TREE (their self-assessed map of kettlebell competence; each level',
    'builds on the ones below it)',
  ];

  const passedByLevel = summary.levels
    .filter((level) => level.passed > 0)
    .map((level) => {
      const titles = summary.passed
        .map(describeNode)
        .filter((node) => node?.level === level.level)
        .map((node) => node!.title)
        .join(', ');
      return `- ${level.title} ${level.passed}/${level.total}: ${titles}`;
    });
  lines.push('Passed:');
  lines.push(...(passedByLevel.length ? passedByLevel : ['- (nothing yet)']));

  const practising = summary.practicing.map(describeNode).flatMap((node) =>
    node
      ? [
          `- ${node.title} (${node.levelTitle}): ${node.skills
            .map((skill) => skill.charAt(0).toLowerCase() + skill.slice(1))
            .join(', ')}. Benchmark: ${node.benchmark}`,
        ]
      : [],
  );
  lines.push('Practising now:');
  lines.push(...(practising.length ? practising : ['- (nothing yet)']));

  const ready = summary.ready
    .map(describeNode)
    .filter((node) => node?.kind === 'movement')
    .map((node) => node!.title);
  lines.push(
    `Ready to start: ${ready.length ? ready.join(', ') : '(nothing yet)'}`,
  );

  lines.push(
    'Everything else on the map is not yet in reach; the catalog below only',
    'lists movements that are.',
  );

  return lines.join('\n');
}

/** ` · practises: Two-hand swing (practising)`, or '' when it says nothing useful. */
export function formatSkillNodeAnnotation(
  summary: SkillTreeSummary | null,
  nodeId: string | null | undefined,
): string {
  if (!summary || !nodeId) return '';
  const label = reachLabel(summary, nodeId);
  const node = describeNode(nodeId);
  if (!label || !node) return '';
  const word = label === 'practicing' ? 'practising' : label;
  return ` · practises: ${node.title} (${word})`;
}
