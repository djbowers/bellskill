export const formatVolume = (kg: number): string =>
  `${Math.round(kg).toLocaleString()} kg`;
