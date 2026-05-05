# Kanban Themes and Templates Guide

This guide explains how to customize DASH Kanban with your own templates and themes.

## Where The Files Live

Built-in and custom assets live in the installed plugin folder:

- `templates/` for board templates
- `themes/` for board themes

Use the command `Reload DASH Kanban templates and themes` after editing those files.

## Important Format Difference

Themes and templates are not equally comment-friendly.

- Theme files are CSS, so they can include normal comments safely.
- Template files are strict JSON, so inline comments are not safe there unless the loader is explicitly changed to support JSONC.

Because of that, the field-by-field explanation for templates lives in this guide rather than inside the JSON files themselves.

## Theme File Structure

Theme files are raw CSS with an optional metadata header at the top.

Example shape:

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

## Template File Structure

Template files are JSON.

Example shape:

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
      "helperText": "Queued next actions",
      "columnKey": "next",
      "categoryKey": "workflow",
      "categoryLabel": "Workflow",
      "categorySubtitle": "",
      "categoryColor": "#5d7bd8",
      "categoryTag": "",
      "ruleType": "hub-section",
      "mappedSections": ["Next"],
      "done": false
    }
  ]
}
```

## Template Field Guide

- `templateId`: stable unique identifier for the template
- `name`: user-facing label in the UI
- `description`: short explanation of what the layout is for
- `builtIn`: `false` for your own templates
- `laneDefinitions`: array of lane definitions used by the board

### Lane definition fields

- `laneKey`: stable unique id for the lane
- `label`: visible lane label
- `helperText`: short supporting text under the label
- `columnKey`: shared visual column id used in grouped or matrix layouts
- `categoryKey`: stable row or swimlane grouping id
- `categoryLabel`: user-facing group label
- `categorySubtitle`: optional supporting subtitle for the group
- `categoryColor`: color used for the group header or identity
- `categoryTag`: optional stable tag-like identifier
- `ruleType`: usually `hub-section`, `completion-state`, or `custom`
- `mappedSections`: Master Task Hub section names that feed this lane
- `done`: whether the lane is treated as complete work

## Learning From The Built-Ins

Good starting points:

- `execution-default.json` for a normal personal execution board
- `support-swimlanes.json` for grouped swimlane layouts
- `bugs-and-features.json` for matrix-style grouped boards
- `dark.css` and `light.css` for strong built-in theme examples

## Safe Editing Workflow

1. copy a built-in file into a new custom file
2. rename the `templateId` or theme `id`
3. change only a few fields at a time
4. reload DASH Kanban templates and themes
5. inspect the board before making the next change

## Common Mistakes

- duplicate `templateId` or theme `id`
- malformed JSON in a template file
- forgetting that template files are strict JSON and cannot safely include comments
- mapping lanes to section names that do not exist in the Master Task Hub
- changing too many things at once and making the board hard to debug

## Related Guides

- [Projects and Kanban Guide](Projects%20and%20Kanban%20Guide.md)
- [FAQ](FAQ.md)
