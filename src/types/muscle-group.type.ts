// `Target Muscle Group` is now a free-text column (PROD-153). This union is the
// muscle-group value set the self-authored catalog actually uses — the same set
// MovementsPage offers as Explore filter options. Keep in sync with
// scripts/data/movements.csv.
export type MuscleGroup =
  | 'Abdominals'
  | 'Adductors'
  | 'Back'
  | 'Calves'
  | 'Chest'
  | 'Forearms'
  | 'Glutes'
  | 'Hamstrings'
  | 'Quadriceps'
  | 'Shoulders'
  | 'Trapezius'
  | 'Triceps';
