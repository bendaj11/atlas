# Exported widgets

Run `atlas g widget <name> --app-id=56e41bf1-d1b4-486f-a340-5782ee632bad`. Generator creates
`<name>/atlas.config.ts` plus `<name>/index.tsx`. Consumers call
`sdk.getWidget("<UUID from atlas.config.ts>")`; they never use folder/expose path.
