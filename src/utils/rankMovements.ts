export interface Rankable {
  name: string;
}

function scoreMatch(name: string, query: string): number {
  const lower = name.toLowerCase();
  const q = query.toLowerCase();
  if (lower.startsWith(q)) return 3;
  if (lower.includes(` ${q}`)) return 2;
  return 1;
}

export function rankMovements<T extends Rankable>(
  results: T[],
  query: string,
  frequentNames: Set<string>,
): T[] {
  return [...results].sort((a, b) => {
    const scoreA = scoreMatch(a.name, query) + (frequentNames.has(a.name.toLowerCase()) ? 1 : 0);
    const scoreB = scoreMatch(b.name, query) + (frequentNames.has(b.name.toLowerCase()) ? 1 : 0);
    return scoreB - scoreA;
  });
}
