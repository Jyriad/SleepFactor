# SleepFactor Git Workflow: Dual-Branch Setup

This file explains how the project should handle **rapid bug fixes** and **longer feature work** at the same time.

## Goal

We run two active work streams in parallel:

- `bugfix/user-testing-fixes` for urgent tester issues and release-ready fixes
- `feature/fitbit-integration` for larger Fitbit feature development

This keeps releases fast while major feature work continues safely.

## Branch Roles

- `main`
  - Stable branch used as the release base.
  - Bug fixes should land here quickly through normal merge flow.

- `bugfix/user-testing-fixes`
  - Used for quick-turn changes from live user testing.
  - Keep changes small, focused, and easy to ship.

- `feature/fitbit-integration`
  - Used for Fitbit integration and related work.
  - May contain in-progress work that is not yet release-ready.

## Agent Instructions (Important)

Before making any edits, always confirm the active branch and match it to the task:

- If task is urgent user issue -> work on `bugfix/user-testing-fixes`
- If task is Fitbit feature work -> work on `feature/fitbit-integration`

Do not mix bug-fix and Fitbit scope in one change set unless explicitly requested.

## Commit and Merge Policy

- Commit related changes only to the currently intended branch.
- Merge bug-fix branch changes into `main` for releases.
- Keep Fitbit work isolated until ready, then merge into latest `main`.
- Regularly sync Fitbit branch with latest `main` to reduce merge conflicts later.

## Safety Checks Before Any Work

1. Confirm active branch is correct.
2. Confirm uncommitted changes are expected for current task.
3. If changes belong to another branch, stop and ask before continuing.

## Why This Works

- Enables rapid response to tester feedback.
- Prevents unfinished Fitbit work from blocking releases.
- Preserves clean history and lowers integration risk.

## Quick Start Prompt (for future agent sessions)

"Use our dual-branch workflow from `git.md`. Confirm active branch first.  
Bug fixes go to `bugfix/user-testing-fixes`.  
Fitbit work goes to `feature/fitbit-integration`.  
Do not mix scopes."
