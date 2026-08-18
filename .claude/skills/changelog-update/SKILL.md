---
name: changelog-update
description: Update CHANGELOG.md from merges to main since the last recorded entry, then refresh the release notes on bellskill.com. Opens a PR in each repo. Run weekly by launchd or manually after a deploy.
---

# Changelog update

Two deliverables, each landing as its own PR: `CHANGELOG.md` in this repo, and the
matching month's release notes in `~/Code/bellskill.com/src/content/release/`.

## 1. Find new merges

1. `git fetch origin main` and work from `origin/main`.
2. Read the top month section of `CHANGELOG.md` and note the highest PR number linked
   anywhere in it — that is the high-water mark (state lives in the changelog itself;
   there is no separate state file).
3. List candidate commits: `git log origin/main --format='%ad %s' --date=short` and keep
   those whose `(#NNN)` suffix exceeds the high-water mark, plus any non-PR commits newer
   than the newest date already recorded.
4. **If there is nothing new, stop here.** Print "changelog up to date" and exit without
   creating branches or PRs.

## 2. Update CHANGELOG.md (bellskill repo)

- Branch from `origin/main`: `claude/changelog-YYYY-MM-DD`.
- Append entries to the current `## YYYY-MM` section (create it if the month is new,
  keeping newest-month-first order). Follow the file's existing rules: group under
  **Added** / **Fixed** / **Changed** / **Infrastructure**, sentence-case summaries,
  link each PR as `[#NNN](https://github.com/djbowers/bellskill/pull/NNN)`, drop pure
  noise (dependency bumps, version-only chores). Read PR titles/bodies with
  `gh-axi pr view NNN` when a commit subject alone is unclear.
- Commit as `docs(changelog): record merges through #NNN`, push, and open a PR with
  `gh-axi pr create` using the What/Why/How-tested structure from the PR template.

## 3. Update release notes (bellskill.com repo)

- Work in `~/Code/bellskill.com`; `git fetch` and branch from `origin/main`:
  `claude/release-notes-YYYY-MM-DD`.
- Update or create `src/content/release/YYYY-MM.md` for the current month from the same
  set of merges, **user-facing only**: features and fixes a user would notice. Skip
  chores, CI, migrations, refactors, flags that shipped nothing visible.
- Voice: read `~/Second Brain/20 Areas/DJ Bowers/My Writing Voice — Guide for AI Drafts.md`
  first and write highlights in that voice — short, warm, reader-addressed. Match the
  frontmatter shape of existing files in `src/content/release/`.
- Commit as `content(changelog): YYYY-MM release notes through bellskill#NNN`, push, and
  open a PR the same way.

## 4. Report

Print both PR URLs (or "no changes") as the final output. Never merge either PR —
they wait for DJ's review.
