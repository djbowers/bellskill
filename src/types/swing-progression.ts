export type SwingVariation = '2h' | '1h' | 'dead-stop' | 'double';
export type SwingNodeState = 'done' | 'current' | 'next' | 'locked';

export interface SwingProgressionNode {
  variation: SwingVariation;
  weightKg: number;
  totalReps: number;
  totalWorkouts: number;
  state: SwingNodeState;
}

export type SwingProgressionData = SwingProgressionNode[];
