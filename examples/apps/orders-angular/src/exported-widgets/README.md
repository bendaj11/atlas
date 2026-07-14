# Exported widgets

Run `atlas g widget <name> --app=orders-angular`. Generator creates
`<name>/atlas.widget.ts` plus `<name>/index.ts`. Consumers call
`sdk.getWidget("<UUID from atlas.widget.ts>")`; they never use folder/expose path.
