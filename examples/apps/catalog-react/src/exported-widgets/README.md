# Exported widgets

Run `atlas g widget <name> --app-id=3ae54928-c2c6-491d-b766-6996ce0ef3c8`. Generator creates
`<name>/atlas.config.ts` plus `<name>/index.tsx`. Consumers call
`sdk.getWidget("<UUID from atlas.config.ts>")`; they never use folder/expose path.
