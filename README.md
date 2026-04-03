# Daily Dashboard

Daily Dashboard is an Obsidian plugin that opens as its own dashboard tab instead of injecting a panel into the workspace chrome.

## What It Does

- tracks repeat daily habits with per-day counts, preferred completion windows, difficulty weights, and per-habit miss notes
- stores mood, energy, wake quality, a richer Top 3 focus list with notes, effort estimates, drag reordering, a Next Up queue, calendar blocking actions, suggested Top 3 candidates, friction log, timestamped food entries, timestamped intake logs for water/caffeine/supplements/medication, symptom and pain entries, sleep log, dream log, micro-reflections, and daily notes
- supports user-controlled logical days with begin-day/end-day tracking, inactivity-based day-end nudges, and late-night rollover warnings so late-night work does not roll into the wrong calendar day
- tracks work sessions, nap sessions, and bowel movement count plus duration and quality tags inside the active logical day for more accurate sleep and activity history, with optional session tags like deep work, admin, creative, errands, and recovery
- includes a built-in monthly calendar where you can click a day to add one-off or recurring events, categorize them as work, health, errands, social, or personal, link them to a tracked project, add per-event prep and travel lead times, span events across multiple days, edit a single recurring occurrence without touching the whole series, skip or cancel one occurrence, surface upcoming reminders below the Execution block, see a weekly agenda card, and sync events into markdown for later AI analysis
- writes a markdown daily log note for every tracked day
- generates weekly reviews plus weekly and monthly markdown reports from those daily logs
- exports dashboard history into a markdown summary plus CSV dumps for daily metrics, habits, completed tasks, and calendar events
- can call OpenAI for AI-powered morning startup briefs, shutdown summaries, weekly planning, project risk scans, anomaly detection, period comparisons, project synthesis, "why today felt off" analysis, active-note analysis, and freeform questions grounded in dashboard context
- reads a master todo note to show project workload snapshots, stale work, health trends, linked notes, and completion progress
- automatically archives completed checklist items from the master todo into a per-project completed archive section with date and time
- lets you quick-add tasks into project sections, promote project tasks into today focus, quick-capture new focus items, pause active sessions into a break, search archived work history, sync repeating tasks, and offload project references into project notes
- includes switchable mobile, compact, and widescreen dashboard modes, a layout editor for card order / hidden / pinned preferences, fixed keyboard shortcuts for major actions, undo for dashboard-side destructive actions, a hero-bar notification popover for reminders and system notices, a first-run setup wizard, and collapsible subsections to keep dense cards usable
- lets you pick a hero wallpaper from a vault folder in plugin settings

Task lines in the master hub can now include lightweight annotations such as `[due: 2026-04-05]`, `[blocked: waiting on API key]`, and `[unblock: 2026-04-08]`. The dashboard strips those tags out for display, but uses them to surface due-soon, overdue, and blocked work in project health, cleanup alerts, promotion flows, and AI context.

## Master Todo Workflow

Point the plugin at your `Master Task Hub.md` note in settings. The note works best when each project uses a `##` heading and includes optional metadata such as `Project Note:: [[Note Name]]`, `Status::`, `Focus::`, and `Relationships::`.

1. keep active work as unchecked checklist items in non-reference sections
2. mark a task complete with `- [x]`
3. the plugin automatically moves it into that project's `Completed Archive` section and records it in that day's dashboard log

This gives you a work-history trail without deleting finished tasks.

The richer dashboard flow also works best when projects keep `### Now`, `### Next`, `### Later`, `### Repeating`, `### Completed Archive`, and `### Reference` sections. New projects created by the plugin now include that structure automatically.

The `### Repeating` section now supports richer repeat rules instead of only simple weekly-style tags. Plain bullets and checklist bullets both work. Supported forms include `- Pay rent [repeat: monthly day 1]`, `- Water plants [repeat: every 10 days]`, `- Review backlog [repeat: every 2 weeks]`, `- Gym session [repeat: weekdays mon wed fri]`, plus the legacy short forms like `[daily]`, `[weekly]`, `[monthly]`, and `[yearly]`. When synced into the master hub, due repeating tasks are inserted into `### Next` with their normalized repeat tag preserved.

Project health now surfaces a visible next action for every project, explains the reasons behind each health score, renders compact momentum bars from recent completion history, and respects `Status:: Incubating` or `Status:: Someday` so parked work does not look artificially broken just because it is not active right now.

The cleanup workflow now expands into project-level drill-down rows for stale, duplicate, empty-section, blocked, overdue, and needs-breakdown issues, and the cleanup note command writes a grouped portfolio review note instead of a flat alert dump. Project review mode also now supports a structured checklist note that opens beside the master hub and project note so weekly or ad hoc reviews can happen in a consistent three-pane setup.

## Logical Day Tracking

The dashboard now separates your real day from the calendar date.

1. Use `Begin logical day` when you are actually up and starting the day.
2. Use `End logical day` when you are done and heading to bed, even if the clock has passed midnight.
3. Use `Start work session` and `Stop work session` to track actual focused work time inside that logical day.
4. Use `Start nap session` and `Stop nap session` whenever you sleep during the day so naps are logged separately from your final sleep time.

The `Day Flow` card now also watches for long stretches of inactivity and shows an automatic prompt when the logical day looks finished. If the clock rolls past midnight while the logical day is still active, the card and notice system warn that new sessions and edits are still landing on yesterday until you explicitly end the day.

The dashboard records wake time, sleep time, day start/end, tracked work sessions, and tracked naps into the daily log note and period reports.

The recovery block now adds a wake-quality score, a rolling sleep debt summary, a sleep consistency view, a blended recovery score, and a recent-nights strip so you can see whether the last week is actually stable instead of guessing from one bad night. The state card now uses timestamped mood, energy, and anxiety check-ins during the day, and mood entries can capture a named feeling alongside the score.

The Day Flow card now also includes a grouped time-allocation summary for the current logical day, plus unknown-time diagnostics that call out missing timestamps, active days, and likely timer gaps. That makes the old generic "unknown" bucket actionable instead of just vague leftover time.

The logical day repair flow now includes a manual timeline editor for work, nap, relax, break, and bowel sessions, plus the Day Flow card shows a live session strip for the current logical day. That makes it possible to repair bad timer history directly instead of only patching totals.

Day Flow now also supports recurring routine templates tied to time windows. Define them in settings using `Label|HH:MM|HH:MM`, and the dashboard will surface them when they are due, let you queue them into `Next Up`, and dismiss them for the rest of the day once handled.

The planning layer now also includes a `Weekly Agenda` card plus suggested Top 3 candidates that blend near-term calendar items, overdue or due-soon tasks, repeating work, and stale projects. Top 3 rows, Next Up rows, and suggestion rows can all create a quick work block directly in the calendar using the estimate on the item when one exists.

Calendar events can now span multiple days and carry event-specific prep and travel lead times, so reminders can surface before the actual start instead of only at the start itself. Daily log notes also render richer calendar context with linked project references pulled from event notes plus persistent follow-through checkboxes for each day’s events.

Habit completions now also capture timestamps for each completion step, can be assigned morning/afternoon/evening/before-bed windows plus difficulty weights, and support daily miss notes. Food entries capture the time they were logged, the body log now tracks water/caffeine/supplements/medication plus symptoms and pain, and the notes block includes quick "What helped today?" and "What hurt today?" reflections. Weekly and monthly reports now also include explicit personal trend sections so recurring drift, repeat misses, symptom patterns, and reflection themes are surfaced instead of staying buried in day logs.

The dashboard now also includes a `Gamification Center` with deterministic daily, weekly, and monthly scores, category sub-scores for execution, health, consistency, recovery, and planning, streak and personal-best tracking, low-score rebound tracking, and auditable explanation rows for why each score moved. A dedicated gamification report command writes the current score breakdown into `Dashboard Logs/Gamification`.

Calendar events can now carry an explicit project link instead of relying only on note text. That project context now shows up in the agenda, reminders, timeline search, calendar markdown, and daily-log follow-through block.

The command palette now also includes `Export dashboard metrics as markdown and CSV`, which writes a timestamped bundle under the configured export folder. The export currently includes `summary.md`, `daily-metrics.csv`, `habit-metrics.csv`, `completed-tasks.csv`, and `calendar-events.csv`.

Weekly and monthly reports now also surface repeated blocker patterns from friction logs, accomplishments grouped by project, missed-habit pattern summaries with recent miss notes, and a richer deterministic month-end narrative instead of only raw metric tables. The dashboard also includes adaptive reflection prompts in the notes card and a `Wins archive` command that writes a searchable markdown summary under `Dashboard Logs/Wins Archive`.

The dashboard now also includes a full `Timeline Search` card that searches archived tasks, tracked sessions, calendar events, and text logs from one surface instead of splitting history across separate cards. The same area can store reusable dashboard filter presets and now ships with recent heatmaps for work, sleep, and weighted habit completion.

Dashboard layout is now user-tunable instead of fixed. The lower-right hero controls include a layout editor that can reorder the main grid cards, hide sections you do not want on screen, and pin the few cards that should always rise to the top. Compact and widescreen modes were also rebalanced so major cards land in cleaner, more symmetrical rows instead of feeling like stretched mobile leftovers.

The same hero control cluster now exposes a shortcut help button, and the dashboard responds to fixed `Alt+Shift` shortcuts for the most common actions while focus is inside the view: cycling view mode, opening the layout editor, creating a project, refreshing the dashboard, opening quick focus capture, launching Ask AI, syncing repeating tasks, and opening the shortcut sheet itself.

Destructive dashboard actions now also get a visible in-view undo rail. When you remove a Top 3 item, Next Up item, habit definition, food entry, intake entry, or symptom entry from the dashboard, a temporary undo banner appears near the top of the view so the last removal can be restored without digging into plugin data or rebuilding the row by hand.

The dashboard now surfaces notifications from a hero-bar popover instead of a full grid card. It consolidates upcoming reminder events, logical-day rollover or inactivity prompts, project-hub pressure such as overdue or blocked work, and setup-oriented system notices into a compact triage window. Most entries can be dismissed, and actionable items can jump straight into the hub, cleanup note flow, day-end flow, or setup wizard.

New installs now open a guided first-run setup wizard automatically until the core configuration is confirmed. The wizard walks through dashboard identity, project-hub paths, reporting and calendar folders, and AI defaults, and it can be reopened later from the command palette or the plugin settings tab.

## AI Integration

The dashboard now includes an `AI Workspace` card plus command-palette actions for:

1. `Generate AI morning startup brief`
2. `Generate AI shutdown summary`
3. `Generate AI weekly planning assistant`
4. `Generate AI project risk scanner`
5. `Generate AI anomaly detection report`
6. `Generate AI period comparison report`
7. `Generate AI project synthesis`
8. `Generate AI why today felt off analysis`
9. `Ask AI about dashboard and vault`
10. `Analyze active note with AI`

AI output is written into `Dashboard Logs/AI` by default, grouped by date, so the generated planning and analysis stays searchable in your vault. Generated AI notes now also end with a concrete-action section, so even reflective outputs resolve into short next moves instead of stopping at commentary.

The `AI Workspace` card is organized into separate workflow, retrieval, ask, and latest-output sections so the dashboard keeps the same functionality without turning into a single long stack of controls. The latest-output area now shows both suggested focus items and extracted concrete actions from the newest AI artifact.

Recommended starting model: `gpt-4o-mini`.
Use that as the default for frequent dashboard actions because it is usually the best cost-to-quality tradeoff for planning, reflection, and triage. If later you want deeper long-form strategic writeups, you can swap the model in settings without changing the rest of the plugin.

Setup notes:
1. Safer setup: set an environment variable such as `OPENAI_API_KEY` and switch `AI API key source` to `Environment variable` in plugin settings.
2. If you prefer, you can still paste a key into plugin settings and leave the source on `Stored in plugin settings`.
3. Leave the API URL at the default unless you intentionally want a different compatible endpoint.
4. Adjust `AI context days` if you want broader or narrower historical context in prompts.
5. Edit `AI prompt templates` if you want local per-workflow instructions layered onto modes like `morning-startup-brief`, `project-risk-scanner`, or `period-comparison-report` without editing plugin code.

Environment-variable mode avoids persisting the raw API key in plugin data.

The AI context is now deeper than the dashboard alone. In addition to current-day and recent-report context, the plugin can pull in relevant vault notes, project notes, the active note you are currently reading, and explicit calendar snapshot context. `AI related note limit` controls how many retrieved notes are included in each request.

The plugin now also includes a cached AI note index. Instead of rescanning all eligible notes for every AI request, it builds and stores chunked note excerpts for the folders you choose in `AI indexed folders`. That makes retrieval faster and more stable while keeping the scope explicit.

Cached retrieval setup:

1. Leave `Enable AI note index` on.
2. Put one folder per line in `AI indexed folders`.
3. Use `Rebuild AI note index` from the command palette or the `Rebuild index` button in the AI Workspace card after large vault changes.
4. Optional: turn on `Enable AI embeddings` if you want semantic matching layered on top of the cached chunk index.
5. Leave `AI embedding API URL` at the default unless you intentionally use a compatible alternative endpoint.

By default, retrieval stays keyword-weighted and cheap. If you enable embeddings, the plugin uses the same cached chunk index but also stores vector embeddings for indexed chunks and compares them against a query embedding at request time. That means you get semantic retrieval without abandoning the explicit folder-scoped cache.

Recommended embeddings model: `text-embedding-3-small`.
Use that when you want better semantic note retrieval at relatively low cost.

## Storage Model

Daily Dashboard is currently designed as a desktop-first plugin.

- Plugin state is stored in Obsidian plugin data.
- The plugin also writes a readable markdown daily log for each tracked day under `Dashboard Logs/Daily` by default.
- On startup, the plugin can still import those daily logs for dates missing from plugin data, so existing log history remains usable and older data is not stranded.

This keeps the working model simple: local plugin state is the primary source of truth, and daily logs are the durable human-readable record plus a one-way import fallback.

## New Project Flow

Use the `Create project and project note` command or the `New project` button in the dashboard.

That flow will:

1. ask for the project name, category, status, focus, and optional starter tasks
2. create a new project note in the configured project notes folder
3. insert a properly formatted project section into the Master Task Hub automatically

For projects that already exist in the Master Task Hub, run `Create missing project notes from master task hub` once inside Obsidian. That creates any missing project note files in your vault's configured project notes folder without duplicating ones that already exist.

## Development

```bash
npm install
npm run build
```

The compiled plugin entrypoint is written to `main.js`.

## Fast Local Updates

The easiest workflow on Windows is to make your vault use this project folder directly instead of copying files after every change.

1. Close Obsidian.
2. Go to your vault's plugin directory: `.obsidian/plugins/`.
3. Remove the existing `daily-dashboard` plugin folder there if you already copied one in manually.
4. Create a junction from the vault plugin folder to this workspace folder:

```powershell
cmd /c mklink /J "D:\Game Dev\Projects\.obsidian\plugins\obsidian-Dashboard-Plugin" "D:\Game Dev\Projects\Obsidian Dashboard Plugin"
```

5. Reopen Obsidian and enable the plugin.
6. While developing, run:

```bash
npm run watch
```

That keeps `main.js` updated in place, so Obsidian is always reading the newest build from the same folder.

When you make code changes after that:

1. save the file
2. let `npm run watch` rebuild
3. reload the plugin in Obsidian, or restart Obsidian if needed

## Deploy To Vault

If you want to test the plugin from a normal vault plugin folder instead of a junction, copy the built files into that plugin directory.

1. Build the plugin.
2. Copy the built plugin files into your vault's real plugin folder.

You can do that with:

```bash
npm run deploy -- "D:/YourVault/.obsidian/plugins/daily-dashboard"
```

For this vault, the concrete command is:

```bash
npm run build:deploy -- "D:/Game Dev/Projects/.obsidian/plugins/daily-dashboard"
```

Or set `OBSIDIAN_PLUGIN_DIR` and run:

```bash
npm run build:deploy
```

That copies `main.js`, `manifest.json`, `styles.css`, and the `Wallpapers` folder into a normal vault plugin directory.