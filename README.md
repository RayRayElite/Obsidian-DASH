# Daily Dashboard

Daily Dashboard is an Obsidian plugin that opens as its own dashboard tab instead of injecting a panel into the workspace chrome.

## What It Does

- tracks repeat daily habits with per-day counts
- stores mood, energy, Top 3 focus, friction log, timestamped food entries, sleep log, dream log, and daily notes
- supports user-controlled logical days with begin-day/end-day tracking so late-night work does not roll into the wrong calendar day
- tracks work sessions and nap sessions inside the active logical day for more accurate sleep and activity history
- writes a markdown daily log note for every tracked day
- generates weekly reviews plus weekly and monthly markdown reports from those daily logs
- can call OpenAI for AI-powered today planning, end-of-day review, weekly coaching, project triage, and freeform questions grounded in dashboard context
- reads a master todo note to show project workload snapshots, stale work, health trends, linked notes, and completion progress
- automatically archives completed checklist items from the master todo into a per-project completed archive section with date and time
- lets you quick-add tasks into project sections, promote project tasks into today focus, search archived work history, sync repeating tasks, and offload project references into project notes
- lets you pick a hero wallpaper from a vault folder in plugin settings

## Master Todo Workflow

Point the plugin at your `Master Task Hub.md` note in settings. The note works best when each project uses a `##` heading and includes optional metadata such as `Project Note:: [[Note Name]]`, `Status::`, `Focus::`, and `Relationships::`.

1. keep active work as unchecked checklist items in non-reference sections
2. mark a task complete with `- [x]`
3. the plugin automatically moves it into that project's `Completed Archive` section and records it in that day's dashboard log

This gives you a work-history trail without deleting finished tasks.

The richer dashboard flow also works best when projects keep `### Now`, `### Next`, `### Later`, `### Repeating`, `### Completed Archive`, and `### Reference` sections. New projects created by the plugin now include that structure automatically.

## Logical Day Tracking

The dashboard now separates your real day from the calendar date.

1. Use `Begin logical day` when you are actually up and starting the day.
2. Use `End logical day` when you are done and heading to bed, even if the clock has passed midnight.
3. Use `Start work session` and `Stop work session` to track actual focused work time inside that logical day.
4. Use `Start nap session` and `Stop nap session` whenever you sleep during the day so naps are logged separately from your final sleep time.

The dashboard records wake time, sleep time, day start/end, tracked work sessions, and tracked naps into the daily log note and period reports.

Habit completions now also capture timestamps for each completion step, and food entries capture the time they were logged, so the dashboard and AI features can reason about routine timing instead of only totals.

## AI Integration

The dashboard now includes an `AI Workspace` card plus command-palette actions for:

1. `Generate AI today plan`
2. `Generate AI end-of-day review`
3. `Generate AI project triage`
4. `Generate AI weekly coach note`
5. `Ask AI about dashboard and vault`
6. `Analyze active note with AI`

AI output is written into `Dashboard Logs/AI` by default, grouped by date, so the generated planning and analysis stays searchable in your vault.

Recommended starting model: `gpt-4o-mini`.
Use that as the default for frequent dashboard actions because it is usually the best cost-to-quality tradeoff for planning, reflection, and triage. If later you want deeper long-form strategic writeups, you can swap the model in settings without changing the rest of the plugin.

Setup notes:

1. Put your OpenAI API key into the plugin settings.
2. Leave the API URL at the default unless you intentionally want a different compatible endpoint.
3. Adjust `AI context days` if you want broader or narrower historical context in prompts.

The API key is stored in plugin settings, not a secure vault, so if you sync plugin settings across devices that key will sync too.

The AI context is now deeper than the dashboard alone. In addition to current-day and recent-report context, the plugin can pull in relevant vault notes, project notes, and the active note you are currently reading. `AI related note limit` controls how many retrieved notes are included in each request.

## Cross-Device Sync Notes

If you use Obsidian Sync across desktop and mobile, the plugin now reloads synced dashboard state before day/session actions and also polls for synced changes in the background. That means actions like starting a nap on your phone and stopping it on desktop should work once sync has landed on the second device.

The Day Flow card now shows the last sync check, last applied sync, last live-state write, and the current sync source. It also includes a `Refresh sync` button if you want to force a cross-device refresh immediately.

Logical day and session state are also mirrored into a vault markdown note at `Dashboard Logs/State/Live Day State.md` by default. You can change that path in plugin settings if you want the live sync note somewhere else in your vault.

There is still one class of risk to be aware of: if two devices make different dashboard changes before sync finishes, the plugin cannot fully prevent conflicts. Logical day and session state now have a vault note mirror, but the broader dashboard dataset still lives in plugin data. The safest workflow for day/session controls is to wait a moment for sync to complete before continuing on the second device.

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

If you do not want to use a junction, the next best option is a deploy script that copies `main.js`, `manifest.json`, `styles.css`, and the `Wallpapers` folder into your vault automatically. The junction approach is simpler and less fragile.