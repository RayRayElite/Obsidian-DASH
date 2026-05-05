# Obsidian DASH

Obsidian DASH is a desktop-first Obsidian plugin for running your day, your projects, and your reviews from one operational dashboard.

It is built for people who want a system that stays readable in normal markdown instead of hiding everything in opaque app-only state.

## What DASH Is For

Use DASH if you want to:

- plan the day from one home screen inside Obsidian
- keep project work anchored to a readable `Master Task Hub`
- use a native Kanban board without giving up plain markdown ownership
- generate logs, reports, exports, and review notes automatically
- add AI support only when it is actually useful

## Public Beta Scope

The current public beta is desktop-only.

The current core promise is centered on:

- the daily dashboard
- the `Master Task Hub` workflow
- the native DASH Kanban board
- daily logs, reports, exports, and support-note structure

The following areas are still experimental:

- budgeting
- gamification

The following ideas may be explored later, but they are not current promises:

- deeper Trello-style Kanban extras
- advanced nutrition-depth food tracking
- voice-triggered workflows
- a future mobile companion or sync product

## Start Here

If you are new to DASH, do not try to learn everything from this README.

Start with:

1. [Documentation/User Guide/Quick Start.md](Documentation/User%20Guide/Quick%20Start.md)
2. [Documentation/User Guide/Beta Install and Support.md](Documentation/User%20Guide/Beta%20Install%20and%20Support.md)
3. [Documentation/User Guide/FAQ.md](Documentation/User%20Guide/FAQ.md)

Inside the plugin, the same docs are also available through the searchable DASH documentation center.

## Logical Day Flow

One concept that matters early is the logical day.

DASH does not assume that your day starts and ends exactly at midnight. Instead, day tracking and sleep tracking depend on when you explicitly start the day after waking up and end the day when you go to bed.

- use `Begin day` when you wake up and are actually starting the day
- use `End day` when you are done for the day and going to bed
- if you work late past midnight, DASH will still treat that time as part of the same day until you end it

That start-day and end-day flow is what keeps sleep timing, daily logs, and reports lined up correctly.


## Feature Highlights And Use Cases

Every major DASH feature is optional. You do not need to use every module for the plugin to be useful.

The intended model is that you can keep the parts that help and ignore the parts that do not. That is especially true for the `Master Task Hub` and `DASH Kanban`: they are meant to be used together and they sync both ways, so you can choose the markdown view or the board view depending on what is more useful in the moment.

### Daily Dashboard Modules

- `Session Deck`: use it for start-day, end-day, and session tracking when timing and day-flow context help you plan or review more honestly
- `Week At A Glance`: use it when you want a visual weekly timeline of tracked time instead of relying on memory
- `Weekly Agenda`: use it to see upcoming commitments, near-term pressure, and planning context in one place
- `Action Queue`: use it for the small set of tasks that matter most right now instead of scanning every project at once
- `Vitals`: use it for mood, energy, friction, and similar state signals when those affect real planning decisions
- `Habits`: use it when you want daily habit tracking inside the same operational surface as the rest of the day
- `Consumables`: use it for things like food, water, caffeine, supplements, or medication when intake tracking is useful to you
- `Exercise & Weight`: use it when body or fitness tracking matters enough that you want it connected to the rest of your day logs
- `Sleep And Notes`: use it for sleep timing, recovery context, and lightweight daily notes in one place
- `Heatmaps`: use them when you want a quick pattern view across recent work, sleep, or habit consistency

### Project And Planning Modules

- `Master Task Hub`: use it as the readable markdown source of truth for project structure, active work, and section-based planning
- `DASH Kanban`: use it when drag-and-drop movement, filters, lane views, and faster triage are more useful than editing the hub directly
- `Project Health`: use it to spot which projects are drifting, stalled, blocked, or missing a real next action
- `Stale Work And Cleanup`: use it to find neglected, broken, duplicated, or suspicious project state before it spreads

The `Master Task Hub` and `DASH Kanban` are designed to work together rather than compete. Use the hub when markdown is the clearer tool, and use the board when visual flow is faster. They are two-way synced so you can switch between them based on what the moment calls for.

### Review, History, And Retrieval Modules

- `Daily Logs`: use them as the factual record of what happened that day, including tracked sessions, completions, and context
- `Reports And Reviews`: use them for weekly and monthly reflection, trend spotting, and higher-level review
- `Timeline Search`: use it when you need to retrieve past work, tracked sessions, notes, or event context without digging manually through older files

### Optional Intelligence And Analysis Modules

- `AI Workspace`: use it for optional planning, synthesis, and question-answering support when AI adds value to your workflow
- `Compiled Research Wiki`: use it when you want note-grounded research outputs, concept notes, and reusable knowledge artifacts instead of one-off answers

### Optional Experimental Modules

- `Gamification Center`: use it if score, streak, and momentum framing makes the system more engaging for you; ignore it if that framing is not helpful
- `Budgeting`: use it if you want subscription and budget visibility inside DASH; leave it off if finance tracking is outside your current scope

### Customization And Recovery Modules

- `Project Notes`: use them for durable context, definitions, risks, and decisions that should not clutter the hub
- `Themes And Templates`: use them to change Kanban appearance and board structure, including creating your own custom themes and templates without editing plugin code
- `Header Wallpapers`: use them to change the dashboard hero image by adding your own image files to the wallpaper folder and selecting one in settings
- `Repair And Refresh Flows`: use them when state drifts or generated artifacts need to be rebuilt, instead of guessing at manual fixes

This is meant to be a modular system, not an all-or-nothing one. If only a few modules fit your workflow, that is a normal way to use DASH.

## Install

For public beta, the recommended install path is BRAT.

- BRAT install and support guidance: [Documentation/User Guide/Beta Install and Support.md](Documentation/User%20Guide/Beta%20Install%20and%20Support.md)
- advanced manual install from release assets is also possible

## Documentation Map

The detailed user-facing guides live under [Documentation/User Guide/README.md](Documentation/User%20Guide/README.md).

- [Documentation/User Guide/Quick Start.md](Documentation/User%20Guide/Quick%20Start.md)
- [Documentation/User Guide/Beta Install and Support.md](Documentation/User%20Guide/Beta%20Install%20and%20Support.md)
- [Documentation/User Guide/Daily Dashboard Guide.md](Documentation/User%20Guide/Daily%20Dashboard%20Guide.md)
- [Documentation/User Guide/Projects and Kanban Guide.md](Documentation/User%20Guide/Projects%20and%20Kanban%20Guide.md)
- [Documentation/User Guide/AI and Research Guide.md](Documentation/User%20Guide/AI%20and%20Research%20Guide.md)
- [Documentation/User Guide/Reports, Reviews, and Exports.md](Documentation/User%20Guide/Reports,%20Reviews,%20and%20Exports.md)
- [Documentation/User Guide/Kanban Themes and Templates Guide.md](Documentation/User%20Guide/Kanban%20Themes%20and%20Templates%20Guide.md)
- [Documentation/User Guide/FAQ.md](Documentation/User%20Guide/FAQ.md)

## Known Limitations

- the current beta should be treated as desktop-only
- budgeting and gamification are still experimental
- advanced Trello-style Kanban extras are intentionally out of current beta scope
- AI workflows depend on separate model setup and are optional

## AI And Privacy Note

AI features are optional. Core dashboard, project, and Kanban workflows should remain useful without AI enabled.

If you configure AI features, they may involve external model calls depending on your settings and provider choice.

## Custom Themes, Templates, And Wallpapers

You can customize parts of DASH without changing plugin code.

- create your own Kanban themes and templates by following [Documentation/User Guide/Kanban Themes and Templates Guide.md](Documentation/User%20Guide/Kanban%20Themes%20and%20Templates%20Guide.md)
- add your own dashboard header wallpaper by placing an image inside the configured wallpaper folder, then selecting it in settings

The default wallpaper folder is `Wallpapers`, but the setting can point somewhere else if you want to organize those images differently.

## Support

Support expectations, bug-report guidance, and beta triage rules live in [SUPPORT.md](SUPPORT.md).

## Release Notes And Testing

- user-facing change history: [CHANGELOG.md](CHANGELOG.md)
- release checklist: [RELEASING.md](RELEASING.md)
- beta acceptance matrix: [TESTING.md](TESTING.md)

## Development

Basic local build:

```bash
npm install
npm run build
```

Deploy to a vault plugin folder:

```bash
npm run build:deploy -- "D:/Game Dev/Projects/.obsidian/plugins/daily-dashboard"
```

Use `npm run watch` for local iteration when your vault points at this workspace.

## License

This project is released under the Apache 2.0 license. See [LICENSE](LICENSE).