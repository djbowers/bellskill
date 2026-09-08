import { SKILL_LEVELS, SKILL_NODES, SKILL_NODE_BY_ID } from './skillTree';

const NODE_ID = /^L([1-9])-(N|M)\d+$/;

describe('skill tree node map', () => {
  test('holds the 37 nodes of spec v2 across nine levels', () => {
    expect(SKILL_NODES).toHaveLength(37);
    expect(SKILL_LEVELS.map((l) => l.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  test('ids are unique and encode their level', () => {
    const ids = SKILL_NODES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const n of SKILL_NODES) {
      const match = n.id.match(NODE_ID);
      expect(match, n.id).not.toBeNull();
      expect(Number(match![1])).toBe(n.level);
    }
  });

  test('every prerequisite exists, is not the node itself, and sits at or below its level', () => {
    for (const n of SKILL_NODES) {
      for (const prereqId of n.prereqs) {
        const prereq = SKILL_NODE_BY_ID.get(prereqId);
        expect(prereq, `${n.id} → ${prereqId}`).toBeDefined();
        expect(prereqId).not.toBe(n.id);
        expect(prereq!.level).toBeLessThanOrEqual(n.level);
      }
    }
  });

  test('the prerequisite graph has no cycles', () => {
    const visiting = new Set<string>();
    const done = new Set<string>();
    const visit = (id: string) => {
      if (done.has(id)) return;
      expect(visiting.has(id), `cycle through ${id}`).toBe(false);
      visiting.add(id);
      for (const p of SKILL_NODE_BY_ID.get(id)!.prereqs) visit(p);
      visiting.delete(id);
      done.add(id);
    };
    for (const n of SKILL_NODES) visit(n.id);
  });

  test('levels 2–9 each open with exactly one mobility node; level 1 has none', () => {
    for (const { level } of SKILL_LEVELS) {
      const mobility = SKILL_NODES.filter(
        (n) => n.level === level && n.kind === 'mobility',
      );
      expect(mobility, `level ${level}`).toHaveLength(level === 1 ? 0 : 1);
    }
  });

  test('every node names at least one skill and a benchmark', () => {
    for (const n of SKILL_NODES) {
      expect(n.skills.length, n.id).toBeGreaterThan(0);
      expect(n.benchmark.trim().length, n.id).toBeGreaterThan(0);
    }
  });
});
