import { describe, expect, it } from 'vitest';

import {
  type SkillProgressRow,
  summarizeSkillTree,
} from '../../../src/utils/skillTreeProgress.ts';
import {
  formatNodeTitles,
  formatSkillNodeAnnotation,
  formatSkillTreeSection,
} from './skillTreeInput.ts';

const row = (
  nodeId: string,
  status: SkillProgressRow['status'],
): SkillProgressRow => ({
  nodeId,
  status,
  completedAt: status === 'complete' ? '2026-09-01T00:00:00Z' : null,
});

const beginner = summarizeSkillTree([
  row('L1-N1', 'complete'),
  row('L1-N2', 'complete'),
  row('L1-N3', 'complete'),
  row('L2-N2', 'active'),
]);

describe('formatSkillTreeSection', () => {
  it('is empty without a summary', () => {
    expect(formatSkillTreeSection(null)).toBe('');
  });

  it('lists passed nodes per level, practising nodes with their benchmark, and ready movement nodes', () => {
    const text = formatSkillTreeSection(beginner);
    expect(text).toContain('SKILL TREE');
    expect(text).toContain(
      '- Foundation 3/6: Breathing & bracing, Hip hinge pattern, Goblet squat',
    );
    expect(text).not.toContain('First load 0/4');
    expect(text).toContain(
      '- Two-hand swing (First load): hip drive initiation, float at top, safe backswing, breathing rhythm. Benchmark: 20 consecutive reps at 30% BW',
    );
    expect(text).toContain('Ready to start: Deadbug, Grip & wrist prep, Single leg balance, Kettlebell deadlift');
    expect(text).not.toContain('Hip flexor & ankle prep');
    expect(text).toContain('not yet in reach');
  });

  it('never says debt or locked', () => {
    expect(formatSkillTreeSection(beginner)).not.toMatch(/debt|locked/i);
  });
});

describe('formatSkillNodeAnnotation', () => {
  it('annotates in-reach nodes with their title and state', () => {
    expect(formatSkillNodeAnnotation(beginner, 'L2-N2')).toBe(
      ' · practises: Two-hand swing (practising)',
    );
    expect(formatSkillNodeAnnotation(beginner, 'L1-N3')).toBe(
      ' · practises: Goblet squat (passed)',
    );
    expect(formatSkillNodeAnnotation(beginner, 'L2-N1')).toBe(
      ' · practises: Kettlebell deadlift (ready)',
    );
  });

  it('is empty without a summary, a node, an in-reach state, or a known id', () => {
    expect(formatSkillNodeAnnotation(null, 'L2-N2')).toBe('');
    expect(formatSkillNodeAnnotation(beginner, null)).toBe('');
    expect(formatSkillNodeAnnotation(beginner, 'L8-N1')).toBe('');
    expect(formatSkillNodeAnnotation(beginner, 'L0-N9')).toBe('');
  });
});

describe('formatNodeTitles', () => {
  it('joins titles and falls back to the id', () => {
    expect(formatNodeTitles(['L7-N1', 'L7-N2', 'L0-N9'])).toBe(
      'Double clean, Double front squat, L0-N9',
    );
  });
});
