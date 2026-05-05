# Beta Install and Support

Use this guide when you want to install the public beta, understand what the beta includes, and know where to report issues.

## What The Public Beta Covers

The public beta should be treated as stable enough for normal use in these areas:

- daily dashboard
- Master Task Hub centered project workflow
- DASH Kanban core board workflow
- logs, reports, exports, and support-note structure

## What Is Not A Maturity Promise Yet

These areas may work well already, but they are not the main maturity promise for the beta:

- budgeting
- gamification
- some optional Kanban features that would push the board toward Trello-style collaboration depth

## BRAT Beta Install Path

Recommended beta install path:

1. install the BRAT plugin in Obsidian
2. open BRAT and choose the add beta plugin flow
3. paste the Obsidian DASH GitHub repository URL
4. let BRAT install the current beta release
5. reload Obsidian if needed

## Direct Release Install Path

Advanced users can also install directly from GitHub releases:

1. download the latest release assets
2. place `main.js`, `manifest.json`, and `styles.css` into a plugin folder named `daily-dashboard`
3. enable the plugin in Obsidian community plugins

## Support Expectations

- DASH is actively maintained, but still in beta.
- Issues are welcome.
- Feature requests may be accepted selectively.
- The plugin is optimized first for practical desktop use, not for every possible workflow.
- Planned ideas are not promises until they are explicitly shipped.

## What To Include In A Bug Report

- what you expected
- what happened instead
- exact steps to reproduce the issue
- screenshots if the issue is visual
- whether the issue depends on Kanban, AI, budgeting, or a specific setting
- whether the problem happens in a fresh vault or only your existing vault

## First Recovery Actions

If something looks wrong, try the smallest relevant recovery action first:

- refresh generated artifacts
- run the relevant repair command
- rebuild the AI note index if retrieval looks stale
- reload Kanban templates and themes if you changed asset files
- confirm important note and folder settings still point where you expect

## Related Guides

- [Quick Start](Quick%20Start.md)
- [Projects and Kanban Guide](Projects%20and%20Kanban%20Guide.md)
- [FAQ](FAQ.md)
