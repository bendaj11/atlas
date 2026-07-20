# Exported widgets

Run `atlas g widget <name> --app-id=9a703156-6c63-47bb-aa10-d3d3a1b2a38b`. Generator creates
`<name>/atlas.config.ts` plus `<name>/index.ts`. Consumers call
`sdk.getWidget("<UUID from atlas.config.ts>")`; they never use folder/expose path.
