import { describe, expect, it } from 'vitest';

import { suggestCatalogMatch } from './suggestCatalogMatch';

const CATALOG = [
  { id: '1', name: 'Kettlebell Clean and Press' },
  { id: '2', name: 'Kettlebell Swing' },
  { id: '3', name: 'Goblet Squat' },
  { id: '4', name: 'Double Kettlebell Front Rack Squat' },
];

describe('suggestCatalogMatch', () => {
  it('suggests the catalog entry a custom name is a subset of', () => {
    expect(suggestCatalogMatch('Clean and Press', CATALOG)?.id).toBe('1');
  });

  it('prefers an exact name over a longer superset', () => {
    expect(suggestCatalogMatch('Goblet Squat', CATALOG)?.id).toBe('3');
  });

  it('returns null when nothing clears the confidence floor', () => {
    expect(suggestCatalogMatch('Turkish Get Up', CATALOG)).toBeNull();
  });

  it('returns null for an empty catalog', () => {
    expect(suggestCatalogMatch('Kettlebell Swing', [])).toBeNull();
  });
});
