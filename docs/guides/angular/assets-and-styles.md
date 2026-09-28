---
title: Angular assets and styles
description: Reference images, fonts, and CSS from an Angular App so they load from the App's own artifact, and keep App styles isolated from the Host.
---

# Angular assets and styles

An Angular App runs inside a Host page, but its files are published under their own versioned path, often on a CDN. This guide shows how to reference assets so they resolve from that path, and how styles work inside the App's Shadow DOM. Read [Styles and isolation](../../concepts/styles-and-isolation.md) for the rules shared by every framework. You need an Angular App from [Build an Angular App](app.md).

## Put static files in `public/`

The generated `angular.json` copies everything in `public/` to the root of the build output. A file at `public/assets/orders-hero.png` is published as `assets/orders-hero.png` next to the App's `remoteEntry.json`.

## Reference assets in components

In templates and component styles, use root-relative `/assets/...` URLs:

```html
<img src="/assets/images/point.png" alt="Point" />
```

```css
.orders-hero {
  background-image: url('/assets/orders-hero.png');
}
```

While the App is mounted, Atlas rewrites URLs that start with `/assets/`, `assets/`, or `./assets/` in the App's DOM: the `src`, `href`, `poster`, `data`, `srcset`, and inline `style` attributes, and `<style>` elements inside the App's container. It also rewrites the component styles that Angular inserts for the App. The rewritten URL points into the App's artifact directory. Other root-relative URLs, such as `/images/point.png`, are not rewritten and resolve against the Host's origin.

Do not change component CSS references to `./assets/...` only to make them relative. Angular treats that form as a build-time import and fails when no matching file exists next to the component stylesheet.

## Reference assets in global stylesheets

The App's global stylesheet (`src/styles.css`, listed under `styles` in `angular.json`) is published with the App. Atlas loads it with a `<link>` element and does not rewrite URLs inside it, so the browser resolves relative URLs against the stylesheet's own URL in the artifact directory. Reference files with a path relative to the stylesheet source, which Angular copies into the build output at build time. A root-relative `/assets/...` URL in a global stylesheet resolves against the Host's origin instead.

## Reference assets in TypeScript

Some libraries receive a URL string and fetch the file themselves, for example a map or chart library. Atlas cannot see those URLs, so resolve them with the SDK:

```ts
import { Component } from '@angular/core';
import { injectAtlasSdk } from '@atlas/sdk/angular';

@Component({
  selector: 'orders-map',
  standalone: true,
  template: `<div id="map"></div>`,
})
export class OrdersMapComponent {
  readonly sdk = injectAtlasSdk();
  readonly markerUrl = this.sdk.assetUrl('assets/images/point.png');
  readonly libraryBaseUrl = this.sdk.assetBaseUrl();
}
```

Pass paths relative to the build output, without a leading `/`. Do not build asset URLs from `document.baseURI` or `location.origin`; they point at the Host page. See [Use App assets](sdk.md#use-app-assets) for `createAtlasAppAssets()`, which works in `app.config.ts`.

## Keep styles inside the App

Atlas mounts each App in a Shadow DOM by default (`domIsolation: 'shadow-dom'`) and loads the App's declared stylesheets into its shadow root. Global library CSS, including Ionic resets and CSS variables, stays inside the App and does not leak into the Host or other Apps. Atlas adapts `:root` selectors in those stylesheets to the App's shadow host, including rules inside imports, layers, and media queries, so sibling Apps can use different values for the same variable.

Angular component styles need one more step. `provideAtlasApp()` in the generated `src/app/app.config.ts` redirects Angular's runtime component styles from the document `<head>` to the App's `styleTarget`. Keep `provideAtlasApp()` in your providers; without it, component styles go to the Host document instead of the App.

Shadow DOM isolation has limits:

- Libraries that insert CSS directly into `document.head`, or change `document.documentElement`, are not redirected. Use a library option that sets the insertion target if one exists.
- Overlays that a library attaches to `document.body` render outside the App's shadow root and lose its styles.
- Cross-origin stylesheets and their `@import` rules must allow CORS, because Atlas fetches imports to adapt them. With a Content Security Policy, `connect-src` must allow those URLs.

For an App that intentionally shares the Host's documented design-system CSS, set `domIsolation: 'shared-dom'` in its `atlas.config.ts`. Shared DOM mode wraps the App in a DOM element but does not isolate CSS.

## Share styles from the Host

The Host owns global layout styles, design-system CSS, fonts, and CSS variables that it intentionally shares with Apps. CSS custom properties defined on the Host page inherit into Shadow DOM, so they are a good way to share design tokens. Apps should not reset `body`, change Host layout, or depend on Host class names unless the Host team documents that contract.

## Serve assets correctly

Your CDN or registry server must serve JavaScript with a JavaScript MIME type, serve `remoteEntry.json` as `application/json`, allow CORS for every Host origin, and return a real 404 for missing files instead of the Host's `index.html`. `npx atlas verify` checks content types, CORS, and cache headers. See [Verify](production-deployment.md#verify), [Set cache headers](../../deploy/bootstrap.md#set-cache-headers), and [Security](../../deploy/security.md).

## Next steps

- [Styles and isolation](../../concepts/styles-and-isolation.md) for isolation modes and their limits.
- [Angular SDK](sdk.md) for the asset helpers.
- [Angular troubleshooting](troubleshooting.md) if styles or assets do not load.
