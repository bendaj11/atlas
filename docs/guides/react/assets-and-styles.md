---
title: React assets and styles
description: Reference images, fonts, and CSS from a React App so they load from any Host, and keep styles inside the App's isolation boundary.
---

# React assets and styles

A React App runs inside a Host page, but its files are published under their own versioned
path, often on a CDN. This guide shows how to reference assets so they resolve from that
path, and how styles work inside the App's Shadow DOM. Read
[Styles and isolation](../../concepts/styles-and-isolation.md) for the rules shared by every
framework.

## Reference assets from source files

Generated React Apps build with a relative Vite `base` (`./`). Import assets relative to the
file that uses them, and Vite emits the correct URL:

```tsx
import heroUrl from './assets/orders-hero.png';

export function OrdersHero() {
  return <img src={heroUrl} alt="Orders" />;
}
```

In CSS, use relative URLs. Vite resolves them during the build:

```css
.orders-hero {
  background-image: url('./assets/orders-hero.png');
}
```

Avoid root-relative URLs in an App:

```css
.orders-hero {
  background-image: url('/assets/orders-hero.png');
}
```

`/assets/...` resolves against the Host's origin, not the App's published folder, so the file
is not found in production.

## Pass asset URLs to libraries

Some libraries receive a URL string and fetch the file themselves, for example a map or chart
library. Pass them the imported URL:

```tsx
import pointImageUrl from './assets/images/point.png';

createMarker({ icon: pointImageUrl });
```

When an import does not fit, `new URL('./assets/images/point.png', import.meta.url).href`
gives the same result. Do not build URLs from `document.baseURI` or `location.origin`; they
point at the Host page.

For files in the App's `public/` folder, use `sdk.assetUrl()` and `sdk.assetBaseUrl()`. See
[Use app assets](sdk.md#use-app-assets).

## Keep styles inside the app

Atlas mounts each App in a Shadow DOM by default (`domIsolation: 'shadow-dom'`) and loads the
App's stylesheets into that shadow root. Global CSS from a library in your App cannot leak
into the Host or other Apps, and Host CSS does not restyle your App.

Libraries that inject styles at runtime, such as CSS-in-JS libraries, write to
`document.head` by default. That is outside the shadow root, so the styles do not apply. Pass
the node from `useAtlasStyleTarget()` to the library's insertion-target option instead:

```tsx
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import { useMemo, type ReactNode } from 'react';
import { useAtlasStyleTarget } from '@atlas/sdk/react';

export function StyleBoundary({ children }: { children: ReactNode }) {
  const container = useAtlasStyleTarget();
  const cache = useMemo(
    () => createCache({ key: 'orders', container }),
    [container],
  );

  return <CacheProvider value={cache}>{children}</CacheProvider>;
}
```

For styled-components, pass the same node as the `target` of `StyleSheetManager`.
`useAtlasStyleTarget()` works only inside a mounted App; elsewhere it throws
`ATLAS_STYLE_TARGET_MISSING`.

If a library has no insertion-target option, it cannot style content inside the shadow root.
In that case, set `domIsolation: 'shared-dom'` in the App's `atlas.config.ts`. The App then
renders in the page DOM and shares global CSS with the Host, so use it only when you intend
to share styles.

## Share styles from the host

The Host owns global layout styles, design-system CSS, fonts, and CSS variables that it
intentionally shares with Apps. CSS custom properties defined on the Host page inherit into
Shadow DOM, so they are a good way to share design tokens. Apps should not reset `body`,
change Host layout, or depend on Host class names unless the Host team documents that
contract.

## Use assets in monorepos

In Nx, Turborepo, pnpm, Yarn, or npm workspaces, keep assets in the package that owns the
App. Atlas publishes the framework build output as it is; it does not add a second asset
pipeline.

## When you deploy

Published App files must be served with correct MIME types, CORS headers for every Host
origin, and long-lived cache headers. `npx atlas verify` checks these. See
[React production deployment](production-deployment.md#verify) and
[Security](../../deploy/security.md).

## Next steps

- [Styles and isolation](../../concepts/styles-and-isolation.md) for isolation modes and
  their limits.
- [React troubleshooting](troubleshooting.md) if styles or assets do not load.
