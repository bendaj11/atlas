---
title: Styles and isolation
description: Understand how Atlas keeps App styles away from the Host and other Apps, what each isolation mode does, and how App asset URLs resolve.
---

# Styles and isolation

Several teams' CSS and DOM share one page in an Atlas [Host](hosts.md). This page explains the rules that apply to every framework: who owns which styles, how Atlas isolates each [App](apps.md), and how App asset URLs are resolved. For build setup, read [React assets and styles](../guides/react/assets-and-styles.md) or [Angular assets and styles](../guides/angular/assets-and-styles.md).

## Who owns which styles

- The **Host** owns the page layout: the areas around its [host anchors](host-anchors.md), global typography, and any design tokens it offers to Apps.
- Each **App** owns the styles of the UI it renders inside its route outlet or slot.

An App never styles the Host, and the Host does not style the inside of an App. When Apps need shared visual values, the Host exposes them on purpose, for example as CSS custom properties.

## Isolation modes

Each App chooses how Atlas separates its DOM and styles from the rest of the page with `domIsolation` in `atlas.config.ts`:

| `domIsolation`         | DOM                                                                                    | App styles                                                               |
| ---------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `shadow-dom` (default) | Atlas creates a wrapper element with an open shadow root and mounts the App inside it. | Loaded inside the shadow root. They cannot reach the Host or other Apps. |
| `shared-dom`           | Atlas creates a plain wrapper element and mounts the App inside it.                    | Loaded into the document `<head>`. They are global.                      |

```ts
import type { AtlasAppConfig } from '@atlas/schema';

export default {
  type: 'app',
  id: '2bea9c13-4899-4f93-9211-cd8c55e9c529',
  name: 'Orders',
  framework: 'angular',
  domIsolation: 'shared-dom',
} satisfies AtlasAppConfig;
```

Keep the default unless the App deliberately takes part in a Host design-system contract that relies on global CSS. With `shared-dom`, App selectors can restyle the Host and other Apps, and Host selectors can restyle the App.

[Exported widgets](../guides/exported-widgets.md) use the isolation mode of the App that owns them.

## How Atlas loads App styles

The published artifact manifest lists each App's stylesheets. Before Atlas mounts an App, it adds a `<link rel="stylesheet">` for each one to the App's style target: the shadow root for `shadow-dom`, or the document `<head>` for `shared-dom`. Atlas waits until the stylesheets load, and it removes them when the last App that uses them unmounts.

For `shadow-dom` Apps, Atlas also adapts each stylesheet to the shadow root:

- Atlas rewrites `:root` selectors to `:host`, so CSS custom properties that an App declares on `:root` still apply inside its shadow root.
- Atlas requests the stylesheets and their `@import` rules with CORS. The server that hosts App files must send CORS headers for CSS as well as JavaScript.

When a manifest declares a stylesheet `integrity` hash, the browser checks it before it applies the file.

## Limits of shadow DOM isolation

A shadow root isolates selectors, but some things still cross it:

- Inherited CSS properties, such as `font-family` and `color`, flow from the Host into the App.
- CSS custom properties defined by the Host flow into the App. This is the intended way to share design tokens.
- `@font-face` rules only take effect when the document declares them. Load shared fonts in the Host.
- UI that a library renders into `document.body`, such as overlays, portals, and toasts, is outside the App's shadow root and does not receive the App's styles. Render such UI inside the App, or have the Host provide it through an SDK extension.

## Assets

Atlas loads every App version from its own immutable path in the artifact registry, not from the Host origin. While an App is mounted, the runtime rewrites asset URLs that point into the App's `assets/` folder so that they resolve against the App's artifact:

- It rewrites `/assets/...`, `assets/...`, and `./assets/...` URLs.
- It rewrites them in the `src`, `href`, `srcset`, `poster`, and `data` attributes and inline `style` attributes of elements inside the App's container, and in `url()` values of `<style>` elements that the App adds to the page.
- It applies to every App, in both isolation modes, including elements the App adds or changes after it mounts.

The runtime does not rewrite these cases:

- Root-relative URLs outside `/assets/`, such as `/images/logo.svg`. They resolve against the Host origin.
- `url()` values inside the App's published stylesheet files. Relative URLs there resolve against the stylesheet's own URL in the artifact and work; root-relative URLs resolve against the Host origin.
- URLs that you pass to JavaScript APIs, such as `fetch()` or `new Image()`, instead of writing them into the DOM.
- Elements that a library renders outside the App's container, such as portals in `document.body`.
- Absolute and protocol-relative URLs, which the runtime leaves as they are.

For those cases, import the asset through your bundler, use a URL relative to the stylesheet, or build the URL with the SDK asset helpers `assetUrl()` and `assetBaseUrl()`, which resolve against the mounted App's own artifact. The framework guides show the exact setup.

## Isolation and shared dependencies

DOM isolation does not change how Native Federation shares dependencies. An App reuses the Host's copy of a shared package only when both use exactly the same version; otherwise the App loads its own copy. See [Performance and startup cost](../introduction/architecture.md#performance-and-startup-cost). Only the place where styles attach changes between isolation modes.

## Related

- [React assets and styles](../guides/react/assets-and-styles.md)
- [Angular assets and styles](../guides/angular/assets-and-styles.md)
- [Host anchors](host-anchors.md)
- [Shadow DOM limits](../introduction/architecture.md#shadow-dom-limits)
