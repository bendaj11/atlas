# Exported widgets

Run `atlas g widget <name> --app=dashboard-react`. Generator creates
`<name>/atlas.widget.ts` plus `<name>/index.tsx`. Consumers call
`sdk.getWidget("<UUID from atlas.widget.ts>")`; they never use folder/expose path.
