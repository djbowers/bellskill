# BellSkill

A kettlebell training application designed around principles of cognitive offloading from distributed cognition and working memory theory. BellSkill externalizes the cognitive demands of kettlebell training — sequence tracking, rep counting, temporal estimation, and cumulative progress monitoring — so the trainee's attention can stay on movement quality during high-intensity exercise.

## Try the app

The production version of BellSkill is hosted at:

**[app.bellskill.com](https://app.bellskill.com)**

Reviewers and other visitors can access the live application directly — no local setup required.

## About this repository

This repository accompanies a final report for **CS 6795: Introduction to Cognitive Science** at Georgia Tech (Spring 2026), titled *Designing for Cognitive Offloading: A Kettlebell Training Interface Grounded in Distributed Cognition*. The report applies a representational analysis grounded in Zhang and Norman's distributed cognitive tasks framework to evaluate BellSkill's interface design, with supporting theoretical grounding from Baddeley's working memory model, Hollan, Hutchins, and Kirsh's distributed cognition framework, Wickens' multiple resource theory, and Risko and Gilbert's review of cognitive offloading research.

The application has been developed and used consistently over several years of personal kettlebell training, and the report draws on that extended use as a primary source of structured self-use observations.

## Features analyzed in the report

The active workout screen externalizes six cognitive functions, each mapped in the report to a specific theoretical source:

- **Round indicator** — sequence position tracking (Zhang & Norman)
- **Exercise name and weight display** — exercise identity and load specification (Zhang & Norman)
- **Rep target display** — rep counting goal, partial phonological loop offload (Baddeley)
- **Continue button** — manual progression and cognitive boundary marking (Kirsh)
- **Time remaining and progress indicators** — temporal awareness and pacing (Lorist et al.)
- **Workout summary panel** — cumulative tracking and arithmetic offload (Zhang & Norman)

A planned audio cueing component is described in the report but is not implemented in the current build. Its absence is discussed in the Limitations section of the report.

## Technology stack

**Frontend:**
- React 18 with Vite
- Tailwind CSS for styling
- Radix UI for accessible interactive primitives
- React Router for routing
- React Query for server state synchronization
- React Screen Wake Lock to prevent device sleep during workouts

**Backend:**
- Supabase (PostgreSQL database and authentication)

**Tooling:**
- Vitest for unit testing
- Storybook for component development
- ESLint and Prettier for code quality

## Data model

The cognitive task structure analyzed in the report is reflected directly in the database schema:

- `workout_logs` — session-level records, including goal type and target, interval and rest durations, start and completion timestamps, completed rounds, total reps, total volume, and post-workout RPE rating
- `movement_logs` — child records of `workout_logs`, one per movement performed, capturing movement name, weight (with separate slots for left and right kettlebells), and the rep scheme array

The full schema is available in `types/supabase.ts`.

## Running locally (optional)

The production app at [app.bellskill.com](https://app.bellskill.com) is the recommended way to interact with BellSkill. Local setup is supported for development purposes but requires a separately provisioned Supabase backend.

### Prerequisites
- Node.js (v18 or later recommended)
- npm

### Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/djbowers/bellskill.git
   cd bellskill
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Supabase environment variables. Create a `.env.local` file in the project root with credentials for your own Supabase project.

4. Fetch the latest types from the backend:
   ```bash
   npm run fetch-types
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

   To run the development server accessible from other devices on your local network (useful for testing on a phone):
   ```bash
   npm run dev:host
   ```

### Other commands
- `npm test` — run the test suite
- `npm run build` — build for production
- `npm run lint` — run the linter
- `npm run storybook` — launch Storybook for component development

## Notes for course reviewers

This code is provided for methodological transparency in support of the CS 6795 final report rather than as a graded artifact. The easiest way to interact with the application is the live production version at [app.bellskill.com](https://app.bellskill.com). The repository is public and accessible without credentials for those who want to inspect the source.