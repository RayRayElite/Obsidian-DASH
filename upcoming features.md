# Upcoming Features

This document tracks approved feature work for Daily Dashboard.

Mark items complete as they ship so this stays the live roadmap instead of a stale brainstorm list.

## Foundation And Data

- [x] Track bowel movement count per day in addition to tracked bowel time.
- [x] Add event editing for single recurring occurrences, not only full series.
- [x] Add recurrence exceptions like skip, move once, and cancel one occurrence.
- [x] Add calendar categories such as work, health, errands, social, and personal.
- [ ] Add event-to-project linking.
- [x] Add task due dates in the master task hub and surface due-soon / overdue work.
- [x] Add blocked-task state with blocker reason and unblock target date.
- [ ] Expand repeating task support for weekly, monthly, interval, and weekday-specific rules.
- [ ] Add export mode for markdown / CSV metric dumps.

## Execution And Focus

- [x] Edit Top 3 items inline without deleting and recreating them.
- [x] Drag to reorder Top 3 items.
- [x] Carry forward unfinished Top 3 items into the next logical day with confirmation.
- [x] Let calendar reminders become real temporary focus rows with accept / dismiss actions.
- [x] Add notes on Top 3 items for links, context, or next steps.
- [x] Track estimate versus actual time for Top 3 items.
- [x] Add a Next Up queue under Top 3.
- [x] Add quick-capture actions for Top 3 from commands and anywhere in Obsidian.
- [x] Add pause-all / start-break flow.
- [x] Add session tags like deep work, admin, creative, errands, and recovery.

## Logical Day And Tracking

- [x] Add automatic day-end suggestions after inactivity.
- [ ] Add sleep debt and sleep consistency views.
- [x] Add late-night rollover warnings.
- [ ] Add wake quality check-ins.
- [ ] Add energy timeline check-ins during the day.
- [ ] Add better unknown-time diagnosis.
- [ ] Add manual day timeline editor for repair workflows.
- [ ] Add live session timeline strip for the current day.
- [ ] Add "What did I spend today on?" grouped summaries.
- [ ] Add recurring routine templates tied to time windows.

## Calendar And Planning

- [ ] Add travel / prep lead times for reminders.
- [ ] Add multi-day events.
- [ ] Add a weekly agenda card.
- [ ] Add time-blocking from focus items into the calendar.
- [ ] Generate suggested Top 3 based on calendar, stale work, and due repeating tasks.
- [ ] Render richer calendar context into daily notes with project links and follow-through checkboxes.

## Project And Task Workflow

- [ ] Add project health drill-down with reasons behind score / status.
- [ ] Extract a visible next action for every project.
- [ ] Add someday / incubating project state.
- [ ] Add project momentum charts.
- [ ] Add duplicate / stale / empty project cleanup suggestions.
- [ ] Add structured project review checklist mode.

## Habits, Health, And Personal Data

- [ ] Add habit completion windows such as morning, afternoon, evening, and before bed.
- [ ] Add habit miss notes.
- [ ] Add habit difficulty weighting.
- [ ] Add water, caffeine, supplements, and medication tracking.
- [ ] Add symptom or pain tracking.
- [ ] Add bowel movement quality tags in addition to count and duration.
- [ ] Add recovery score blending sleep, naps, relax time, anxiety, and misses.
- [ ] Add "What helped today?" and "What hurt today?" micro-reflections.
- [ ] Add weekly personal trend reporting.

## Gamification Center

- [ ] Add a Gamification Center card and report flow.
- [ ] Create daily, weekly, and monthly scores that compare against perfect runs and past performance.
- [ ] Decide whether scoring is deterministic, AI-assisted, or hybrid.
- [ ] Track streaks, personal bests, and recovery from low-score days.
- [ ] Add category sub-scores for execution, health, consistency, recovery, and planning.
- [ ] Add explanation views so score changes are auditable instead of opaque.

## AI Layer

- [ ] Add AI morning startup brief.
- [ ] Add AI shutdown summary with carry-forward recommendations.
- [ ] Add AI weekly planning assistant.
- [ ] Add AI project risk scanner.
- [ ] Add AI anomaly detection for mood, sleep, work time, and habits.
- [ ] Add AI period comparison reports.
- [ ] Add AI project synthesis from dashboard + calendar + logs + notes.
- [ ] Add "Ask why today felt off" analysis.
- [ ] Force AI coaching outputs to end with concrete actions.
- [ ] Add local prompt templates for different AI modes.

## Search, Review, And Reporting

- [ ] Add full timeline search across sessions, tasks, logs, and calendar.
- [ ] Add saved dashboard filters.
- [ ] Add heatmaps for work, sleep, and habits.
- [ ] Add blocker-pattern reporting from friction logs.
- [ ] Add accomplishment reports grouped by project and period.
- [ ] Add richer month-end narrative reports.
- [ ] Add missed-habit pattern reports.
- [ ] Add searchable wins archive.
- [ ] Add adaptive reflection prompts based on day type.

## View Modes, Layout, And UX

- [x] Add impactful compact mode with denser cards, reduced chrome, and preserved readability.
- [x] Add mobile mode tuned for the current vertical 9:16 layout.
- [x] Add horizontal / widescreen mode designed intentionally instead of stretched mobile layout.
- [x] Add a lower-right hero control button for switching view modes.
- [ ] Keep all modes visually balanced and as symmetrical as possible.
- [ ] Add layout customization for card order, hidden cards, and pinned cards.
- [x] Add nested collapsible subsections inside cards for finer-grained control.
- [ ] Add keyboard shortcuts for major dashboard actions.
- [ ] Add undo for destructive actions.
- [ ] Add notification center for reminders and system notices.
- [ ] Add first-run setup wizard.

## Suggested Implementation Order

- [x] Track bowel movement count.
- [x] Build the view-mode foundation before adding compact, mobile, and widescreen variants.
- [x] Expand calendar recurrence editing and exception handling.
- [x] Improve Top 3 editing, carry-forward, and reminder acceptance.
- [x] Add due dates / blocked states to project workflow.
- [x] Add automatic day-end suggestions and rollover warnings before deeper sleep analytics.
- [ ] Build the Gamification Center once the underlying metrics are richer and more stable.
- [ ] Add AI morning and shutdown workflows after the execution/planning data model is stronger.
