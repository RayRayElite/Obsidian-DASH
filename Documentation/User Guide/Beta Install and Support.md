# Beta Install and Support

Use this guide when you want to install the public beta, understand what the beta includes, and know where to report issues.

## Platform Scope

The current public beta should be treated as desktop-only.

- DASH is optimized first for desktop use.
- Mobile support is not part of the current beta promise.

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
3. paste the Obsidian DASH GitHub repository URL - https://github.com/RayRayElite/Obsidian-DASH
4. let BRAT install the current beta release
5. reload Obsidian if needed

Modern BRAT does not install the whole repository contents.

For current BRAT releases, the repository URL is mainly how BRAT finds the GitHub project. After that, BRAT looks at the repo's GitHub releases, picks the latest release or prerelease by version, and downloads the release assets it needs.

For Obsidian DASH, the important release assets are:

- `manifest.json`
- `main.js`
- `styles.css`

BRAT writes those files into `.obsidian/plugins/daily-dashboard/` because the plugin id in `manifest.json` is `daily-dashboard`.

That means the root repo URL is enough for BRAT users as long as these things stay true:

- the repo has a valid GitHub release or prerelease
- the release includes `manifest.json`, `main.js`, and `styles.css`
- the release tag version matches the released `manifest.json` version

The rest of the repository structure is not what BRAT installs into the vault. Documentation, screenshots, and other repo folders are useful for humans, but they are not part of the installed plugin files.

To reduce avoidable user issues, assume users should be on a reasonably current BRAT version. Older BRAT setups used older beta-manifest behavior, but current BRAT uses GitHub release assets as the source of truth.

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

## Known Limitations

- The current beta should be treated as desktop-only.
- Budgeting and gamification are still experimental.
- Advanced Trello-style Kanban extras such as comments, assignee images, non-image attachments, and percentage progress bars are not part of the current release promise.
- AI workflows are optional and depend on separate model setup.

## Where Feedback Goes

For the public beta, GitHub Issues are the primary channel.

- bug reports: GitHub Issues
- feature requests: GitHub Issues
- first-impression or workflow-friction reports: GitHub Issues using the beta feedback template
- forum posts or Discord can be used for visibility later, but they are not the primary support queue during beta triage

## What To Include In A Bug Report

- what you expected
- what happened instead
- exact steps to reproduce the issue
- screenshots if the issue is visual
- whether the issue depends on Kanban, AI, budgeting, or a specific setting
- whether the problem happens in a fresh vault or only your existing vault

## What Counts As A Beta Blocker

- the plugin fails to load or the dashboard does not open
- DASH Kanban breaks normal project workflow
- install instructions or release assets are wrong enough to strand a new user
- repair guidance is missing for a common broken state

## What Feedback Is Useful But Usually Not Blocking

- requests for future mobile support
- requests for richer Trello-like Kanban extras
- requests for deeper nutrition tracking
- polish suggestions that do not break core dashboard, hub, or Kanban use

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
