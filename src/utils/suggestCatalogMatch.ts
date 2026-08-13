import { scoreMovementSearchMatch } from './movementSearch';

export interface CatalogCandidate {
  id: string;
  name: string;
}

// Below this, the best match is usually a coincidental word overlap
// ("Swing" matching "Kettlebell Swing Squat Clean") — better to show nothing
// than to invite a one-click mislink.
const SUGGESTION_SCORE_FLOOR = 20;

export function suggestCatalogMatch<T extends CatalogCandidate>(
  name: string,
  candidates: T[],
): T | null {
  let best: T | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const score = scoreMovementSearchMatch(candidate.name, name);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return bestScore >= SUGGESTION_SCORE_FLOOR ? best : null;
}
