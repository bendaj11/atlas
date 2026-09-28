---
title: React assets and styles
description: Reference images, fonts, and CSS from a React App so they load from any Host, and keep styles inside the App's isolation boundary.
---

# React assets and styles

A React App runs inside a Host page, but its files are published under their own versioned path, often on a CDN. This guide shows how to reference assets so they resolve from that path, and how styles work inside the App's Shadow DOM. Read [Styles and isolation](../../concepts/styles-and-isolation.md) for the rules shared by every framework. You need a React App from [Build a React App](app.md).

## Reference assets in components

Generated React Apps build with a relative Vite `base` (`./`). Import assets relative to the file that uses them, and Vite emits the correct URL:

```tsx
import heroUrl from './assets/orders-hero.png';

export function OrdersHero() {
  return <img src={heroUrl} alt="Orders" />;
}
```

While the App is mounted, Atlas also rewrites URLs that start with `/assets/`, `assets/`, or `./assets/` in the App's DOM: the `src`, `href`, `poster`, `data`, `srcset`, and inline `style` attributes, and `<style>` elements inside the App's container. The rewritten URL points into the App's artifact directory, so `<img src="/assets/logo.svg" />` loads `public/assets/logo.svg` from the App's own build output. Other root-relative URLs, such as `/images/logo.svg`, are not rewritten and resolve against the Host's origin.

## Reference assets in global stylesheets

In CSS files, use URLs relative to the stylesheet. Vite resolves them during the build:

```css
.orders-hero {
  background-image: url('./assets/orders-hero.png');
}
```

Atlas loads the App's published CSS files with `<link>` elements and does not rewrite URLs inside them. The browser resolves relative URLs against the stylesheet's own URL in the artifact directory.

## Reference assets in TypeScript

Some libraries receive a URL string and fetch the file themselves, for example a map or chart library. Atlas cannot see those URLs, so pass the library a URL that is already complete. Use the imported URL:

```tsx
import pointImageUrl from './assets/images/point.png';

createMarker({ icon: pointImageUrl });
```

When an import does not fit, `new URL('./assets/images/point.png', import.meta.url).href` gives the same result. Do not build URLs from `document.baseURI` or `location.origin`; they point at the Host page.

For files in the App's `public/` folder, use `sdk.assetUrl()` and `sdk.assetBaseUrl()`. See [Use App assets](sdk.md#use-app-assets).

## Keep styles inside the App

Atlas mounts each App in a Shadow DOM by default (`domIsolation: 'shadow-dom'`) and loads the App's stylesheets into that shadow root. Global CSS from a library in your App cannot leak into the Host or other Apps, and Host CSS does not restyle your App.

Libraries that inject styles at runtime, such as CSS-in-JS libraries, write to `document.head` by default. That is outside the shadow root, so the styles do not apply. Pass the node from `useAtlasStyleTarget()` to the library's insertion-target option instead:

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

For styled-components, pass the same node as the `target` of `StyleSheetManager`. `useAtlasStyleTarget()` works only inside a mounted App; elsewhere it throws `ATLAS_STYLE_TARGET_MISSING`.

If a library has no insertion-target option, it cannot style content inside the shadow root. In that case, set `domIsolation: 'shared-dom'` in the App's `atlas.config.ts`. The App then renders in the page DOM and shares global CSS with the Host, so use it only when you intend to share styles.

## Share styles from the Host

The Host owns global layout styles, design-system CSS, fonts, and CSS variables that it intentionally shares with Apps. CSS custom properties defined on the Host page inherit into Shadow DOM, so they are a good way to share design tokens. Apps should not reset `body`, change Host layout, or depend on Host class names unless the Host team documents that contract.

## Use assets in monorepos

In Nx, Turborepo, pnpm, Yarn, or npm workspaces, keep assets in the package that owns the App. Atlas publishes the framework build output as it is; it does not add a second asset pipeline.

## Serve assets correctly

Your CDN or registry server must serve JavaScript with a JavaScript MIME type, serve `remoteEntry.json` as `application/json`, allow CORS for every Host origin, and return a real 404 for missing files instead of the Host's `index.html`. `npx atlas verify` checks content types, CORS, and cache headers. See [Verify](production-deployment.md#verify), [Set cache headers](../../deploy/bootstrap.md#set-cache-headers), and [Security](../../deploy/security.md).

## Next steps

- [Styles and isolation](../../concepts/styles-and-isolation.md) for isolation modes and their limits.
- [React SDK](sdk.md) for the asset helpers.
- [React troubleshooting](troubleshooting.md) if styles or assets do not load.
