export const features = {
  complexMode: import.meta.env.VITE_FEATURE_COMPLEX_MODE === 'true',
  explore: import.meta.env.VITE_FEATURE_EXPLORE === 'true',
} as const;
