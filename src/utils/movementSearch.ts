export function tokenizeMovementSearchQuery(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter((token) => token.length > 0);
}

export function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export function movementNameMatchesSearchTokens(name: string, tokens: string[]): boolean {
  if (tokens.length === 0) return false;

  const lower = name.toLowerCase();
  return tokens.every((token) => lower.includes(token));
}

export function movementSearchTokensInOrder(name: string, tokens: string[]): boolean {
  const lower = name.toLowerCase();
  let pos = 0;

  for (const token of tokens) {
    const idx = lower.indexOf(token, pos);
    if (idx === -1) return false;
    pos = idx + token.length;
  }

  return true;
}

export function scoreMovementSearchMatch(name: string, query: string): number {
  const lower = name.toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();
  const tokens = tokenizeMovementSearchQuery(query);

  if (!movementNameMatchesSearchTokens(name, tokens)) return 0;

  let score = tokens.length;

  if (normalizedQuery.length > 0) {
    if (lower === normalizedQuery) score += 100;
    else if (lower.startsWith(normalizedQuery)) score += 50;
    else if (lower.includes(` ${normalizedQuery}`)) score += 30;
    else if (lower.includes(normalizedQuery)) score += 20;
  }

  if (movementSearchTokensInOrder(name, tokens)) score += 15;

  for (const token of tokens) {
    if (lower.startsWith(token)) score += 4;
    else if (lower.includes(` ${token}`)) score += 3;
    else if (lower.includes(token)) score += 1;
  }

  return score;
}
