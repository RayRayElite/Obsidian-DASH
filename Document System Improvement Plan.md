# Document System Improvement Plan

This document turns the current document-improvement ideas into a concrete, trackable plan for Obsidian DASH - Daily Action & System Hub.

It is intentionally split into two parts:

1. A complete idea list so nothing gets lost.
2. Filled starter templates so the system can be improved without waiting on a blank-sheet rewrite.

## Full Improvement List

### Master Task Hub

- [ ] Add `Project Summary::` to each project so the purpose is readable without opening the project note.
- [ ] Add `Definition Of Done::` so active work has a clearer finish line.
- [ ] Add `Last Review:: YYYY-MM-DD` to improve stale-project diagnosis.
- [ ] Add `Waiting On::` for project-level blockers that affect more than one task.
- [ ] Add `Why It Matters::` so priority survives when the hub gets crowded.
- [ ] Split `### Reference` into `### Reference` and `### Decisions`.
- [ ] Add `### Parking Lot` distinct from `### Later`.
- [ ] Add a `### Risks` section per project.
- [ ] Add a `### Constraints` section per project note.
- [ ] Add a `### Useful Links` or `### Assets` section.
- [ ] Add lightweight task annotations for `Effort::` or `Energy::` matching.
- [ ] Add lightweight task annotations for `Context::` or `Mode::` such as admin, deep work, phone, or errands.
- [ ] Add `Trigger::` support for tasks that are event-driven rather than date-driven.
- [ ] Add a `Minimum Step::` concept for vague tasks.
- [ ] Add a small curated `Portfolio Snapshot` section at the top of the hub.

### Project Notes

- [x] Standardize a stronger project-note header.
- [ ] Add `### Risks`.
- [ ] Add `### Constraints`.
- [ ] Add `### Decisions`.
- [ ] Add `### Change Log` for meaningful shifts in direction or scope.
- [ ] Add `### Known Terms / Definitions` for domain-specific language.
- [ ] Add `### Review History` or link to review notes.
- [ ] Add `### Relationships` with both dependencies and supporting notes.

### Personal Context And AI Context

- [ ] Restructure `Basic Information` into stable categories instead of one loose note.
- [ ] Add a separate `AI Guardrails` note for behavioral rules and coaching preferences.
- [ ] Add a `Current Season` note for temporary life context.
- [ ] Add a `Decision Journal` note type.
- [ ] Add a `Recurring Friction Patterns` note sourced from logs and reviews.

### Daily, Weekly, And Monthly Artifacts

- [ ] Add a compact summary block at the top of daily logs.
- [ ] Add `Context Links` to daily logs so relevant project notes are easier to revisit.
- [ ] Add `Open Loops Created Today` and `Open Loops Closed Today` lines.
- [x] Add stronger frontmatter conventions to generated notes.
- [x] Standardize section order across generated markdown artifacts.
- [ ] Add review-by-exception summaries to weekly review outputs.

### System Documentation

- [x] Add one canonical `How This System Works` note.
- [x] Add a `What Goes Where` reference.
- [x] Add examples of good task wording.
- [x] Add examples of bad task wording.
- [x] Add an archive policy reference.
- [x] Add a `System Map` note listing the major notes, folders, and their roles.
- [x] Add a `Document Freshness` review checklist for evergreen notes.
- [ ] Add a `Reference Offload Inbox` pattern.

### Longer-Term Workflow Improvements

- [ ] Add a `People / External Dependencies` note if the workload has many outside blockers.
- [ ] Add `Shelf Life` guidance for reference notes and parked context.
- [ ] Add a weekly project-review archive folder with one note per review cycle.
- [ ] Add a more explicit review-by-exception workflow.

## Filled Starter Standards

These are the first pieces to implement in documentation because they do not need plugin code changes and they already fit the current system.

### Recommended Master Task Hub Metadata

Use this richer metadata set for active projects when the context exists:

- `Project Note:: [[Projects/Project Name]]`
- `Status:: Active | Incubating | Someday`
- `Focus:: What this project is trying to do right now`
- `Project Summary:: One-sentence purpose of the project`
- `Why It Matters:: Why this project deserves active attention`
- `Definition Of Done:: What counts as meaningfully complete`
- `Last Review:: YYYY-MM-DD`
- `Waiting On:: External dependency or blocker, if any`
- `Relationships:: [[Related Note]], [[Related Project]]`

### Recommended Master Task Hub Sections

Use this section set for active projects:

- `### Now`
- `### Next`
- `### Later`
- `### Parking Lot`
- `### Repeating`
- `### Risks`
- `### Constraints`
- `### Decisions`
- `### Reference`
- `### Completed Archive`

Working distinction:

- `Later` means real work that matters, just not now.
- `Parking Lot` means maybe, someday, or idea-stage material that should not pollute planning.
- `Reference` means durable support material.
- `Decisions` means choices already made, why they were made, and what they affect.

## Filled Example: Master Task Hub Project Block

```md
## Obsidian DASH - Daily Action & System Hub
Project Note:: [[Projects/Obsidian DASH - Daily Action & System Hub]]
Status:: Active
Focus:: Simplify the dashboard surface, sharpen document structure, and improve long-term AI context.
Project Summary:: Obsidian plugin that acts as a daily operating system for action management, tracking, reporting, and AI-supported review.
Why It Matters:: This is the central tool that coordinates execution, reflection, and project visibility across the broader personal system.
Definition Of Done:: The dashboard is operationally clean, core document workflows are explicit, and generated notes stay readable and searchable.
Last Review:: 2026-04-03
Waiting On:: None
Relationships:: [[Master Task Hub]], [[Basic Information]], [[Current Season]], [[AI Guardrails]]

### Now
- [ ] Tighten README and system documentation so note roles are explicit.
- [ ] Simplify dashboard cards where the UI still exposes stale workflow assumptions.
- [ ] Improve the master-hub and project-note structure for better long-term review and AI retrieval.

### Next
- [ ] Standardize project-note templates.
- [ ] Improve generated note frontmatter and summary blocks.
- [ ] Add a documented review-by-exception workflow.

### Later
- [ ] Evaluate richer task annotations for effort, context, and trigger-driven work.

### Parking Lot
- Idea: cross-project dependency map note.
- Idea: stronger people / external dependency layer.

### Repeating
- Weekly README and roadmap consistency pass [repeat: weekly fri]

### Risks
- Feature growth can outpace document clarity.
- AI context quality will degrade if evergreen notes stay underspecified.

### Constraints
- Keep the plugin readable and desktop-first.
- Prefer human-readable markdown over opaque storage layers.
- Avoid workflow complexity that creates upkeep burden.

### Decisions
- Action Queue replaced the old visible Top 3 block in the main execution card.
- Day Flow was folded into Session Deck, Vitals, and notifications.

### Reference
- Repo: https://github.com/RayRayElite/Obsidian-Dashboard-Plugin

### Completed Archive
- [x] Renamed plugin surfaces to Obsidian DASH - Daily Action & System Hub
```

## Filled Example: Project Note Template

```md
# Obsidian DASH - Daily Action & System Hub

Status:: Active
Focus:: Improve clarity, document roles, and long-term context quality.
Project Summary:: Obsidian plugin for daily execution, tracking, reporting, and AI-supported planning.
Why It Matters:: This project acts as the operating layer for the rest of the system.
Definition Of Done:: The dashboard is practical to use daily, documents are explicit, and generated artifacts stay easy to review.
Last Review:: 2026-04-03
Waiting On:: None
Relationships:: [[Master Task Hub]], [[Basic Information]], [[Current Season]], [[AI Guardrails]]

## Current Bottleneck
- The plugin has strong feature depth, but document roles and context layers are still looser than they should be.

## Now
- Tighten the document system.
- Reduce UI/document mismatches.

## Next
- Improve generated note structure.
- Add review-by-exception standards.

## Risks
- Too many overlapping notes can dilute operational clarity.
- AI retrieval quality drops when evergreen notes stay vague.

## Constraints
- Prefer low-maintenance workflows.
- Keep markdown readable without plugin-specific lock-in.

## Decisions
- Keep plugin state as the operational source of truth.
- Keep logs human-readable and searchable.

## Reference
- README guidance
- roadmap notes
- design decisions worth preserving

## Review History
- 2026-04-03: started formal document-system cleanup planning.
```

## Recommended Supporting Notes

These notes would make the existing plugin workflows materially better without changing the daily flow much.

### Basic Information

Purpose: stable personal facts and durable operating context.

Recommended sections:

- Identity and baseline facts
- Health context that meaningfully affects planning
- Preferences and dislikes
- Interests and energizing activities
- Persistent constraints
- Useful AI context

### AI Guardrails

Purpose: how the AI should behave, not who the user is.

Recommended sections:

- Tone preferences
- Coaching style preferences
- Risk tolerance
- What to avoid suggesting
- When to prioritize recovery over output
- How to handle uncertainty

Filled starter draft:

```md
# AI Guardrails

## Tone
- Prefer direct, practical language over motivational writing.
- Explain tradeoffs clearly when suggesting changes.

## Planning Behavior
- Optimize for operational clarity, not maximal ambition.
- Prefer the smallest viable next step when a task is vague.
- Separate evidence from inference when interpreting trends.

## Avoid
- Do not overstate certainty from weak signals.
- Do not recommend unnecessary system complexity.
- Do not confuse reference material with actionable work.

## Recovery And Health
- Treat low energy, poor sleep, or high friction as planning constraints, not character failures.
- When recovery signals are bad, reduce load before increasing pressure.
```

### Current Season

Purpose: temporary context that matters right now but should not live forever in Basic Information.

Recommended sections:

- Main priorities this month
- Current constraints
- Recurring appointments or obligations
- Known stressors
- What success looks like this season

### Decision Journal

Purpose: preserve important choices with enough context to revisit them later.

Recommended template:

```md
# Decision Journal

## 2026-04-03 - Document system cleanup
- Decision: formalize master hub and project note standards before adding more workflow complexity.
- Why: the plugin already has enough data depth that loose note structure is now a real bottleneck.
- Expected outcome: cleaner review cycles, better AI context, and lower long-term drift.
- Revisit when: the next major documentation or template pass is complete.
```

### System Map

Purpose: one-page map of what each major document area does.

Filled starter draft:

```md
# System Map

## Core Operational Notes
- [[Master Task Hub]]: cross-project action inventory and status view.
- Project notes folder: per-project context, decisions, risks, and reference.

## Personal Context Notes
- [[Basic Information]]: stable personal context.
- [[AI Guardrails]]: behavioral rules for AI outputs.
- [[Current Season]]: temporary priorities and constraints.
- [[Decision Journal]]: preserved reasoning behind important choices.

## Generated Artifacts
- Dashboard Logs/Daily: human-readable day history.
- Dashboard Logs/AI: AI outputs and suggested actions.
- Dashboard Logs/Cleanup Suggestions: grouped cleanup review artifacts.
- Dashboard Logs/Gamification: score breakdown reports.
- Dashboard Logs/Wins Archive: searchable success summaries.

## Review Notes
- Weekly review notes: regular reflection and planning checkpoints.
- Project review notes: focused project drill-down and exception review.
```

## Generated Note Standards

Recommended frontmatter shape for generated markdown when applicable:

```yaml
artifact-type: daily-log | weekly-review | weekly-report | monthly-report | ai-note | cleanup-note | export-summary
source: obsidian-dash
date: YYYY-MM-DD
period: optional descriptive period label
project: optional project name
tags:
  - obsidian-dash
```

Recommended top-of-note summary block for daily logs and review notes:

- Main win
- Main blocker
- Biggest drift
- Key health signal
- Most important follow-up
- Context links

## What To Start First

Highest-value document improvements from the current state:

1. Strengthen Master Task Hub metadata.
2. Standardize project-note sections.
3. Split Basic Information from AI Guardrails and Current Season.
4. Add a System Map and What Goes Where reference.
5. Add compact summary blocks to generated notes.
