// resolveSharedWeights now lives in ~/utils so it can be shared by the API
// layer (recent-workout repeats) without a pages -> utils import cycle. This
// re-export keeps the existing `./utils` / `../utils/resolveSharedWeights`
// import paths working for the CompletedWorkoutPage components.
export * from '~/utils/resolveSharedWeights';
