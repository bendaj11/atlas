---
title: Styles and isolation
description: Understand how Atlas keeps app styles away from the host and other apps, what each isolation mode does, and where app assets must live.
---

# Styles and isolation

Several teams' CSS and DOM share one page in an Atlas [host](hosts.md). This page
explains the rules that apply to every framework: who owns which styles, how
Atlas isolates each [app](apps.md), and how app assets are resolved. For build
setup, read [React assets and styles](../guides/react/assets-and-styles.md) or
[Angular assets and styles](../guides/angular/assets-and-styles.md).

## Who owns which styles

- The **host** owns the page layout: the areas around its
  [host anchors](host-anchors.md), global typography, and any design tokens it
  offers to apps.
- Each **app** owns the styles of the UI it renders inside its route outlet or
  slot.

An app never styles the host, and the host does not style the inside of an app.
When apps need shared visual values, the host exposes them on purpose, for
example as CSS custom properties.

## Isolation modes

Each app chooses how Atlas separates its DOM and styles from the rest of the page
with `domIsolation` in `atlas.config.ts`:

| `domIsolation`         | DOM                                                                                    | App styles                                                               |
| ---------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `shadow-dom` (default) | Atlas creates a wrapper element with an open shadow root and mounts the app inside it. | Loaded inside the shadow root. They cannot reach the host or other apps. |
| `shared-dom`           | Atlas creates a plain wrapper element and mounts the app inside it.                    | Loaded into the document `<head>`. They are global.                      |

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

Keep the default unless the app deliberately takes part in a host design-system
contract that relies on global CSS. With `shared-dom`, app selectors can restyle
the host and other apps, and host selectors can restyle the app.

[Exported widgets](../guides/exported-widgets.md) use the isolation mode of the
app that owns them.

## How Atlas loads app styles

The published artifact manifest lists each app's stylesheets. Before Atlas mounts
an app, it adds a `<link rel="stylesheet">` for each one to the app's style
target: the shadow root for `shadow-dom`, or the document `<head>` for
`shared-dom`. Atlas waits until the stylesheets load, and it removes them when
the last app that uses them unmounts.

For `shadow-dom` apps, Atlas also adapts each stylesheet to the shadow root:

- Atlas rewrites `:root` selectors to `:host`, so CSS custom properties that an
  app declares on `:root` still apply inside its shadow root.
- Atlas requests the stylesheets and their `@import` rules with CORS. The server
  that hosts app files must send CORS headers for CSS as well as JavaScript.

When a manifest declares a stylesheet `integrity` hash, the browser checks it
before it applies the file.

## Limits of shadow DOM isolation

A shadow root isolates selectors, but some things still cross it:

- Inherited CSS properties, such as `font-family` and `color`, flow from the host
  into the app.
- CSS custom properties defined by the host flow into the app. This is the
  intended way to share design tokens.
- `@font-face` rules only take effect when the document declares them. Load
  shared fonts in the host.
- UI that a library renders into `document.body`, such as overlays, portals, and
  toasts, is outside the app's shadow root and does not receive the app's styles.
  Render such UI inside the app, or have the host provide it through the SDK.

## Assets

Atlas loads every app version from its own immutable path in the artifact
registry, not from the host origin. Asset URLs must therefore resolve relative to
the app's build output:

- Import assets through your bundler, or use relative URLs.
- Do not hard-code absolute paths such as `/assets/logo.svg`. In production they
  resolve against the host origin, where the file does not exist.
- For URLs you build at run time, use the SDK asset helpers (`assetUrl()` and
  `assetBaseUrl()`), which resolve against the mounted app's own artifact.

The framework guides show the exact setup.

## Isolation and shared dependencies

DOM isolation does not change how Native Federation shares dependencies. Shared
packages still load once through the host's import map and follow their
singleton and version rules. Only the place where styles attach changes.

## Next steps

- [React assets and styles](../guides/react/assets-and-styles.md)
- [Angular assets and styles](../guides/angular/assets-and-styles.md)
- [Host anchors](host-anchors.md)
