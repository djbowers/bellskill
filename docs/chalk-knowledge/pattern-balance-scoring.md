---
title: How the pattern balance score works
tags: app-concept, pattern-balance, scoring
---

## What the score is

Each of the eight movement patterns (hinge, squat, push, pull, carry,
rotation, core, get-up) gets a score from 0 to 100 — higher means more
under-trained. The score blends two ingredients with fixed weights:

> score = 100 × (0.6 × recency + 0.4 × work deficit), rounded to a whole
> number.

Recency counts for 60% and work deficit for 40%, so *when* a pattern was last
trained matters more than *how much* of it was done.

## The recency ingredient (0 to 1)

Recency is days since the pattern was last trained, divided by 14, capped at
1. Training a pattern today puts its recency near 0; a pattern untrained for
14 or more days (or not trained at all in the recent two-week window) sits at
the maximum of 1. The ideal cadence behind this: each pattern trained roughly
every 7 days, with the recency penalty maxing out at twice that.

## The work-deficit ingredient (0 to 1)

Work deficit compares recent work to the lifter's own baseline — the typical
amount they did per two-week window over the trailing 12 weeks. Three kinds of
work count, each on its own track: loaded volume (kilograms lifted),
bodyweight reps (sets with no load), and timed work (seconds of timed rungs).
For each track where the lifter has a baseline, the deficit is how far recent
work fell short of that baseline (a track fully kept up scores 0; a track
completely skipped scores 1), and the tracks are averaged. A pattern with no
baseline yet but some recent activity counts as no deficit — a new but active
pattern is not behind.

## Bands and the "New" state

The score maps to three bands: under 33 is on track, 33 to 65 is due, and 66
or higher is overdue. A pattern with no training at all in the trailing 12
weeks shows as "New" instead of a score — neutral, not overdue — and is left
out of the overall balance until it is trained the first time.

## Overall balance

Overall balance looks at the spread between the highest and lowest scores
across the non-New patterns. A spread under 25 points reads as "balanced".
A wider spread reads as leaning toward the pattern with the LOWEST score —
the one trained most recently and heavily — e.g. "hinge-heavy" for a lifter
living on swings while presses go stale.

## Practical notes

- A movement can pay toward several patterns at once: the get-up refreshes
  get-up, push, and rotation together, all at full credit.
- Bodyweight and timed work count toward balance just like loaded work — a
  lifter doing push-ups is keeping the push pattern current even with no bell
  involved.
- Because recency dominates the blend, the fastest way to bring an overdue
  pattern down is simply to train it at all; matching baseline volume then
  clears the rest.
