import { scoreMovementSearchMatch } from './movementSearch';

export interface Rankable {
  name: string;
}

export function rankMovements<T extends Rankable>(
  results: T[],
  query: string,
  frequentNames: Set<string>,
): T[] {
  return [...results].sort((a, b) => {
    const scoreA =
      scoreMovementSearchMatch(a.name, query) +
      (frequentNames.has(a.name.toLowerCase()) ? 5 : 0);
    const scoreB =
      scoreMovementSearchMatch(b.name, query) +
      (frequentNames.has(b.name.toLowerCase()) ? 5 : 0);
    return scoreB - scoreA;
  });
}
