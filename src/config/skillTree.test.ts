import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parseCsv } from '../../scripts/ingest-movements.mjs';
import { BELL_LADDER_KG } from '~/utils';

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

describe('load-scaled nodes', () => {
  const rows = parseCsv(
    readFileSync(resolve(__dirname, '../../scripts/data/movements.csv'), 'utf8'),
  ) as string[][];
  const header = rows[0];
  const nodeColumn = header.indexOf('Skill Node');
  const equipmentColumn = header.indexOf('Primary Equipment');

  const loaded = SKILL_NODES.filter((n) => n.targetKg !== undefined);

  test('every target is a rung on the bell ladder', () => {
    for (const n of loaded) {
      expect(BELL_LADDER_KG, n.id).toContain(n.targetKg);
    }
  });

  test('every target has at least one kettlebell movement mapped to it', () => {
    const kettlebellNodes = new Set(
      rows
        .slice(1)
        .filter((row) => row[equipmentColumn] === 'Kettlebell')
        .map((row) => row[nodeColumn])
        .filter(Boolean),
    );

    for (const n of loaded) {
      expect(kettlebellNodes, `${n.id} has a target but no movement`).toContain(
        n.id,
      );
    }
  });

  test('nodes without a target are the ones no bell measures', () => {
    const unloaded = SKILL_NODES.filter((n) => n.targetKg === undefined).map(
      (n) => n.id,
    );
    expect(unloaded).toEqual([
      // Bodyweight and awareness work.
      'L1-N1',
      'L1-N2',
      'L1-N4',
      'L1-N6',
      // Pure mobility and reassessment checkpoints.
      'L2-M1',
      'L3-M1',
      'L4-M1',
      'L5-M1',
      'L6-M1',
      'L7-M1',
      'L8-M1',
      'L9-M1',
      // Explicitly unloaded in the spec: a shoe balanced on the fist.
      'L5-N1',
      // No catalog movement maps here yet; Clean and Press currently maps to
      // L4-N3, which the mapping PR flags as a judgment call.
      'L8-N2',
    ].sort((a, b) => SKILL_NODES.findIndex((n) => n.id === a) - SKILL_NODES.findIndex((n) => n.id === b)));
  });
});
