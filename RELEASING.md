# Releasing Obsidian DASH

Use this checklist when cutting a public beta or community-plugin release.

## Before Tagging

1. confirm `manifest.json`, `package.json`, and `versions.json` all reflect the intended version
2. update [CHANGELOG.md](CHANGELOG.md) with the user-visible release notes
3. run `npm run build`
4. run `npm run verify:release`
5. run `npm run build:deploy -- "D:/Game Dev/Projects/.obsidian/plugins/daily-dashboard"`
6. reload the plugin in Obsidian and sanity-check the release-critical surfaces:
   - dashboard opens
   - DASH Kanban opens
   - docs center opens
   - a representative repair or refresh command still works
7. run the relevant scenarios in [TESTING.md](TESTING.md) for the release slice you are shipping

## GitHub Release Flow

1. commit the release-prep changes
2. tag the commit with the exact plugin version, for example `0.5.0`
3. push the tag
4. let the GitHub Actions release workflow build the prerelease
5. confirm the workflow passed the `verify:release` step
6. verify the release assets include:
   - `main.js`
   - `manifest.json`
   - `styles.css`
7. copy the matching summary from [CHANGELOG.md](CHANGELOG.md) into the GitHub release notes
8. confirm the prerelease page shows the assets and notes correctly

## Package Metadata Decision

`package.json` should stay `private: true`.

- DASH releases are distributed through GitHub releases, BRAT, and the Obsidian community-plugin flow, not npm
- keeping the package private reduces the chance of accidental npm publishing

## Beta Distribution Decision

Current recommendation:

- BRAT is the primary install path for outside beta users
- direct GitHub release install is also supported for advanced users who want manual control
- start with a 10 to 20 user desktop-first cohort before expanding beta access further

## Future Ideas Messaging

Keep future-facing ideas visible only as non-promissory possibilities.

- this especially applies to mobile sync and voice-triggered workflows
- do not write public release notes or beta docs in a way that makes those sound committed

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