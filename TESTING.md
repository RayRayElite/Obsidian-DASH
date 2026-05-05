# Beta Testing Matrix

Use this checklist before a public beta tag and after any change that touches onboarding, core workflow, Kanban, docs, or release assets.

## Required Scenarios

### 1. Fresh Install In A Blank Vault

- install the plugin from the current build or release assets
- confirm the dashboard opens
- confirm the first-run setup wizard is reachable
- confirm the docs center opens
- confirm the default empty states tell the user what to do next

### 2. Upgrade From An Existing Personal Vault

- install the updated build over an older local version
- confirm saved settings still load
- confirm the dashboard opens without data loss
- confirm existing Kanban boards and generated docs still load

### 3. AI Disabled

- leave AI unconfigured
- confirm the dashboard, docs, project workflow, and Kanban still feel usable
- confirm AI areas explain that setup is optional instead of feeling broken

### 4. Kanban Disabled Or Unused

- disable Kanban foundations or avoid using the board
- confirm the dashboard and Master Task Hub workflow still make sense on their own
- confirm no critical setup copy assumes Kanban is mandatory

### 5. Budgeting Disabled

- leave budgeting off
- confirm the dashboard stays readable and no finance prompts dominate the page

### 6. Theme And Template Reload

- edit or add a theme file
- edit or add a template file
- run `Reload DASH Kanban templates and themes`
- confirm valid assets load and invalid files fail clearly

### 7. Docs Generation And Refresh

- run the docs refresh command
- confirm the generated docs notes update correctly
- confirm the in-DASH docs center still opens the expected pages

### 8. Repair And Recovery Paths

- run at least one representative repair or refresh command
- confirm the result is understandable and does not strand the user
- confirm the public docs point to the right first recovery action

### 9. Custom Asset Authoring Smoke Test

- copy a built-in theme into a custom theme file and reload assets
- copy a built-in template into a custom template file and reload assets
- confirm the docs are sufficient for a careful user to make one safe custom asset change

## Beta Exit Notes

Current beta-prep status:

- latest full manual pass completed on 2026-05-04
- all required scenarios in this matrix passed in the current local validation pass

Record these before tagging:

- which vaults were used for validation
- which scenarios passed
- which scenarios were skipped and why
- any known non-blocking issues being accepted into the beta