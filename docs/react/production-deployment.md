# React Production Build and Publication

Use the canonical [build-once deployment workflow](../production-deployment.md).
Vite or your React builder runs first; Atlas consumes its existing output:

```bash
npm run build -- orders
npx atlas publish orders --version 1.4.0
```

For a preview:

```bash
npm run build -- orders
npx atlas publish orders --pr 123
```

Atlas validates the output and `remoteEntry.json`, then publishes canonical
`manifest.json` with immutable payloads. Later deployment needs no React workspace,
Node install, or build step.

Verify after activation:

```bash
npx atlas verify --runtime-url https://platform.example.com/atlas.runtime.json
```

CI/CD still owns deployment of host HTML, bootstrap output, CDN/server config,
credentials, approval gates, and affected-project selection.
