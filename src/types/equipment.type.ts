// The self-authored catalog (PROD-153) is Kettlebell + Bodyweight only — the two
// equipment classes the workout builder can ever surface. `Primary Equipment` is
// a free-text column guarded by a CHECK constraint; this union mirrors it.
export type Equipment = 'Bodyweight' | 'Kettlebell';
