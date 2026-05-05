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

- use `Begin logical day` when you wake up and are actually starting the day
- use `End logical day` when you are done for the day and going to bed
- if you work late past midnight, DASH will still treat that time as part of the same day until you end it

That start-day and end-day flow is what keeps sleep timing, daily logs, and reports lined up correctly.

## What You Can Do With It

### Daily Operations

- plan the day, capture tasks, and review progress from one dashboard
- track sessions, habits, calendar pressure, and notes in one operational surface
- keep a readable daily-log history in normal vault files

### Projects And Kanban

- use a markdown-first `Master Task Hub` as the source of truth
- open a dedicated DASH Kanban board on top of that hub
- create projects, move work visually, and keep the markdown structure inspectable
- customize the board with file-backed templates and themes

### Reports And Review

- generate daily logs, weekly or monthly reports, exports, and support notes
- review project pressure, blockers, and follow-through without manually assembling notes

### AI And Research

- AI usage is optional
- generate planning, synthesis, and review outputs as normal vault files
- use the compiled research wiki flow when you want note-grounded research support

## Feature Highlights And Use Cases

### If You Want A Daily Command Center

- use the dashboard as one home screen for planning, reminders, review, and quick capture
- track a logical day so late nights and sleep timing attach to the day you actually mean
- customize the layout with drag-and-drop card ordering, pinning, hiding, and width changes
- use notifications, agenda views, and session tracking to keep the day operational instead of just reflective

### If You Want Project Management Without Giving Up Markdown

- keep a readable `Master Task Hub` as the source of truth for project work
- open DASH Kanban when drag-and-drop sorting, filters, and visual flow are faster than raw note editing
- keep project notes for durable context, risks, definitions, and decisions
- rely on the board and the hub as two views of the same workflow rather than two separate systems

### If You Want Better Review And History

- generate daily logs, weekly reports, monthly reports, exports, and support notes as normal vault files
- use timeline search, project health, and cleanup flows to review drift and pressure earlier
- keep completed work archived instead of losing the record of what actually got done

### If You Want Optional AI And Research Support

- keep the core workflow manual and markdown-first if you do not want AI involved
- use AI for planning, synthesis, and analysis only when it adds value
- build a compiled research wiki when you want note-grounded research outputs instead of one-off chat answers

### If You Care About Inspectable Data And Recovery

- keep generated artifacts as normal vault files that can be inspected outside the plugin
- use built-in repair and refresh flows when state drifts instead of guessing at manual fixes
- customize Kanban themes and templates from file-backed assets instead of needing code changes for every board tweak

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

## Custom Themes And Templates

If you want to customize board assets, start with [Documentation/User Guide/Kanban Themes and Templates Guide.md](Documentation/User%20Guide/Kanban%20Themes%20and%20Templates%20Guide.md).

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