export const features = {
  complexMode: import.meta.env.VITE_FEATURE_COMPLEX_MODE === 'true',
  explore: import.meta.env.VITE_FEATURE_EXPLORE === 'true',
  premium: import.meta.env.VITE_FEATURE_PREMIUM === 'true',
  recommender: import.meta.env.VITE_FEATURE_RECOMMENDER === 'true',
  weeklyBalance: import.meta.env.VITE_FEATURE_WEEKLY_BALANCE === 'true',
} as const;
