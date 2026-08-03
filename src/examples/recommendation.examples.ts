import type { ProgramRecommendation, Recommendation } from '~/types';

/**
 * A realistic recommendation for tests, stories, and the free-user preview
 * modal. Defaults model a short, S&S-flavored session; override any field.
 */
export class ExampleRecommendation implements Recommendation {
  rationale: Recommendation['rationale'];
  duration_minutes: Recommendation['duration_minutes'];
  format: Recommendation['format'];
  confidence: Recommendation['confidence'];
  blocks: Recommendation['blocks'];

  constructor({
    rationale = 'You logged a heavy press day yesterday, so today leans into hip power and a light skill check. Swings build the posterior chain without taxing your shoulders, and a single get-up each side keeps stability sharp.',
    duration_minutes = 20,
    format = 'Straight Sets',
    confidence = 'medium',
    blocks = [
      {
        user_movement_id: 'example-swing',
        movement_name: 'Two-Hand Swing',
        weight_kg: 24,
        rep_scheme: [10, 10, 10],
        notes: 'Sharp hip snap, stop if form degrades.',
      },
      {
        user_movement_id: 'example-getup',
        movement_name: 'Turkish Get-Up',
        weight_kg: 16,
        rep_scheme: [1, 1],
        notes: 'Slow and deliberate, one each side.',
      },
    ],
  }: Partial<Recommendation> = {}) {
    this.rationale = rationale;
    this.duration_minutes = duration_minutes;
    this.format = format;
    this.confidence = confidence;
    this.blocks = blocks;
  }
}

/**
 * A realistic program recommendation for tests and stories. Defaults model an
 * easy strength program queued behind a running conditioning block.
 */
export class ExampleProgramRecommendation implements ProgramRecommendation {
  program_id: ProgramRecommendation['program_id'];
  mode: ProgramRecommendation['mode'];
  rationale: ProgramRecommendation['rationale'];
  confidence: ProgramRecommendation['confidence'];

  constructor({
    program_id = 'example-easy-strength',
    mode = 'queue',
    rationale = 'Your pull and carry patterns are the most undertrained, and Easy Strength hits both without adding recovery load. Your current program fills your recovery budget, so queue this to start the day it finishes.',
    confidence = 'medium',
  }: Partial<ProgramRecommendation> = {}) {
    this.program_id = program_id;
    this.mode = mode;
    this.rationale = rationale;
    this.confidence = confidence;
  }
}
