// `Difficulty Level` is now a free-text column (PROD-153). This union is the
// difficulty value set the self-authored catalog actually uses — the same set
// MovementsPage offers as an Explore filter. Keep in sync with
// scripts/data/movements.csv.
export type DifficultyLevel = 'Beginner' | 'Intermediate' | 'Expert';
