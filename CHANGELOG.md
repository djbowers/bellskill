# Changelog

All notable changes to Bellskill, grouped by month (newest first). Entries link the pull
request where one exists; early history predates the PR workflow and is summarized from
commits. Sections: **Added** (feat), **Fixed** (fix), **Changed** (refactor/style/perf),
**Infrastructure** (chore/ci/build/docs/test).

## 2026-08

### Added
- Chalk corpus article grounding the pattern-balance formula in retrievable text ([#285](https://github.com/djbowers/bellskill/pull/285))
- Chalk RAG pipeline: hybrid retrieval over coaching knowledge and training history, with an eval harness ([#277](https://github.com/djbowers/bellskill/pull/277))
- Next/previous set navigation mid-workout ([#268](https://github.com/djbowers/bellskill/pull/268))
- Confirmation before a workout finishes at its goal ([#273](https://github.com/djbowers/bellskill/pull/273))
- AI coach chat ("Chalk") over your training data ([#259](https://github.com/djbowers/bellskill/pull/259))
- Ghost pacing on the active workout page, now flag-gated and skipped for straight sets ([#258](https://github.com/djbowers/bellskill/pull/258), [#266](https://github.com/djbowers/bellskill/pull/266))
- Training Mix modality balance card on the history page ([#255](https://github.com/djbowers/bellskill/pull/255))
- Modality balance fed into all three AI surfaces ([#260](https://github.com/djbowers/bellskill/pull/260))
- Export training data as JSON for AI assistants ([#253](https://github.com/djbowers/bellskill/pull/253))
- Drag-and-drop reordering of movements in the builder ([#264](https://github.com/djbowers/bellskill/pull/264))
- Any rung can be max reps or max time ([#248](https://github.com/djbowers/bellskill/pull/248))
- Straight sets run as sets per movement instead of a circuit ([#245](https://github.com/djbowers/bellskill/pull/245))
- Weight mode derived from the picked movement in the builder ([#247](https://github.com/djbowers/bellskill/pull/247))
- Shared bell as an axis independent of complex mode ([#239](https://github.com/djbowers/bellskill/pull/239))
- Unilateral leg work as its own movement axis ([#251](https://github.com/djbowers/bellskill/pull/251))
- Users can declare owned kettlebells, feeding both recommenders ([#235](https://github.com/djbowers/bellskill/pull/235))
- Debt-optimal balance mode in the recommender with coverage validation ([#233](https://github.com/djbowers/bellskill/pull/233))
- Pattern-debt balance fed into session recommendations ([#219](https://github.com/djbowers/bellskill/pull/219))
- Bodyweight and timed movements pay down pattern debt via their own rep/time tracks ([#271](https://github.com/djbowers/bellskill/pull/271))
- 8-pattern boolean-credit ledger with per-movement RPC ([#229](https://github.com/djbowers/bellskill/pull/229))
- Shared runnability verifier for the builder and recommender ([#238](https://github.com/djbowers/bellskill/pull/238))
- AI program recommender on the Programs page ([#217](https://github.com/djbowers/bellskill/pull/217))
- Stage ladders for autoregulated progression, extended to Plan 025 ([#203](https://github.com/djbowers/bellskill/pull/203), [#205](https://github.com/djbowers/bellskill/pull/205))
- Programs page redesigned with state-driven cards; programs categorized with stack-fit advice ([#206](https://github.com/djbowers/bellskill/pull/206), [#207](https://github.com/djbowers/bellskill/pull/207), [#216](https://github.com/djbowers/bellskill/pull/216))
- Swap movements in a program without touching rep schemes ([#222](https://github.com/djbowers/bellskill/pull/222))
- Rename your own programs ([#242](https://github.com/djbowers/bellskill/pull/242))
- Owner can release/unrelease catalog programs from Browse ([#228](https://github.com/djbowers/bellskill/pull/228))
- Spotify remote-control mini-player during active workouts ([#218](https://github.com/djbowers/bellskill/pull/218))
- Cancel an active workout with a confirmation dialog ([#220](https://github.com/djbowers/bellskill/pull/220))
- Movement details page with personal training history ([#234](https://github.com/djbowers/bellskill/pull/234))
- Movements tab: mobile card list, pattern column and filter ([#232](https://github.com/djbowers/bellskill/pull/232))
- Custom movements tagged in the movement picker, linkable to the catalog from Explore, and deletable with log inspection ([#243](https://github.com/djbowers/bellskill/pull/243), [#249](https://github.com/djbowers/bellskill/pull/249), [#254](https://github.com/djbowers/bellskill/pull/254))
- New catalog movements: ab wheel rollouts and four core gaps; marches, band pull-downs, and Pallof presses ([#250](https://github.com/djbowers/bellskill/pull/250), [#256](https://github.com/djbowers/bellskill/pull/256))
- Collapsible builder sections with summaries; hub repeat section collapsed and AI recommender unified ([#226](https://github.com/djbowers/bellskill/pull/226), [#240](https://github.com/djbowers/bellskill/pull/240))
- Branded in-shell loading state while program gates resolve ([#201](https://github.com/djbowers/bellskill/pull/201))
- AI recommendations switched from Sonnet to Haiku ([#224](https://github.com/djbowers/bellskill/pull/224))
- Larger hand indicator in complex mode ([#265](https://github.com/djbowers/bellskill/pull/265))

### Fixed
- Chalk embedding worker: dedicated token for embed-text auth, and smaller batches with retry under the hosted compute limit ([#279](https://github.com/djbowers/bellskill/pull/279), [#281](https://github.com/djbowers/bellskill/pull/281))
- Interval program goals counted in rounds instead of minutes, so backgrounding the app no longer ends a session short ([#267](https://github.com/djbowers/bellskill/pull/267))
- Deload and test-day weight offsets preserved when a session edit is applied forward ([#270](https://github.com/djbowers/bellskill/pull/270))
- Repeating programs actually repeat ([#261](https://github.com/djbowers/bellskill/pull/261))
- Timed rungs validated in seconds ([#257](https://github.com/djbowers/bellskill/pull/257))
- Shared weight shown on complex-set cards ([#204](https://github.com/djbowers/bellskill/pull/204))
- Deload and test-day offsets preserved on Adjust weights ([#210](https://github.com/djbowers/bellskill/pull/210))
- Calendar-day boundaries for days-since-workout in both recommenders ([#225](https://github.com/djbowers/bellskill/pull/225), [#227](https://github.com/djbowers/bellskill/pull/227))
- Unsupported effort param dropped for Haiku ([#231](https://github.com/djbowers/bellskill/pull/231))
- Weight-mode tab labels shortened to fit small phones ([#246](https://github.com/djbowers/bellskill/pull/246))
- Program card menu action labeled "Edit sessions" ([#252](https://github.com/djbowers/bellskill/pull/252))
- Demo and fixture movement names aligned with the catalog ([#208](https://github.com/djbowers/bellskill/pull/208))

### Changed
- `straightSets`/`complexSet` booleans replaced with a 3-way `workoutMode` ([#236](https://github.com/djbowers/bellskill/pull/236))
- Regenerate removed and the recommender's two modes collapsed into one ([#241](https://github.com/djbowers/bellskill/pull/241))

### Infrastructure
- Chalk RAG faithfulness eval baseline recorded — 4.92/5, safety 100% ([#284](https://github.com/djbowers/bellskill/pull/284))
- Merges to main gated on six required checks — unit tests, lint, a new tsc typecheck job, e2e, and always-run Supabase guards — documented in the dev guidelines ([#280](https://github.com/djbowers/bellskill/pull/280), [#282](https://github.com/djbowers/bellskill/pull/282))
- Claude auto-review on every non-draft PR, plus an @claude mention workflow for follow-ups ([#274](https://github.com/djbowers/bellskill/pull/274))
- Full changelog history backfilled and a weekly changelog-update skill added ([#269](https://github.com/djbowers/bellskill/pull/269))
- Linear ticket checks and status sync required in every agent session ([#272](https://github.com/djbowers/bellskill/pull/272))
- Unit and e2e tests split into separate workflows ([#211](https://github.com/djbowers/bellskill/pull/211))
- Deploys auto-sync develop with main; prod Supabase env moved to Netlify UI; edge functions deployed by glob ([#221](https://github.com/djbowers/bellskill/pull/221), [#223](https://github.com/djbowers/bellskill/pull/223))
- Production db push accepts out-of-order migrations; migration version collisions resolved ([#262](https://github.com/djbowers/bellskill/pull/262), [#263](https://github.com/djbowers/bellskill/pull/263))
- Legacy `pattern_debt_window` RPC dropped; `bottomNav` flag retired ([#230](https://github.com/djbowers/bellskill/pull/230), [#237](https://github.com/djbowers/bellskill/pull/237))
- Program user flows and test coverage documented ([#202](https://github.com/djbowers/bellskill/pull/202))

## 2026-07

### Added
- **Programs**: full program-tracking system — schema with RLS and copy-on-enroll ([#103](https://github.com/djbowers/bellskill/pull/103)), manual program creation ([#105](https://github.com/djbowers/bellskill/pull/105)), next-workout home surfacing ([#106](https://github.com/djbowers/bellskill/pull/106)), progress views ([#107](https://github.com/djbowers/bellskill/pull/107)), session reorder/delete ([#108](https://github.com/djbowers/bellskill/pull/108)), full CRUD ([#138](https://github.com/djbowers/bellskill/pull/138)), compact browse list ([#136](https://github.com/djbowers/bellskill/pull/136)), derived cadence ([#137](https://github.com/djbowers/bellskill/pull/137)), details view before starting ([#151](https://github.com/djbowers/bellskill/pull/151)), start-any-session and resume ([#145](https://github.com/djbowers/bellskill/pull/145)), up to 3 parallel programs ([#163](https://github.com/djbowers/bellskill/pull/163)), back-to-back program queueing ([#192](https://github.com/djbowers/bellskill/pull/192)), session edits applied to future sessions ([#195](https://github.com/djbowers/bellskill/pull/195)), auto-repeat toggle ([#179](https://github.com/djbowers/bellskill/pull/179), optimistic flip [#194](https://github.com/djbowers/bellskill/pull/194)), weight adjustment going forward ([#189](https://github.com/djbowers/bellskill/pull/189)), per-movement and per-group starting weights on enrollment ([#115](https://github.com/djbowers/bellskill/pull/115), [#132](https://github.com/djbowers/bellskill/pull/132), [#166](https://github.com/djbowers/bellskill/pull/166), [#175](https://github.com/djbowers/bellskill/pull/175))
- Seeded shared programs: Dan John's 10,000 Swing Challenge ([#116](https://github.com/djbowers/bellskill/pull/116)), Easy Strength ([#121](https://github.com/djbowers/bellskill/pull/121)), Armor Building Complex ([#120](https://github.com/djbowers/bellskill/pull/120)), StrongFirst A+A Protocol Plan A ([#122](https://github.com/djbowers/bellskill/pull/122)), Snatch Test Training Plan ([#119](https://github.com/djbowers/bellskill/pull/119)), Strong Endurance Plan 025 ([#187](https://github.com/djbowers/bellskill/pull/187)), Simple & Sinister and Onnit beginner workouts ([#179](https://github.com/djbowers/bellskill/pull/179)), The Kettlebell Mile with timed movements ([#164](https://github.com/djbowers/bellskill/pull/164))
- Self-authored KB+BW movement library replacing the non-commercial catalog ([#113](https://github.com/djbowers/bellskill/pull/113)); Double naming for two-arm movements ([#169](https://github.com/djbowers/bellskill/pull/169))
- Navigation: flag-gated mobile bottom nav ([#102](https://github.com/djbowers/bellskill/pull/102)), desktop sidebar unified into one nav system ([#173](https://github.com/djbowers/bellskill/pull/173)), released to production ([#184](https://github.com/djbowers/bellskill/pull/184))
- Redesigns: custom workout builder ([#174](https://github.com/djbowers/bellskill/pull/174)), start page as a hub landing ([#176](https://github.com/djbowers/bellskill/pull/176)), weekly workout history view ([#170](https://github.com/djbowers/bellskill/pull/170)), pinned builder chrome ([#183](https://github.com/djbowers/bellskill/pull/183)), rung add/remove controls ([#181](https://github.com/djbowers/bellskill/pull/181))
- Workout titles with split notes ([#172](https://github.com/djbowers/bellskill/pull/172)); straight-sets traversal mode ([#171](https://github.com/djbowers/bellskill/pull/171)); swipe to select weights and reps ([#165](https://github.com/djbowers/bellskill/pull/165))
- Audible ding + haptic at rest/interval timer end ([#96](https://github.com/djbowers/bellskill/pull/96)); per-side counting within a rung, persisted to the log ([#95](https://github.com/djbowers/bellskill/pull/95))
- Weekly balance readiness gauge on history ([#180](https://github.com/djbowers/bellskill/pull/180))
- Runtime per-user feature flags ([#114](https://github.com/djbowers/bellskill/pull/114)); launchpad shell behind a master flag with population routing ([#133](https://github.com/djbowers/bellskill/pull/133)); Start-a-program card on the un-enrolled home ([#190](https://github.com/djbowers/bellskill/pull/190)); curated first workout enabled with variant lift read ([#186](https://github.com/djbowers/bellskill/pull/186))
- App-level 404 catch-all and route error boundary ([#109](https://github.com/djbowers/bellskill/pull/109)); full-page kettlebell splash during app init ([#160](https://github.com/djbowers/bellskill/pull/160)); program mutation errors surfaced as toasts ([#110](https://github.com/djbowers/bellskill/pull/110))
- Deploy previews auto-sign-in with all features on ([#157](https://github.com/djbowers/bellskill/pull/157))

### Fixed
- Countdown timers derived from wall-clock deadlines ([#198](https://github.com/djbowers/bellskill/pull/198)); timer audio resumes after app switching ([#197](https://github.com/djbowers/bellskill/pull/197))
- Shared weight used for complex-set volume ([#196](https://github.com/djbowers/bellskill/pull/196)); number pickers no longer desync ([#191](https://github.com/djbowers/bellskill/pull/191))
- Keyboard detected via VisualViewport API for nav ([#199](https://github.com/djbowers/bellskill/pull/199)); weight-mode tabs usable while the movement dropdown is open (no PR)
- A+A Plan A reconciled with its source protocol ([#162](https://github.com/djbowers/bellskill/pull/162), [#178](https://github.com/djbowers/bellskill/pull/178)); DFW seed movements mapped to catalog names ([#142](https://github.com/djbowers/bellskill/pull/142)); orphaned user movements and curated names relinked to the catalog ([#134](https://github.com/djbowers/bellskill/pull/134), [#135](https://github.com/djbowers/bellskill/pull/135))
- All shared programs listed, not just one ([#118](https://github.com/djbowers/bellskill/pull/118)); enroll starting weight applied at workout time ([#152](https://github.com/djbowers/bellskill/pull/152)); recommender opens two-bell movements as Double ([#144](https://github.com/djbowers/bellskill/pull/144)); paywall copy only promises shipped features ([#101](https://github.com/djbowers/bellskill/pull/101))

### Changed
- react-query v3 migrated to @tanstack/react-query v5 ([#154](https://github.com/djbowers/bellskill/pull/154)); React 19 upgrade and feature adoption ([#159](https://github.com/djbowers/bellskill/pull/159), [#161](https://github.com/djbowers/bellskill/pull/161))
- Remaining hardcoded colors routed through design tokens ([#177](https://github.com/djbowers/bellskill/pull/177)); information hierarchy improved across main workout pages (no PR)

### Infrastructure
- CI blocks merges on stale Supabase types ([#111](https://github.com/djbowers/bellskill/pull/111)); eslint extended to ts/tsx and gating PRs ([#149](https://github.com/djbowers/bellskill/pull/149)); staging rebuilt with db reset ([#123](https://github.com/djbowers/bellskill/pull/123)); Storybook served on deploy previews ([#112](https://github.com/djbowers/bellskill/pull/112)); Storybook 8.6.18 ([#153](https://github.com/djbowers/bellskill/pull/153))
- Docs: PR screenshots required ([#168](https://github.com/djbowers/bellskill/pull/168)), AGENTS.md minimized with dossiers moved to docs/ ([#155](https://github.com/djbowers/bellskill/pull/155)), PR template added ([#158](https://github.com/djbowers/bellskill/pull/158))

## 2026-06

### Added
- **Paywall v1**: trial infrastructure, entitlement gating, and paywall screen ([#76](https://github.com/djbowers/bellskill/pull/76)); Stripe checkout session edge function ([#77](https://github.com/djbowers/bellskill/pull/77)); Stripe webhook edge function ([#78](https://github.com/djbowers/bellskill/pull/78)); checkout round-trip and Customer Portal ([#79](https://github.com/djbowers/bellskill/pull/79)); owner-only subscription toggle for QA ([#92](https://github.com/djbowers/bellskill/pull/92))
- **AI recommender foundations**: session_recommendations table and flag ([#82](https://github.com/djbowers/bellskill/pull/82)); recommend-session edge function ([#90](https://github.com/djbowers/bellskill/pull/90)); recommendation UI on Start Workout ([#91](https://github.com/djbowers/bellskill/pull/91))
- Deterministic Pattern Debt Engine with a flag-gated Weekly Balance page ([#84](https://github.com/djbowers/bellskill/pull/84))
- Curated first workouts and recent-repeat surface, flag-gated ([#89](https://github.com/djbowers/bellskill/pull/89), [#94](https://github.com/djbowers/bellskill/pull/94))
- Workout history pagination with Load More ([#88](https://github.com/djbowers/bellskill/pull/88))
- Activation funnel instrumentation with cohort-windowed reads ([#87](https://github.com/djbowers/bellskill/pull/87))
- Owner-only preview override for disabled features ([#85](https://github.com/djbowers/bellskill/pull/85))

### Fixed
- Three tsc errors on main ([#86](https://github.com/djbowers/bellskill/pull/86))
- Completed Workout page reverted to the original card layout ([#81](https://github.com/djbowers/bellskill/pull/81))

### Infrastructure
- Netlify SPA fallback redirect ([#80](https://github.com/djbowers/bellskill/pull/80)); deploy previews pointed at staging Supabase with PR backend deploys ([#93](https://github.com/djbowers/bellskill/pull/93)); `.claude/settings.local.json` untracked ([#83](https://github.com/djbowers/bellskill/pull/83))

## 2026-05

### Added
- **Complex mode** shipped end-to-end: toggle on Start Workout ([#43](https://github.com/djbowers/bellskill/pull/43)), simultaneous movement display ([#44](https://github.com/djbowers/bellskill/pull/44)), persisted `complex_set` flag ([#47](https://github.com/djbowers/bellskill/pull/47)), Complex badge in history ([#48](https://github.com/djbowers/bellskill/pull/48)), shared-weight persistence ([#51](https://github.com/djbowers/bellskill/pull/51)), contextual help text, enabled in production ([#73](https://github.com/djbowers/bellskill/pull/73))
- Movement selection autocomplete on Start Workout ([#58](https://github.com/djbowers/bellskill/pull/58)) with fuzzy search, frequency ranking, weight-mode filtering, and a `movements_catalog` database view ([#64](https://github.com/djbowers/bellskill/pull/64), [#66](https://github.com/djbowers/bellskill/pull/66))
- `user_movements` table linking users to catalog movements ([#57](https://github.com/djbowers/bellskill/pull/57)) with FK from movement logs ([#61](https://github.com/djbowers/bellskill/pull/61)); manual log-to-catalog linking on history ([#70](https://github.com/djbowers/bellskill/pull/70))
- Movements CSV ingest with sync and prune modes ([#67](https://github.com/djbowers/bellskill/pull/67), [#68](https://github.com/djbowers/bellskill/pull/68))
- Completed workout page redesign with editorial hero ([#71](https://github.com/djbowers/bellskill/pull/71)); Start Workout layout polish ([#72](https://github.com/djbowers/bellskill/pull/72), [#74](https://github.com/djbowers/bellskill/pull/74))
- Compile-time feature-flag system ([#45](https://github.com/djbowers/bellskill/pull/45))
- Playwright e2e test for the full workout flow

### Fixed
- Immediate logout after OTP by ensuring profiles exist on sign-in ([#66](https://github.com/djbowers/bellskill/pull/66))
- Stale auth sessions signed out after local database resets ([#66](https://github.com/djbowers/bellskill/pull/66))
- Weight-mode tab overflow on mobile ([#75](https://github.com/djbowers/bellskill/pull/75))
- Staging migrations deploying after develop sync ([#62](https://github.com/djbowers/bellskill/pull/62)); migration ordering conflicts ([#54](https://github.com/djbowers/bellskill/pull/54), [#60](https://github.com/djbowers/bellskill/pull/60))
- 15 Supabase Security Advisor warnings

### Infrastructure
- Backend (Supabase config) merged into the bellskill repo ([#49](https://github.com/djbowers/bellskill/pull/49)); unused `progress_items` table dropped ([#52](https://github.com/djbowers/bellskill/pull/52)); develop-sync workflow ([#56](https://github.com/djbowers/bellskill/pull/56)); e2e tests in a separate CI job ([#63](https://github.com/djbowers/bellskill/pull/63)); Claude permission allowlist ([#55](https://github.com/djbowers/bellskill/pull/55))

## 2026-04

### Added
- App renamed from Cannonbells to BellSkill ([#40](https://github.com/djbowers/bellskill/pull/40))
- Agent guidelines documentation ([#42](https://github.com/djbowers/bellskill/pull/42))

### Infrastructure
- Node 24 upgrade ([#41](https://github.com/djbowers/bellskill/pull/41)); README rewritten ([#39](https://github.com/djbowers/bellskill/pull/39))

## 2025-12

### Added
- Volume goal option for workouts, with a deep test pass across start, active, and progress views ([#38](https://github.com/djbowers/bellskill/pull/38))

## 2025-11

### Added
- App renamed to Cannonbells; Discord link removed

## 2025-07

### Added
- PWA support: manifest, service worker, and install prompt ([#27](https://github.com/djbowers/bellskill/pull/27))
- OTP authentication for mobile users ([#30](https://github.com/djbowers/bellskill/pull/30))
- Mobile safe-area support for notched phones ([#33](https://github.com/djbowers/bellskill/pull/33)); pinch-to-zoom disabled in standalone PWA ([#37](https://github.com/djbowers/bellskill/pull/37))

### Fixed
- A series of caching fixes: static assets excluded from SPA routing ([#31](https://github.com/djbowers/bellskill/pull/31)), service worker removed and later cleaned up to kill stale-asset 404s ([#32](https://github.com/djbowers/bellskill/pull/32), [#36](https://github.com/djbowers/bellskill/pull/36)), stronger cache headers ([#34](https://github.com/djbowers/bellskill/pull/34), [#35](https://github.com/djbowers/bellskill/pull/35))

### Infrastructure
- Supabase configuration split to an external project ([#29](https://github.com/djbowers/bellskill/pull/29))

## 2025-05

### Added
- Movements page with search, sorting, and filters for muscle group, equipment, and difficulty ([#26](https://github.com/djbowers/bellskill/pull/26))
- Start and History moved into the header

### Fixed
- Workout notes cache key ([#24](https://github.com/djbowers/bellskill/pull/24))

### Changed
- Mobile app and monorepo removed — web-only from here ([#25](https://github.com/djbowers/bellskill/pull/25))

## 2025-01

### Added
- Movement logs data model: per-movement logging across start, active, and completed pages, with history rebuilt on it and completed volume recorded ([#21](https://github.com/djbowers/bellskill/pull/21))
- Weight units: pounds support with correct volume conversion ([#22](https://github.com/djbowers/bellskill/pull/22))
- Delete workout logs with confirmation dialog ([#20](https://github.com/djbowers/bellskill/pull/20))

### Fixed
- Workouts tracked twice with minutes goal and interval timer ([#17](https://github.com/djbowers/bellskill/pull/17))
- Interval timer not starting with rounds goal; duplicate workout logging ([#19](https://github.com/djbowers/bellskill/pull/19))
- kg-to-lb conversion factor ([#23](https://github.com/djbowers/bellskill/pull/23))

## 2024-12

### Added
- Workout goals: data model, start-page selection, progress display toward rounds goals, and auto-end when the goal is reached ([#16](https://github.com/djbowers/bellskill/pull/16))

## 2024-09

### Added
- Two-handed single kettlebell workouts ([#13](https://github.com/djbowers/bellskill/pull/13))
- Post-workout notes ([#14](https://github.com/djbowers/bellskill/pull/14))

## 2024-03

### Added
- Dark mode toggle in the header; countdown timer; RPE on workout history; history grouped by week; new favicon and PWA title

### Changed
- shadcn/ui adopted across all buttons, inputs, badges, cards, and navigation ([#12](https://github.com/djbowers/bellskill/pull/12)); blue theme; broad visual polish on active workout and start pages

## 2024-02

### Added
- Interval timer ([#9](https://github.com/djbowers/bellskill/pull/9)) and rest timer ([#11](https://github.com/djbowers/bellskill/pull/11)), both saved to workout logs
- Repeat completed workouts ([#10](https://github.com/djbowers/bellskill/pull/10))
- Workout history grouped by date ([#8](https://github.com/djbowers/bellskill/pull/8))

### Fixed
- Bodyweight movement bug; timers reimplemented with milliseconds and separated for intervals vs rest

## 2024-01

### Added
- RPE scale: column, selector, and full wire-up with tests ([#5](https://github.com/djbowers/bellskill/pull/5), [#6](https://github.com/djbowers/bellskill/pull/6))
- Bodyweight movements across start, history, and completed pages ([#7](https://github.com/djbowers/bellskill/pull/7))
- Completed workout page with navigation ([#4](https://github.com/djbowers/bellskill/pull/4))

### Fixed
- Bell input bug with values of 0 on the start page

### Infrastructure
- react-query adopted for all API hooks; MSW upgraded to v2; TypeScript upgrade with a type-check script

## 2023-12

### Added
- Alpha release polish: rounded buttons, redesigned progress meter and round info on the active workout page, Discord community link, Home link in the header

### Infrastructure
- Unit tests running in GitHub Actions

## 2023-11

### Added
- Dark mode ([#2](https://github.com/djbowers/bellskill/pull/2)); redesigned workout history screen ([#3](https://github.com/djbowers/bellskill/pull/3))

### Infrastructure
- Supabase initialized with first migrations and GitHub Actions; `practices` renamed to `workout_logs` ([#1](https://github.com/djbowers/bellskill/pull/1))

## 2023-10

### Added
- Bell weights displayed on the active workout page; multiple tasks per workout; wake lock during workouts

## 2023-09

### Added
- Rep ladders, with reps stored as arrays and shown on history

### Infrastructure
- Vitest + MSW testing bootstrapped; table renamed to `practices`

## 2023-08

### Added
- New start screen (built around The Giant); active session screen; completed workouts logged to the database; weights inputs; mobile-responsive UI

## 2023-07

### Added
- Web app reboot: new Vite + React app with Tailwind, react-router, training history, training goal select, and an exercises page (the original React Native app moved to `apps/mobile`)

## 2023-05

### Added
- Warmup rounds, secondary focus, and balanced workout generation across movement patterns; rebuilt review workout screen with movement-pattern points; internal-tester release prep

### Infrastructure
- Airtable data imported into the repo; workout-generation logic extensively unit-tested

## 2023-04

### Added
- First working generator loop: exercise filters (level, duration, focus), active workout screen with timers and progress bar, bottom tab navigation, configurable sets, async-storage persistence

### Infrastructure
- Jest, Storybook, and the `~` src alias set up

## 2023-03

### Added
- App renamed to Kettlebod; Airtable connected as the exercise database

## 2023-01

### Added
- Generate-workout and review-workout screens with navigation; initial theme and global styles

## 2022-11

### Added
- Initial commit: React Native app scaffold with react-native-web and Tailwind (twrnc)
