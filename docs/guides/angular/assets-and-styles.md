---
title: Angular assets and styles
description: Reference images, fonts, and CSS from an Angular app so they load from the app's own artifact, and keep app styles isolated from the host.
---

# Angular assets and styles

An Atlas app is served from its own versioned artifact directory, not from the host's origin root. This guide shows you how to reference static files and write styles in an Angular app so they work in local development and in production. Read [Styles and isolation](../../concepts/styles-and-isolation.md) for the framework-neutral rules.

## Before you start

- Have an Angular app from [Build an Angular app](app.md).

## Put static files in `public/`

The generated `angular.json` copies everything in `public/` to the root of the build output. A file at `public/assets/orders-hero.png` is published as `assets/orders-hero.png` next to the app's `remoteEntry.json`.

## Reference assets in templates and component CSS

In templates and component styles, use root-relative `/assets/...` URLs:

```html
<img src="/assets/images/point.png" alt="Point" />
```

```css
.orders-hero {
  background-image: url('/assets/orders-hero.png');
}
```

While the app is mounted, Atlas rewrites URLs that start with `/assets/`, `assets/`, or `./assets/` in the app's DOM (`src`, `href`, `poster`, `data`, `srcset`, and inline `style` attributes) and in the component styles it inserts. The rewritten URL points into the app's artifact directory. Other root-relative URLs are not rewritten and resolve against the host's origin.

Do not change component CSS references to `./assets/...` only to make them relative. Angular treats that form as a build-time import and fails when no matching file exists next to the component stylesheet.

## Reference assets in TypeScript

Atlas cannot see URLs that your code passes to a library, such as a map or chart library that fetches its own images. Resolve those URLs with the SDK:

```ts
import { Component } from '@angular/core';
import { injectAtlasSdk } from '@atlas/sdk/angular';

@Component({
  selector: 'orders-map',
  standalone: true,
  template: `<div id="map"></div>`,
})
export class OrdersMapComponent {
  private readonly atlas = injectAtlasSdk();
  readonly markerUrl = this.atlas.assetUrl('assets/images/point.png');
  readonly libraryBaseUrl = this.atlas.assetBaseUrl();
}
```

Pass paths relative to the build output, without a leading `/`. Do not build asset URLs from `document.baseURI` or `location.origin`; they point at the host page. See [Angular SDK](sdk.md#use-app-assets) for `createAtlasAppAssets()`, which works in `app.config.ts`.

## Reference assets in global stylesheets

The app's global stylesheet (`src/styles.css`, listed under `styles` in `angular.json`) is published with the app and loaded from its artifact URL, so relative URLs in it resolve against the artifact directory. Reference files with a path relative to the stylesheet source, which Angular copies into the build output at build time. Root-relative URLs such as `/assets/...` in a global stylesheet resolve against the host's origin instead.

## Understand style isolation

By default, Atlas mounts each app in a Shadow DOM and loads the app's declared stylesheets into its shadow root. Global library CSS, including Ionic resets and CSS variables, stays inside the app and does not leak into the host or other apps. Atlas adapts `:root` selectors in those stylesheets to the app's shadow host, including rules inside imports, layers, and media queries, so sibling apps can use different values for the same variable.

Angular component styles need one more step. `provideAtlasApp()` in the generated `src/app/app.config.ts` redirects Angular's runtime component styles from the document `<head>` to the app's `styleTarget`. Keep `provideAtlasApp()` in your providers; without it, component styles go to the host document instead of the app.

Shadow DOM isolation has limits:

- Libraries that insert CSS directly into `document.head`, or change `document.documentElement`, are not redirected. Use a library option that sets the insertion target if one exists.
- Overlays that a library attaches to `document.body` render outside the app's shadow root and lose its styles.
- Cross-origin stylesheets and their `@import` rules must allow CORS, because Atlas fetches imports to adapt them. With a Content Security Policy, `connect-src` must allow those URLs.

For an app that intentionally shares the host's documented design-system CSS, set `domIsolation: 'shared-dom'` in its `atlas.config.ts`. Shared DOM mode wraps the app in a DOM element but does not isolate CSS.

## Keep host styles in the host

The host owns global layout styles, design-system CSS, fonts, and CSS variables that it shares with apps on purpose. Apps should not reset `body`, change the host's navigation layout, or depend on host-only class names unless the host team documents that contract.

## Serve assets correctly

Your CDN or registry server must serve JavaScript with a JavaScript MIME type, serve `remoteEntry.json` as `application/json`, allow CORS for every host origin, and return a real 404 for missing files instead of the host's `index.html`. See [Production deployment](../../deploy/production-deployment.md) and [Security](../../deploy/security.md) for the full server requirements.

## Next steps

- [Styles and isolation](../../concepts/styles-and-isolation.md)
- [Angular SDK](sdk.md)
- [Angular troubleshooting](troubleshooting.md)
