# Exported widgets

Run `atlas g widget <name> --app-id=f856e01e-0fc1-4a6d-a4ec-622c68100d14`. Generator creates
`<name>/atlas.config.ts` plus `<name>/index.ts`. Consumers call
`sdk.getWidget("<UUID from atlas.config.ts>")`; they never use folder/expose path.
