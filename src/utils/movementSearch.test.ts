import { describe, expect, test } from 'vitest';

import { rankMovements } from './rankMovements';
import {
  movementNameMatchesSearchTokens,
  movementSearchTokensInOrder,
  scoreMovementSearchMatch,
  tokenizeMovementSearchQuery,
} from './movementSearch';

describe('tokenizeMovementSearchQuery', () => {
  test('splits on whitespace and lowercases', () => {
    expect(tokenizeMovementSearchQuery('  Double Kettlebell Squat ')).toEqual([
      'double',
      'kettlebell',
      'squat',
    ]);
  });
});

describe('movementNameMatchesSearchTokens', () => {
  test('matches when all tokens appear non-contiguously', () => {
    const tokens = tokenizeMovementSearchQuery('double kettlebell squat');

    expect(
      movementNameMatchesSearchTokens('Double Kettlebell Front Rack Squat', tokens),
    ).toBe(true);
  });

  test('does not match when a token is missing', () => {
    const tokens = tokenizeMovementSearchQuery('double kettlebell squat');

    expect(movementNameMatchesSearchTokens('Double Kettlebell Front Rack', tokens)).toBe(
      false,
    );
  });
});

describe('movementSearchTokensInOrder', () => {
  test('returns true when tokens appear in order', () => {
    expect(
      movementSearchTokensInOrder('double kettlebell front rack squat', [
        'double',
        'kettlebell',
        'squat',
      ]),
    ).toBe(true);
  });
});

describe('scoreMovementSearchMatch', () => {
  test('ranks closer contiguous matches higher than scattered token matches', () => {
    const query = 'double kettlebell squat';
    const exactPhrase = scoreMovementSearchMatch('Double Kettlebell Squat', query);
    const scattered = scoreMovementSearchMatch('Double Kettlebell Front Rack Squat', query);

    expect(exactPhrase).toBeGreaterThan(scattered);
    expect(scattered).toBeGreaterThan(0);
  });

  test('prefers shorter names with fewer extra words', () => {
    const query = 'squat';

    expect(scoreMovementSearchMatch('Goblet Squat', query)).toBeGreaterThan(
      scoreMovementSearchMatch('Double Kettlebell Front Rack Squat', query),
    );
  });
});

describe('rankMovements', () => {
  test('orders better fuzzy matches first', () => {
    const results = rankMovements(
      [
        { name: 'Double Kettlebell Front Rack Squat' },
        { name: 'Double Kettlebell Squat' },
        { name: 'Double Kettlebell Clean' },
      ],
      'double kettlebell squat',
      new Set(),
    );

    expect(results.map((result) => result.name)).toEqual([
      'Double Kettlebell Squat',
      'Double Kettlebell Front Rack Squat',
      'Double Kettlebell Clean',
    ]);
  });
});
