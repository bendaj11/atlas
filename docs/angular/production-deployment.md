# Angular Production Build and Publication

Use the canonical [build-once deployment workflow](../production-deployment.md).
Angular builds first; Atlas publishes its existing browser output:

```bash
npx ng build orders --configuration production
npx atlas publish orders --version 1.4.0
```

For a preview:

```bash
npx ng build orders --configuration production
npx atlas publish orders --mr 123
```

Atlas validates Angular output and `remoteEntry.json`, then writes canonical
`manifest.json` beside immutable payload files in registry storage. Deployment
later needs no Angular workspace or build tools.

## Native Federation

Generated Angular projects use Native Federation with singleton sharing, strict
versions, and automatic required-version lookup. Matching host/app versions reuse
one host-provided package; incompatible versions remain isolated or fail under
Native Federation policy. Keep generated sharing rules when customizing config.

For `No entry point found for <package>` warnings, use
[Angular troubleshooting](troubleshooting.md#native-federation-warns-no-entry-point-found-for-package)
to decide whether to skip the package or correct runtime dependency setup.

## Verify

After `atlas deploy`, verify the deployed bootstrap and active host manifest:

```bash
npx atlas verify --runtime-url https://platform.example.com/atlas.runtime.json
```

CI/CD still owns deployment of Angular host HTML, bootstrap output, server/CDN
configuration, credentials, and approval gates.
