# Releasing Obsidian DASH

Use this checklist when cutting a public beta or community-plugin release.

## Before Tagging

1. confirm `manifest.json`, `package.json`, and `versions.json` all reflect the intended version
2. update [CHANGELOG.md](CHANGELOG.md) with the user-visible release notes
3. run `npm run build`
4. run `npm run build:deploy -- "D:/Game Dev/Projects/.obsidian/plugins/daily-dashboard"`
5. reload the plugin in Obsidian and sanity-check the release-critical surfaces:
   - dashboard opens
   - DASH Kanban opens
   - docs center opens
   - a representative repair or refresh command still works

## GitHub Release Flow

1. commit the release-prep changes
2. tag the commit with the exact plugin version, for example `0.5.0`
3. push the tag
4. let the GitHub Actions release workflow build the draft release
5. verify the release assets include:
   - `main.js`
   - `manifest.json`
   - `styles.css`
6. copy the matching summary from [CHANGELOG.md](CHANGELOG.md) into the GitHub release notes
7. publish the draft release when the assets and notes look correct

## Beta Distribution Decision

Current recommendation:

- BRAT is the primary install path for outside beta users
- direct GitHub release install is also supported for advanced users who want manual control

## Beta Blockers

Treat these as release blockers for a public beta tag:

- plugin fails to load or the dashboard view does not open
- DASH Kanban fails to open or corrupts normal project workflows
- build output is missing required release assets
- docs, install instructions, or repair guidance are wrong enough to strand a new user
- a regression breaks core dashboard, project hub, or Kanban use in a normal desktop vault

## Informative But Usually Non-Blocking Feedback

- requests for future mobile support
- requests for richer Trello-like Kanban extras
- requests for deeper nutrition tracking
- polish requests that do not break core workflow understanding or reliability