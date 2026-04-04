# Daily Dashboard Workspace Instructions

## Project Goal

Build an Obsidian plugin that acts as a practical daily operating dashboard for one person, with strong desktop usability, readable vault artifacts, and lightweight project-management support.

The current priority is a solid desktop-first product. Cross-device sync is explicitly deprioritized for now and should not drive architecture unless the user asks to revisit it.

## Current Product Direction

1. Optimize for a reliable desktop workflow first.
2. Keep the plugin state model simple and inspectable.
3. Treat daily markdown logs as readable history, not as a complicated sync protocol.
4. Avoid reintroducing mirrored live-state files, sync polling, or multi-layer conflict logic unless the user explicitly asks for that work again.
5. Focus on habit tracking, logical-day flow, project triage, AI assistance, and a dashboard the user actually enjoys using.

## User Collaboration Style

The user is an amateur developer and is actively learning.

When explaining code, architecture, or tradeoffs:

1. explain unfamiliar concepts directly when they matter;
2. prefer concrete reasoning over shorthand jargon;
3. make tradeoffs practical, such as simpler debugging, lower fragility, or clearer ownership of data;
4. challenge weak assumptions when needed, but do it constructively;
5. keep explanations teaching-friendly without padding them.

## Clarifying Questions Workflow

Before starting substantial implementation work, first decide whether clarification is needed to avoid rework or to tailor the result better.

If clarification is needed:

1. ask all relevant questions in a single grouped follow-up using the ask-questions flow when available;
2. keep the questions concise and only ask what is necessary to unblock good implementation;
3. prefer one batch of questions over multiple back-and-forth turns;
4. after the user answers, continue the original task immediately without requiring them to restate it.

If the task is clear and low-risk:

1. do not ask unnecessary questions;
2. proceed directly.

Use clarifying questions especially for:

1. ambiguous UI or UX requests;
2. missing constraints or priorities;
3. multiple valid implementation directions;
4. cases where user preference materially changes the solution.

## Core Architecture Expectations

1. `main.ts` is the plugin entrypoint and orchestration layer and should stay understandable.
2. Plugin data should be the primary runtime state store unless there is a strong reason to change it.
3. Daily logs under `Dashboard Logs/Daily` should remain human-readable and useful outside the plugin.
4. Reports and AI artifacts should stay as normal vault files so the user can inspect them.
5. Avoid adding hidden background systems when an explicit command or direct file write is enough.

## File Structure

The current code layout is intentionally a small modular monolith.

1. `main.ts` owns plugin lifecycle, command registration, vault event hooks, persistence orchestration, and top-level Obsidian integration.
2. `src/dashboard-types.ts` holds shared interfaces, regex/constants, and `DEFAULT_SETTINGS`.
3. `src/dashboard-core.ts` holds shared non-UI helpers such as settings normalization, note-index logic, AI retrieval helpers, and general date/string utilities.
4. `src/dashboard-logs.ts` holds daily-log rendering/parsing plus work-session, nap-session, and report helpers.
5. `src/dashboard-todo.ts` holds Master Task Hub parsing, archive automation, project scaffolding text, repeating-task logic, and reference offload helpers.
6. `src/dashboard-ui.ts` holds the dashboard view, modal classes, settings tab, and UI-only helper functions.

Interpretation guidelines for future refactors:

1. Put Obsidian lifecycle and command wiring in `main.ts`.
2. Put pure reusable logic in the `src/dashboard-*.ts` modules instead of back into `main.ts`.
3. Keep UI rendering and form/view classes in `src/dashboard-ui.ts` unless the UI grows enough to justify another dedicated UI file.
4. Prefer adding to an existing domain file before creating a new file, unless the new domain is clearly distinct and large enough to stand on its own.
5. Avoid returning to a single giant file, but also avoid fragmenting the project into many tiny files that make AI edits harder to follow.

## Working Style

1. Prefer focused incremental changes over broad speculative rewrites.
2. Before major edits, inspect the relevant code paths and current repo state.
3. If a task changes behavior, storage, commands, or workflow, update the README and this folder's memory docs in the same task.
4. Use PowerShell on Windows for terminal work in this repo.
5. Prefer `rg` for search.

## Build And Run Notes

1. Install dependencies with `npm install`.
2. Build with `npm run build`.
3. Use `npm run watch` for rapid iteration when the vault points at this workspace.
4. Use `npm run build:deploy -- "D:/Game Dev/Projects/.obsidian/plugins/daily-dashboard"` when the user wants a normal deploy that copies the built plugin into the vault plugin folder.
5. The deploy scripts matter because this repo is used against a real Obsidian vault on Windows paths with spaces.

## Code Guidelines

1. Fix root causes instead of layering more special cases on top.
2. Preserve existing Obsidian-facing behavior unless the task intentionally changes it.
3. Keep comments sparse and only add them when the code would otherwise be hard to parse.
4. Prefer explicit helper functions over deeply tangled inline logic.
5. Keep UI changes aligned with the existing visual language unless the user asks for a redesign.

## Documentation And Memory Files

1. `README.md` is the user-facing project guide and should reflect the current product direction.
2. `.github/copilot-instructions.md` stores the workspace-wide Copilot rules that should load across actions in this repo.
3. `Memory/WORKLOG.md` stores recent factual project history.
4. Read the last 10 worklog entries before substantial implementation work.
5. After meaningful changes, add one compact worklog entry near the top.
6. Use a real local timestamp from PowerShell for worklog entries with `Get-Date -Format "yyyy-MM-dd HH:mm:ss"`.

## Git Workflow

1. Inspect repo status before committing.
2. If the worktree is dirty, check file-level diffs so unrelated edits are not swept into the commit.
3. After meaningful changes, commit and push unless the user says not to.
4. Keep commit messages short and descriptive, such as `Fix: ...`, `Docs: ...`, or `Refactor: ...`.
5. Do not rewrite history unless the user explicitly asks.

## Decision Standard

When choosing between options, prefer the one that:

1. makes the plugin more reliable for the user's actual daily use;
2. is easier to understand and debug later;
3. keeps vault artifacts readable;
4. avoids unnecessary architectural complexity;
5. leaves room for future expansion without paying that complexity cost now.