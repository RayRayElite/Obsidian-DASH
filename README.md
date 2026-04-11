# Obsidian DASH - Daily Action & System Hub

Obsidian DASH - Daily Action & System Hub is an Obsidian plugin that opens as its own dashboard tab instead of injecting a panel into the workspace chrome.

## What It Does

- tracks repeat daily habits with per-day counts, preferred completion windows, difficulty weights, and per-habit miss notes
- stores mood, energy, wake quality, a richer execution stack with active focus items, notes, effort estimates, drag reordering, a Next Up queue, routine cues, calendar blocking actions, suggested focus candidates, friction log, timestamped food entries, timestamped intake logs for water/caffeine/supplements/medication, symptom and pain entries, sleep log, dream log, micro-reflections, and daily notes
- supports user-controlled logical days with begin-day/end-day tracking, inactivity-based day-end nudges, and late-night rollover warnings so late-night work does not roll into the wrong calendar day
- tracks work sessions, nap sessions, and bowel movement count plus duration and quality tags inside the active logical day for more accurate sleep and activity history, with optional session tags like deep work, admin, creative, errands, and recovery, and keeps bowel tracking inside Vitals instead of a separate day-flow block
- includes a built-in monthly calendar where you can click a day to add one-off or recurring events, categorize them as work, health, errands, social, or personal, link them to a tracked project, add per-event prep and travel lead times, span events across multiple days, edit a single recurring occurrence without touching the whole series, skip or cancel one occurrence, surface upcoming reminders below the Execution block, see a weekly agenda card, and sync events into markdown for later AI analysis
- includes an optional budgeting card with an overview, subscriptions tracker, simple category targets, and a generated monthly finance snapshot note so recurring charges and renewal pressure can live in the dashboard without turning the plugin into a full accounting app
- writes a markdown daily log note for every tracked day
- generates weekly reviews plus weekly and monthly markdown reports from those daily logs
- exports dashboard history into a markdown summary plus CSV dumps for daily metrics, habits, completed tasks, and calendar events
- can call OpenAI for AI-powered morning startup briefs, shutdown summaries, weekly planning, project risk scans, anomaly detection, period comparisons, project synthesis, "why today felt off" analysis, active-note analysis, and freeform questions grounded in dashboard context
- can initialize a compiled research wiki scaffold with raw/source/concept/index/output folders plus a generated health-check note for maintenance review
- reads a master todo note to show project workload snapshots, stale work, health trends, linked notes, and completion progress
- can generate a note-first `Kanban Hub` companion document from the master task hub, with per-project boards for `Now`, `Next`, `Later`, `Waiting`, `Parking Lot`, and recent `Done` work
- automatically archives completed checklist items from the master todo into a per-project completed archive section with date and time
- lets you quick-add tasks into project sections, promote project tasks into today focus, quick-capture new focus items, pause active sessions into a break, search archived work history, sync repeating tasks, and offload project references into project notes
- includes switchable mobile, compact, and widescreen dashboard modes, a layout editor for card order / hidden / pinned preferences, fixed keyboard shortcuts for major actions, undo for dashboard-side destructive actions, a hero-bar notification popover for reminders and system notices, a first-run setup wizard, and collapsible subsections to keep dense cards usable
- lets you pick a hero wallpaper from a vault folder in plugin settings

The first-run setup wizard now behaves like a true onboarding flow: it should open automatically only for a fresh install, skipping it counts as "don't prompt me again," and you can always reopen it later from the command palette or settings.

Task lines in the master hub can now include lightweight annotations such as `[priority: high]`, `[due: 2026-04-05]`, `[blocked: waiting on API key]`, `[unblock: 2026-04-08]`, `[effort: 30m]`, `[energy: low]`, `[context: admin]`, `[trigger: after call with vendor]`, and `[minimum-step: draft the first outline]`. The dashboard strips those tags out for display, but uses them to surface due-soon, overdue, blocked, and priority-ranked work in project health, cleanup alerts, promotion flows, AI context, and suggested next actions.

## Master Todo Workflow

Point the plugin at your `Master Task Hub.md` note in settings. The note works best when each project uses a `##` heading and includes optional metadata such as `Project Note:: [[Note Name]]`, `Status::`, `Focus::`, `Project Summary::`, `Why It Matters::`, `Definition Of Done::`, `Last Review::`, `Waiting On::`, `Relationships::`, and `Kanban Categories:: workflow=Workflow | delivery=Delivery` when you want grouped board-band names to round-trip through the hub.

The stronger recommended document structure now lives in `Documentation/Document System Improvement Plan.md` in this repo, including a filled master-hub example, project-note template, AI support-note structure, and generated-note standards.

The command palette now also includes `Refresh master task hub portfolio snapshot`, which writes or updates a compact `## Portfolio Snapshot` section near the top of the hub with portfolio pressure, external blockers, and momentum highlights. Plugin-driven hub changes such as project creation, archive sweeps, repeating-task sync, and reference offload also refresh that section automatically.

The current Kanban slice now has two surfaces. The older note-first path still exposes `Refresh Kanban Hub`, `Create or refresh Kanban board notes`, `Refresh all Kanban artifacts`, `Repair Kanban foundations and refresh hub`, `Preview Kanban cleanup migration`, `Apply Kanban cleanup migration`, `Repair Kanban links`, `Prune stale Kanban registry entries`, `Sync Kanban Hub to Master Task Hub`, `Kanban quick add task`, and `Edit Kanban task`. In addition, the new `Open DASH Kanban board` command and ribbon icon open a dedicated custom board view with template-driven lanes, both `All Projects` and `Single Project` modes, search plus persisted quick filters for attention-blocked-due work, a truly compact collapsed header that keeps only the title, status chips, core actions, and arrow toggle, matching `New project` access from both header states, an in-view repair banner when the repair queue is non-empty, stronger per-project themes that now reach the cards as well as the board shell, direct complete and delete actions, compact inline quick-add composers in lane headers, faster-feeling card creation by pushing slower artifact refresh work out of the immediate add path, click-to-edit cards with a smaller in-card text editor that only opens from the text area instead of footer actions, footer-anchored priority and due or effort popovers that close again after saving, priority-driven card tint and edge styling so urgency reads directly from the card body, a dedicated on-card metadata strip that now keeps `Due` in the top status-chip row while the bottom row stays focused on `Effort` and `Finished`, raw task-line metadata fallback so those card-face labels and priority tinting still render when the summary snapshot arrives without those fields populated, corrected due-date parsing so only truly past dates show the `Overdue` state even when the stored annotation includes `MM/DD/YYYY HH:MM AM` formatting, single-best-match swimlane assignment so converted grouped boards stop duplicating the same task across multiple row bands, small attached-photo previews plus a per-card photo popover that can upload or link existing vault images, and clickable Week At A Glance arrows that move between current and past weeks only while reopening still resets the view to the current week. Compatibility-mode generated Kanban Hub or project-board notes also emit visible metadata pills for `Project`, `Priority`, `Due`, and `Effort` directly into the markdown card content instead of dropping priority entirely. Owner pills stay in the DASH footer while redundant lane labels are removed from each card, due-date entry auto-inserts separators while you type toward `MM/DD/YYYY HH:MM AM`, and fixed-position card action popovers now overlay above neighboring lanes instead of being clipped by the scroll container or lane borders. Stronger drag-and-drop placement cues plus reduced drag-state class churn keep cards from flickering while moving, inline lane-title rename controls remain available, compact footer-aligned card actions stay pinned to the bottom-right, drag-and-drop lane moves persist back into the Master Task Hub, same-lane manual reordering persists within a priority band across refreshes, optional swimlane category bands remain available, shared-height lane viewports keep internal scrolling plus a drag handle for resizing the board height, clickable project headers collapse boards in the all-projects workspace, `Custom` template labeling stays honest when a board diverges from its base preset, shared-column matrix rendering still handles grouped templates that need aligned row sections instead of stacked lane strips, category-band names round-trip through project metadata using stable `categoryKey=Label` pairs, cleaner compact lane headers with stronger visual separation between category and lane title, and safer registry synchronization after lane, priority, and tag-affecting edits helps keep cards from stranding themselves as missing board items. Project creation now uses a smaller theme-friendly modal, drops the old Focus field, seeds template-specific hub sections from the chosen board instead of legacy `Add` and `Fix` buckets, and keeps newly created empty projects visible in the board immediately instead of hiding them until the first card exists. Midnight Grid now anchors the dark lineup, the former Paper Ledger light mode has been rebuilt into `Day Shift`, and the other built-ins now present themselves as `Night Harbor`, `Pine Console`, `Ember Atelier`, and `Violet Signal` with stronger board-shell, lane, and card identities instead of simple palette swaps. A follow-up correction pass then removed the low-quality banded texture treatment from the built-in themes, restored Midnight Grid to a cleaner benchmark look, and pushed Day Shift toward higher-contrast readable lane, card, and control surfaces instead of pale layered gradients. If that rename would collide with an existing hub section, DASH now leaves the hub unchanged and surfaces a manual-review notice instead of merging headings silently. Built-in templates now include screenshot-inspired `Support Swimlanes`, `Bugs And Features`, and `Simple` layouts so grouped board patterns can reuse one column set across multiple row groups, while standard boards can still keep swimlane categories off entirely.

Kanban templates and themes now also live as shareable files inside the installed plugin folder. Built-in board templates ship as JSON files under `templates/`, built-in and user themes ship as raw CSS files under `themes/` with a small metadata header for display name and preview colors, and the command palette includes `Reload DASH Kanban templates and themes` so manual file edits can be picked up without reinstalling the plugin.

For custom template files, keep the shape close to the built-ins:

```json
{
	"templateId": "my-template",
	"name": "My Template",
	"description": "Optional description",
	"builtIn": false,
	"laneDefinitions": [
		{
			"laneKey": "next",
			"label": "Next",
			"mappedSections": ["Next"],
			"ruleType": "hub-section",
			"done": false
		}
	]
}
```

Each lane needs at least `laneKey` and `label`. The file must also contain a `laneDefinitions` array.

For custom theme files, use raw CSS with an optional JSON metadata header at the top:

```css
/*
{
	"id": "my-theme",
	"name": "My Theme",
	"description": "Optional description",
	"preview": {
		"board": "linear-gradient(160deg, #1a2230, #0f141d)",
		"primary": "#7cc7ff",
		"secondary": "#4479b8",
		"surface": "rgba(220, 235, 255, 0.16)"
	}
}
*/
.dash-kanban-project-board[data-theme="my-theme"] {
	--dash-kanban-board-accent: #7cc7ff;
}
```

If a custom template or theme file is malformed, DASH now skips it, shows a concise notice, and logs the specific reason in the developer console instead of failing silently.

The compact Kanban header now keeps the title and summary chips anchored on the left while the primary board actions sit together on the top-right with the collapse control at the far edge, matching the intended quick-scan layout instead of stretching the action row across the full header width. The expanded header now also uses a minimal arrow-only collapse control in the hero's upper-right corner while keeping the status chips visually anchored lower on the left side of the hero panel. The next readability pass also groups the expanded header controls by job, gives single-project mode a more editorial project-header treatment, quiets most card chrome until hover or focus, strengthens swimlane and stage rhythm in matrix boards, turns empty lanes into more intentional drop-target states instead of dead blank cells, adds subtle lane heat indicators for blocked and due pressure, mutes non-selected lanes in single-project mode once you are actively working inside one lane, collapses each card body dynamically based on the data it actually carries, composes attached images inside a clearer media frame, gives completed work a resolved stamp instead of treating done cards as merely darker copies, adds a visual theme preview strip inside board settings, keeps that preview as a stable horizontal card rail instead of letting it collapse into cramped pills, lets each board opt into sticky matrix stage and row headers when larger boards need stronger orientation, separates Kanban text tiers more aggressively from decorative accents, adds clearer keyboard focus rings across board controls, gives blocked and overdue attention states shape cues beyond color alone, pushes comfortable versus dense mode farther apart so each layout now earns its place, and hides the lane-override editor behind a collapsible section so routine board tweaks do not force a long scroll just to save.

Card photo handling in the DASH board now supports a searchable `Link vault image` picker, working upload actions, drag-and-drop image attachment directly onto a card, and clipboard-image paste while editing a card. Project headers also now expose a direct `Delete` action that removes the project from the Master Task Hub and deletes its linked project note so project cleanup no longer requires manual hub surgery.

The note-first commands still write a generated board note at the configured Kanban Hub path, can also write per-project board notes under the configured Kanban boards folder, let lane moves made in those generated notes persist back into the Master Task Hub without replacing the hub as the canonical source of truth, surface blocked-task and stale-project review helpers directly inside the generated board note, add board-summary and filter sections for faster navigation, and give the command palette explicit flows for adding or rewriting Kanban tasks without editing raw hub markdown by hand. When Obsidian Kanban compatibility mode is enabled, that setting now applies to both the main Kanban Hub and the generated per-project board notes so the hub opens as a visual board instead of a plain text note.

Kanban settings now also include an optional board-notes folder, an Obsidian Kanban compatibility toggle that writes project board notes with `kanban-plugin: board` frontmatter, and an optional auto-sync listener that watches generated Kanban notes for manual edits and syncs task-id-backed changes back into the Master Task Hub with repair notices when note artifacts drift. As part of the DASH-native redesign, refreshing Kanban artifacts no longer rewrites the Master Task Hub just to inject visible `[task-id: ...]` annotations, the cleanup-preview command writes a preview note plus seeds a hidden task registry from any existing legacy ids, `Apply Kanban cleanup migration` removes visible ids only from safe checklist rows and then regenerates current Kanban artifacts, and `Repair broken Kanban lines in master task hub` can restore checklist boxes on lines that were corrupted by the earlier task-id bug, including plain-text legacy queue items that lost their `- [ ]` markers entirely. New task insertions and lane moves now stay free of visible Kanban ids in the Master Task Hub, while generated Kanban notes carry hidden HTML-comment task ids plus registry-backed fallback matching so manual board sync and task editing still work after cleanup. The cleanup preview now also lists ambiguous hidden-match tasks that need review instead of leaving them as invisible registry state. Non-compatibility Kanban rendering is now template-driven: the native Hub and native project board notes use built-in board templates plus per-project board configs from plugin data, render collapsible project sections with a project-context callout and a board-strip summary, and no longer depend on one hard-coded lane list when compatibility mode is off. Native board sync now resolves lane moves through the selected project template instead of fixed lane names, the quick-add and edit modals now show template-aware lane choices, and sync conflicts or unmapped lanes are routed into `Repair Kanban links` instead of failing silently. That repair report note also validates malformed board configs and orphaned registry entries so broken sync state has an explicit inspection path. Built-in templates now cover a classic execution board, bug triage, simple grouped workflow, support swimlanes, bugs-and-features matrix boards, and research/publishing flow, and custom unmapped lanes render as explicit placeholders until they are connected to hub semantics. Older `### Add` and `### Fix` sections are also treated as legacy aliases for the Kanban `Next` lane so pre-Kanban hubs still participate in the current board logic even before a fuller section-migration step lands.

If older hub projects or project notes predate the newer metadata and section structure, run `Repair master task hub and project notes`. That workflow only adds missing metadata lines, missing sections, missing project notes, and a refreshed portfolio snapshot; it does not delete or rewrite existing hub content or add visible Kanban task ids automatically.

1. keep active work as unchecked checklist items in non-reference sections
2. mark a task complete with `- [x]`
3. the plugin automatically moves it into that project's `Completed Archive` section and records it in that day's dashboard log

This gives you a work-history trail without deleting finished tasks.

The richer dashboard flow also works best when projects keep `### Now`, `### Next`, `### Later`, `### Waiting`, `### Parking Lot`, `### Reference`, and `### Completed Archive` sections, or the equivalent template-driven lane sections for the board you chose. New projects created by the plugin now seed only those operational sections plus `Reference`, and project-note templates also include `Change Log`, `Known Terms / Definitions`, and `Useful Links / Assets` sections so durable context has a stable home.

The `### Repeating` section now supports richer repeat rules instead of only simple weekly-style tags. Plain bullets and checklist bullets both work. Supported forms include `- Pay rent [repeat: monthly day 1]`, `- Water plants [repeat: every 10 days]`, `- Review backlog [repeat: every 2 weeks]`, `- Gym session [repeat: weekdays mon wed fri]`, plus the legacy short forms like `[daily]`, `[weekly]`, `[monthly]`, and `[yearly]`. When synced into the master hub, due repeating tasks are inserted into `### Next` with their normalized repeat tag preserved.

Project health now surfaces a visible next action for every project, explains the reasons behind each health score, renders compact momentum bars from recent completion history, and respects `Status:: Incubating` or `Status:: Someday` so parked work does not look artificially broken just because it is not active right now.

The cleanup workflow now expands into project-level drill-down rows for stale, duplicate, empty-section, blocked, overdue, and needs-breakdown issues, and the cleanup note command writes a grouped portfolio review note instead of a flat alert dump. Project review mode also now supports a structured checklist note that opens beside the master hub and project note so weekly or ad hoc reviews can happen in a consistent three-pane setup, and weekly review generation now also writes one archive review note per active project under the matching review-cycle folder.

The command palette now also includes `Generate dependency review note`, which writes a focused review artifact under `Dashboard Logs/Dependency Reviews` using `Waiting On::` metadata and blocked-task pressure so outside blockers can be reviewed from one place instead of staying scattered across projects.

## Document Design

Obsidian DASH works best when note roles stay explicit instead of collapsing action lists, reference material, life context, and AI instructions into one note.

Recommended supporting notes:

- `Basic Information`: stable personal facts, constraints, and enduring context.
- `AI Guardrails`: how AI should behave, what tone to use, and what to avoid.
- `Current Season`: temporary priorities, obligations, and constraints for the current month or phase.
- `People / External Dependencies`: outside blockers, vendors, collaborators, and relationship context that repeatedly affects project flow.
- `Decision Journal`: preserved reasoning behind meaningful choices.
- `System Map`: one-page explanation of what each major note and folder is for.

The filled starter versions of those notes, plus a stronger Master Task Hub and project-note template, are documented in `Documentation/Document System Improvement Plan.md`.

Supporting repo docs created from that plan:

- `Documentation/How This System Works.md`
- `Documentation/What Goes Where.md`
- `Documentation/Task Wording Guide.md`
- `Documentation/Archive Policy.md`
- `Documentation/Document Freshness Checklist.md`
- `Documentation/AI Guardrails Template.md`
- `Documentation/Current Season Template.md`
- `Documentation/Decision Journal Template.md`
- `Documentation/People External Dependencies Template.md`
- `Documentation/System Map.md`
- `Documentation/Reference Offload Inbox.md`
- `Documentation/Shelf Life Guide.md`
- `Documentation/Review By Exception Workflow.md`
- `Documentation/Compiled Research Wiki Guide.md`

## Compiled Research Wiki

The plugin now also supports a separate compiled research wiki workflow for LLM-assisted knowledge work.

Use `Initialize compiled research wiki` once to create the default folder scaffold under `Knowledge Base/` plus starter notes for indexes, source summaries, concept pages, and output notes. The scaffold is controlled by new folder settings, so you can relocate the raw, source-summary, concept, index, output, and asset folders without editing code.

Use `Compile active note into research source summary` to turn the active markdown note into a structured source-summary note in the compiled wiki. Use `Generate concept note from active research note` to turn the active note into a reusable concept page, and use `Generate research answer note from active note` or `Generate research brief from active note` to write reusable outputs into the knowledge-base outputs folder.

Use `Ask research question and write wiki notes` when you want to start from a direct question instead of an existing source note. That workflow creates a seed note under `Knowledge Base/raw/Questions` and can generate both a concise brief and a deeper teaching-oriented answer note from the AI Workspace card or the command palette. The research modal now lets you choose `Vault only`, `Vault + model knowledge`, or `Vault + web search`, and the plugin supports a separate research model setting so these longer-form answers do not need to share the cheaper dashboard coaching model.

Use `Generate research Marp slide deck from active note` to create a presentation-ready markdown deck under the knowledge-base outputs slide-deck folder, and use `Promote active research output to concept note` or `Promote follow-up questions from active research note` to push useful outputs back into the wiki and its question index.

Use `Regenerate compiled research topic index` to rebuild a navigable topic index note from the current source summaries, concept notes, outputs, coverage gaps, open questions, and candidate article ideas.

Use `Generate compiled research wiki health check` to write a maintenance note into the knowledge-base outputs folder. The health check summarizes coverage, flags raw notes without matching summary filenames, calls out weakly linked or duplicate concept candidates, and identifies stale index notes so the wiki does not silently decay into an unmaintained dump.

Use `Generate compiled research retrieval tuning note` when you want the plugin to inspect current knowledge-base note volume, AI index coverage, raw-folder indexing, chunk density, and embeddings usage before deciding whether retrieval tuning is actually warranted yet.

Recommended retrieval scope for AI remains the compiled layers, not the raw inbox: source summaries, concept notes, and index notes. Keep the raw folder out of `AI indexed folders` unless you explicitly want direct raw-source retrieval noise.

The direct question workflow can now optionally use live web search through the OpenAI Responses API when you choose `Vault + web search`. If an answer matters enough to preserve confidently, you should still capture the best supporting sources afterward and compile them into the wiki so future answers are less dependent on transient web retrieval.

## Logical Day Tracking

The dashboard now separates your real day from the calendar date.

1. Use `Begin logical day` when you are actually up and starting the day.
2. Use `End logical day` when you are done and heading to bed, even if the clock has passed midnight.
3. Use `Start work session` and `Stop work session` to track actual focused work time inside that logical day.
4. Use `Start nap session` and `Stop nap session` whenever you sleep during the day so naps are logged separately from your final sleep time.

Session Deck now carries the live logical-day status instead of a dedicated `Day Flow` card. If the clock rolls past midnight while the logical day is still active, the notice system still warns that new sessions and edits are landing on yesterday until you explicitly end the day, and the same past-midnight state is visible in Session Deck.

The dashboard records wake time, sleep time, day start/end, tracked work sessions, and tracked naps into the daily log note and period reports. Work sessions started from Session Deck with a selected project also roll up into per-project work totals in the daily log.

The recovery block now adds a wake-quality score, a rolling sleep debt summary, a sleep consistency view, a blended recovery score, and a recent-nights strip so you can see whether the last week is actually stable instead of guessing from one bad night. The state card now uses timestamped mood, energy, and anxiety check-ins during the day, and mood entries can capture a named feeling alongside the score.

The logical day repair flow still includes a manual timeline editor for work, nap, relax, break, and bowel sessions, and it now tolerates past-midnight or still-open sessions while the logical day remains active. The always-on live timeline strip was removed from the dashboard because it was adding more chrome than operational value.

Recurring routine templates still use `Label|HH:MM|HH:MM`, but they now live inside the `Action Queue` card and as real notifications instead of taking over a separate Day Flow section.

The planning layer now also includes a `Weekly Agenda` card plus suggested focus candidates that blend near-term calendar items, overdue or due-soon tasks, repeating work, and stale projects. Active focus rows, Next Up rows, and suggestion rows can all create a quick work block directly in the calendar using the estimate on the item when one exists.

Calendar events can now span multiple days and carry event-specific prep and travel lead times, so reminders can surface before the actual start instead of only at the start itself. Daily log notes also render richer calendar context with linked project references pulled from event notes plus persistent follow-through checkboxes for each day’s events.

Habit completions now also capture timestamps for each completion step, can be assigned morning/afternoon/evening/before-bed windows plus difficulty weights, and support daily miss notes. Food entries capture the time they were logged, the body log now tracks water/caffeine/supplements/medication plus symptoms and pain, and the notes block includes quick "What helped today?" and "What hurt today?" reflections. Weekly and monthly reports now also include explicit personal trend sections so recurring drift, repeat misses, symptom patterns, and reflection themes are surfaced instead of staying buried in day logs.

The dashboard now also includes a `Gamification Center` with deterministic daily, weekly, and monthly scores, category sub-scores for execution, health, consistency, recovery, and planning, streak and personal-best tracking, low-score rebound tracking, and auditable explanation rows for why each score moved. A dedicated gamification report command writes the current score breakdown into `Dashboard Logs/Gamification`.

Calendar events can now carry an explicit project link instead of relying only on note text. That project context now shows up in the agenda, reminders, timeline search, calendar markdown, and daily-log follow-through block.

The command palette now also includes `Export dashboard metrics as markdown and CSV`, which writes a timestamped bundle under the configured export folder. The export currently includes `summary.md`, `daily-metrics.csv`, `habit-metrics.csv`, `completed-tasks.csv`, and `calendar-events.csv`.

Weekly and monthly reports now also surface repeated blocker patterns from friction logs, accomplishments grouped by project, missed-habit pattern summaries with recent miss notes, review-by-exception summaries for portfolio pressure and metadata drift, and a richer deterministic month-end narrative instead of only raw metric tables. Daily logs also summarize open loops created and closed that day so carry-forward pressure is easier to spot at a glance. The dashboard also includes adaptive reflection prompts in the notes card and a `Wins archive` command that writes a searchable markdown summary under `Dashboard Logs/Wins Archive`.

The dashboard now also includes a full `Timeline Search` card that searches archived tasks, tracked sessions, calendar events, and text logs from one surface instead of splitting history across separate cards. The same area can store reusable dashboard filter presets, resets back to page 1 when those filters change, paginates both timeline and cleanup review rows in 10-item pages, and now ships with recent heatmaps for work, sleep, and weighted habit completion.

Dashboard layout is now user-tunable instead of fixed. The lower-right hero controls include a layout editor that can reorder the main grid cards, hide sections you do not want on screen, and pin the few cards that should always rise to the top. Compact and widescreen modes were also rebalanced so major cards land in cleaner, more symmetrical rows instead of feeling like stretched mobile leftovers.

The same hero control cluster now exposes a shortcut help button, and the dashboard responds to fixed `Alt+Shift` shortcuts for the most common actions while focus is inside the view: cycling view mode, opening the layout editor, creating a project, refreshing the dashboard, opening quick focus capture, launching Ask AI, syncing repeating tasks, and opening the shortcut sheet itself.

Destructive dashboard actions now also get a visible in-view undo rail. When you remove an active focus item, Next Up item, habit definition, food entry, intake entry, or symptom entry from the dashboard, a temporary undo banner appears near the top of the view so the last removal can be restored without digging into plugin data or rebuilding the row by hand.

The dashboard now surfaces notifications from a hero-bar popover instead of a full grid card. It consolidates upcoming reminder events, logical-day rollover or inactivity prompts, project-hub pressure such as overdue or blocked work, and setup-oriented system notices into a compact triage window. Most entries can be dismissed, actionable items can jump straight into the hub, cleanup note flow, day-end flow, or setup wizard, and the notice popups can optionally play a configurable sound. The adjacent `Add to project` capture now uses the same anchored hero-popover pattern instead of pushing nearby controls around, and the notification badge layout no longer stretches into the header.

The plugin now also supports a reusable `Basic Information` note for long-lived personal context such as age, height, weight, interests, preferences, and AI guidance. That note is created automatically by default, can be surfaced during the setup wizard, can be opened from the command palette or AI workspace, and AI requests can include it automatically. The same support layer now includes a generated `Recurring Friction Patterns` note that synthesizes repeated blocker signals, reflection drift, and project pressure from recent dashboard history. Plugin-generated markdown artifacts can also receive frontmatter tags so daily logs, reports, AI notes, and exports are easier to distinguish in search and graph views.

Consumable presets now stack into the same matching entry when you tap them repeatedly. If you hit a preset like `Water bottle 500 mL` several times, the dashboard updates the amount on that existing row instead of creating duplicate rows for each tap. Consumable add-entry buttons, preset taps, and the empty-state quick actions now also rerender the open entry log immediately instead of requiring a manual collapse-and-reopen workaround.

New installs now open a guided first-run setup wizard automatically until the core configuration is confirmed. The wizard walks through dashboard identity, project-hub paths, reporting and calendar folders, and AI defaults, and it can be reopened later from the command palette or the plugin settings tab.

The budgeting feature is opt-in from plugin settings. The current slice focuses on a subscriptions-first workflow: manual recurring or one-time charge entries, monthly and annual recurring totals, due-soon renewals, payment-method and currency summaries, lightweight budget-category targets for comparing committed recurring cost against rough monthly intent, a `Generate monthly finance snapshot` action under `Dashboard Finance/Monthly`, and a `Generate monthly finance review` action under `Dashboard Finance/Reports` that summarizes subscription creep, renewal pressure, annual renewals, and review actions.

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

The AI context is now deeper than the dashboard alone. In addition to current-day and recent-report context, the plugin can pull in relevant vault notes, project notes, the active note you are currently reading, and explicit calendar snapshot context. `AI related note limit` controls how many retrieved notes are included in each request. In the AI Workspace, persistent support documents such as Basic Information, Guardrails, Current Season, Dependencies, Decision Journal, and System Map are available from a compact reference-notes shortcut so they stay separate from AI actions without stretching the card.

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

Obsidian DASH - Daily Action & System Hub is currently designed as a desktop-first plugin.

- Plugin state is stored in Obsidian plugin data.
- The plugin also writes a readable markdown daily log for each tracked day under `Dashboard Logs/Daily` by default.
- On startup, the plugin can still import those daily logs for dates missing from plugin data, so existing log history remains usable and older data is not stranded.

This keeps the working model simple: local plugin state is the primary source of truth, and daily logs are the durable human-readable record plus a one-way import fallback.

Kanban board assets are the main exception: templates and themes are intentionally file-backed in the plugin install folder so they can be inspected, copied between vaults, and extended without editing plugin code.

## New Project Flow

Use the `Create project and project note` command or the `New project` button in the dashboard.

That flow will:

1. ask for the project name, category, status, focus, Kanban template or custom-board path, board theme, and optional starter tasks
2. create a new project note in the configured project notes folder
3. insert a properly formatted project section into the Master Task Hub automatically
4. seed the project's DASH Kanban configuration so the board starts with the selected template and theme immediately

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
cmd /c mklink /J "D:\Game Dev\Projects\.obsidian\plugins\daily-dashboard" "D:\Game Dev\Projects\Obsidian Dashboard Plugin"
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

## Plugin Stays Enabled On Restart

Obsidian persists community plugins by plugin id, not by the display name. For this plugin the id is `daily-dashboard`, so the installed folder under `.obsidian/plugins/` also needs to be named `daily-dashboard`.

If Obsidian seems to forget that the plugin was enabled after a restart, check these first:

1. Make sure the installed folder is `.obsidian/plugins/daily-dashboard`.
2. Make sure `.obsidian/community-plugins.json` still contains `daily-dashboard`.
3. If both are correct, the more likely cause is a startup load failure rather than a lost enable setting. Open Obsidian's developer console and look for an error mentioning `daily-dashboard` or `main.js`.

The plugin now guards startup hydration more defensively so one malformed daily log or saved payload is less likely to prevent activation.

Or set `OBSIDIAN_PLUGIN_DIR` and run:

```bash
npm run build:deploy
```

That copies `main.js`, `manifest.json`, `styles.css`, and the `Wallpapers` folder into a normal vault plugin directory.