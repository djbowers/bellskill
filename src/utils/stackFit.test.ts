import { Program, ProgramFocusTag, ProgramSystemicDemand } from '~/types';

import { assessStackFit } from './stackFit';

/** A program carrying only the fields the fit model reads. */
const program = (
  title: string,
  focusTags: ProgramFocusTag[],
  systemicDemand: ProgramSystemicDemand | null,
): Program =>
  ({
    id: title,
    title,
    focusTags,
    systemicDemand,
  }) as Program;

// The seeded shared programs, as stamped by 20260803000000.
const easyStrength = program('Easy Strength', ['strength', 'skill'], 'low');
const simpleSinister = program(
  'Simple & Sinister',
  ['power', 'strength', 'mobility'],
  'low',
);
const dfw = program(
  'Dry Fighting Weight',
  ['strength', 'hypertrophy', 'conditioning'],
  'high',
);
const swings = program(
  '10,000 Swing Challenge',
  ['conditioning', 'endurance', 'power'],
  'high',
);
const kettlebellMile = program(
  'The Kettlebell Mile',
  ['endurance', 'conditioning'],
  'moderate',
);
const aaProtocol = program(
  'A+A Protocol',
  ['power', 'endurance', 'conditioning'],
  'moderate',
);
const untagged = program('My Program', [], null);

describe('assessStackFit — nothing to say', () => {
  test('the first program is never a stacking question', () => {
    expect(assessStackFit(dfw, [])).toBeNull();
  });

  test('an untagged, unrated candidate cannot be assessed', () => {
    expect(assessStackFit(untagged, [dfw])).toBeNull();
  });
});

describe('assessStackFit — recovery cost', () => {
  test('two high-demand programs blow the budget', () => {
    const fit = assessStackFit(dfw, [swings])!;
    expect(fit.verdict).toBe('conflict');
    expect(fit.load).toBe(6);
    expect(fit.reasons[0]).toContain('more hard training');
  });

  test('the classic hard/easy pairing sits at the budget, not over it', () => {
    // Dry Fighting Weight (3) + Easy Strength (1) = 4.
    const fit = assessStackFit(dfw, [easyStrength])!;
    expect(fit.verdict).toBe('caution');
    expect(fit.load).toBe(4);
    expect(fit.reasons[0]).toContain('recovery budget');
  });

  test('two low-demand programs leave room to spare', () => {
    const fit = assessStackFit(easyStrength, [simpleSinister])!;
    expect(fit.verdict).toBe('good');
    expect(fit.load).toBe(2);
    expect(fit.reasons).toEqual([]);
  });

  test('three moderates exceed the budget even with no single hard program', () => {
    const third = program('Snatch Test', ['skill'], 'moderate');
    const fit = assessStackFit(third, [kettlebellMile, aaProtocol])!;
    expect(fit.verdict).toBe('conflict');
    expect(fit.load).toBe(6);
  });

  test('an unrated active program suppresses the budget verdict rather than understating it', () => {
    // untagged contributes 0, so a naive sum would read 3 and pass.
    const fit = assessStackFit(dfw, [untagged])!;
    expect(fit.verdict).toBe('good');
    expect(fit.reasons).toEqual([]);
  });
});

describe('assessStackFit — redundancy', () => {
  test('two programs sharing two tags are buying the same adaptation', () => {
    // Kettlebell Mile and A+A share endurance + conditioning; both moderate, so
    // load is 4 and the budget note fires too.
    const fit = assessStackFit(kettlebellMile, [aaProtocol])!;
    expect(fit.verdict).toBe('caution');
    expect(fit.reasons.some((r) => r.includes('same qualities twice'))).toBe(true);
    expect(fit.reasons.some((r) => r.includes('Endurance'))).toBe(false);
    expect(fit.reasons.some((r) => r.includes('endurance'))).toBe(true);
  });

  test('a single shared tag is not redundancy', () => {
    // Easy Strength and Simple & Sinister share only `strength`.
    expect(assessStackFit(easyStrength, [simpleSinister])!.reasons).toEqual([]);
  });

  test('names every redundant program, not just the first', () => {
    const other = program('Other Mile', ['endurance', 'conditioning'], 'low');
    const fit = assessStackFit(kettlebellMile, [aaProtocol, other])!;
    const redundancy = fit.reasons.find((r) => r.includes('same qualities twice'))!;
    expect(redundancy).toContain('A+A Protocol');
    expect(redundancy).toContain('Other Mile');
  });
});

describe('assessStackFit — verdict precedence', () => {
  test('two high programs sharing one tag are a budget problem, not a redundancy one', () => {
    // Swings and DFW overlap only on `conditioning`.
    const fit = assessStackFit(swings, [dfw])!;
    expect(fit.verdict).toBe('conflict');
    expect(fit.reasons).toHaveLength(1);
  });

  test('over budget outranks redundancy, and both issues are reported', () => {
    const heavyTwin = program(
      'Heavy Twin',
      ['strength', 'hypertrophy', 'conditioning'],
      'high',
    );
    const fit = assessStackFit(heavyTwin, [dfw])!;
    expect(fit.verdict).toBe('conflict');
    expect(fit.reasons).toHaveLength(2);
    expect(fit.reasons[0]).toContain('more hard training');
    expect(fit.reasons[1]).toContain('same qualities twice');
  });
});
