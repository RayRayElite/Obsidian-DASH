# Projects and Kanban Guide

DASH project work is built on one rule: the `Master Task Hub` stays readable and remains the canonical action source.

## The Three Project Layers

- Master Task Hub: readable task source of truth
- project note: durable context, decisions, risks, and reference material
- DASH Kanban: fast visual planning and movement on top of the hub

## What Belongs In The Hub

- active checklist work
- a small amount of project metadata
- lane or section structure that humans can still scan in plain markdown

## What Belongs In Project Notes

- why the project matters
- stable definitions, links, and context
- durable decisions
- support material that would clutter the hub

## When To Use DASH Kanban

Use the board when visual grouping or drag-and-drop is faster than editing markdown directly. Do not use the board to hide a messy hub structure you have not fixed yet.

## Recommended Workflow

1. Keep project headings and sections sane in the hub.
2. Open DASH Kanban when you want faster sorting, filtering, or review.
3. Let the board sync back into the hub instead of treating them as different systems.

## Kanban UI Basics

The board is meant to be worked directly, not just looked at.

### Project Modes

- `All Projects` mode is for portfolio triage, cross-project pressure, and finding what needs attention first
- `Single Project` mode is for deeper work inside one board when you want more breathing room and less noise
- use the active project selector when you want to stay in single-project mode but move between projects quickly

### Header Controls

The main board header is the command rail for the workspace.

- `New project`: create a new project and seed its related board structure
- `Add card`: add a task straight into the current board context
- `Edit card`: edit the selected card, or open the edit flow for the current project when no card is selected yet
- `Open hub`: jump back to the `Master Task Hub`
- `Board settings`: change board presentation options such as theme, board height, category-band visibility, and sticky headers
- `Cleanup registry`: run registry cleanup when board state and hub state have drifted

### View And Filter Controls

- search: find cards quickly without opening the hub
- focus filters: narrow the board to attention, blocked, or due pressure when triaging
- `Show done`: decide whether completed work stays visible in the current view
- density toggle: choose between `Comfortable` and `Dense` depending on whether you want more breathing room or more cards on screen

Use filters to reduce scanning cost, not as a replacement for clear task wording.

## Moving Work Visually

### Drag And Drop

- drag cards between lanes when visual movement is faster than editing the hub directly
- drag within a lane when you want to reorder work inside the same stage
- let the board write those changes back into the hub instead of treating the board as a disconnected scratchpad

If drag-and-drop starts feeling confusing, the real fix is usually to simplify the underlying hub sections or board mapping rather than layering more exceptions on top.

### Card Actions

- edit a card when the wording, due state, or metadata needs cleanup
- complete a card when the work is done
- add a sibling when another task belongs beside the current one
- delete only when the task truly should disappear rather than be archived
- open the hub or related note when you need source context instead of just the board view

## Project-Level Board Controls

Each project board also has its own lighter control row.

- `Settings`: change presentation for that board without changing every other project
- `Note`: open the related project note when one exists
- `Delete`: remove the project when it is truly being retired, not just paused

Board settings are also where you should look for presentation features such as sticky headers, lane-category visibility, theme choice, and board height.

## Kanban Tips

- Single Project mode is for depth.
- All Projects mode is for triage and portfolio visibility.
- Search and focus filters are for finding pressure, not for replacing task wording discipline.
- If lane mapping gets confusing, simplify the hub instead of layering more rules on top.
- If the board looks visually cramped, switch density or use Single Project mode before assuming the structure is wrong.
- If the board state looks suspicious, use cleanup or repair flows early instead of trying to manually out-edit broken sync.

## Good Task Hygiene

- keep tasks concrete
- use metadata only when it changes decisions
- archive completed work instead of deleting history

## Related Guides

- [Quick Start](Quick%20Start.md)
- [Daily Dashboard Guide](Daily%20Dashboard%20Guide.md)
- [Kanban Themes and Templates Guide](Kanban%20Themes%20and%20Templates%20Guide.md)
- [FAQ](FAQ.md)