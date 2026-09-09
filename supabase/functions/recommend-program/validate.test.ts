import type {
  CandidateProgram,
  ProgramRecommendation,
  RecommenderInputs,
} from './types.ts';
import { ValidationError, validateRecommendation } from './validate.ts';

const candidate = (
  program_id: string,
  over: Partial<CandidateProgram> = {},
): CandidateProgram => ({
  program_id,
  title: program_id,
  description: null,
  focus_tags: [],
  modality_profile: [],
  systemic_demand: null,
  session_count: 10,
  stack_fit: null,
  skill_reach: { verdict: 'within_reach', out_of_reach_nodes: [] },
  ...over,
});

const inputs = (over: Partial<RecommenderInputs> = {}): RecommenderInputs => ({
  training_goal: null,
  days_since_last_workout: null,
  slots_available: 3,
  active_programs: [],
  queued_programs: [],
  candidates: [candidate('ss'), candidate('abc')],
  pattern_debt: { overall_balance: 'balanced', patterns: [] },
  modality_debt: null,
  recent_history: [],
  equipment: null,
  skill_tree: null,
  ...over,
});

const pick = (
  program_id: string,
  mode: ProgramRecommendation['mode'] = 'concurrent',
): ProgramRecommendation => ({
  program_id,
  mode,
  rationale: 'because',
  confidence: 'high',
});

const reasonsOf = (rec: ProgramRecommendation, given: RecommenderInputs) => {
  try {
    validateRecommendation(rec, given);
    return [];
  } catch (err) {
    if (err instanceof ValidationError) return err.reasons;
    throw err;
  }
};

const stretch = (program_id: string, nodes: string[]) =>
  candidate(program_id, {
    title: 'Armor Building Complex',
    skill_reach: { verdict: 'stretch', out_of_reach_nodes: nodes },
  });

describe('validateRecommendation — skill ceiling', () => {
  test('rejects a stretch pick while a within-reach candidate exists, naming the skills', () => {
    const given = inputs({
      candidates: [candidate('ss'), stretch('abc', ['L7-N1', 'L7-N2'])],
    });
    expect(reasonsOf(pick('abc'), given)).toEqual([
      "Armor Building Complex stretches beyond the lifter's skill frontier (Double clean, Double front squat) — pick a candidate whose skills are within reach",
    ]);
  });

  test('accepts a stretch pick when every candidate stretches', () => {
    const given = inputs({
      candidates: [stretch('abc', ['L7-N1']), stretch('dfw', ['L7-N3'])],
    });
    expect(reasonsOf(pick('abc'), given)).toEqual([]);
  });

  test('is a no-op when the lifter has no tree', () => {
    expect(reasonsOf(pick('abc'), inputs())).toEqual([]);
  });
});

describe('validateRecommendation — existing rules', () => {
  test('rejects an id outside the candidate list', () => {
    expect(reasonsOf(pick('nope'), inputs())).toEqual([
      'program_id "nope" is not in the candidate list',
    ]);
  });

  test('rejects concurrent with no open slot', () => {
    expect(reasonsOf(pick('ss'), inputs({ slots_available: 0 }))[0]).toMatch(
      /requires an open program slot/,
    );
  });

  test('rejects queue with nothing active or queued', () => {
    expect(reasonsOf(pick('ss', 'queue'), inputs())[0]).toMatch(
      /makes no sense with nothing active/,
    );
  });
});
