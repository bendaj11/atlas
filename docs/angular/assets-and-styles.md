# Angular Assets And Styles

Angular apps are deployed under immutable Atlas version paths, so asset URLs must
work after the app is loaded by a host from a CDN.

## App Domain

Use Angular's normal asset and style configuration:

- put static files under `public`;
- keep global styles in the Angular `styles` configuration;
- prefer component styles for feature UI;
- reference copied static assets from component CSS with root-relative `/assets/...`
  URLs. Atlas rewrites Angular-owned component styles to the app's immutable
  artifact directory before Angular inserts them into the host document.

Do not change these references to `./assets/...` merely to make them relative.
Angular resolves that form as a CSS source import and fails the build when no
matching path exists beside the component stylesheet.

Good:

```css
.orders-hero {
  background-image: url('/assets/orders-hero.png');
}
```

For global stylesheets emitted as standalone CSS, configure Angular's deploy URL
to the published artifact base. Those files load outside the component-style
ownership boundary and keep normal browser URL resolution.

Wrong when `assets` is not beside the component stylesheet:

```css
.orders-hero {
  background-image: url('./assets/orders-hero.png');
}
```

### Assets in HTML, CSS, and runtime code

Use the asset path configured by the Angular build. In a template, use the
root-relative path for copied assets:

```html
<img src="/assets/images/point.png" alt="Point" />
```

In component CSS, use that same root-relative path. Atlas sees the HTML and
component CSS it inserts for a mounted app, then rewrites those asset URLs to
the app's immutable artifact directory.

Runtime code is different. A library receives only a string and fetches it
itself; Atlas cannot see or rewrite that request. Resolve the asset against the
module that uses it:

```ts
const pointImageUrl = new URL('images/point.png', import.meta.url).href;
```

Use an emitted path relative to the module URL, without a leading `/`. For
example, files copied from `src/assets` normally use `assets/images/point.png`.
This keeps the URL under the app's immutable deployment path.
Do not use `document.baseURI` or `location.origin`: they point at the host page
or discard the app path.

## Isolation

Atlas mounts apps in Shadow DOM by default and installs declared standalone
stylesheets in that shadow root. This prevents global library CSS, including
Ionic resets and variables, from leaking into the host or other apps. Use
`domIsolation: 'shared-dom'` only for an app intentionally sharing a documented
host design-system contract. Shared DOM mode is a DOM wrapper, not CSS
isolation.

## Host Domain

The host owns global layout styles, design-system CSS, fonts, and CSS variables
that are intentionally shared with apps. Apps should not reset `body`, change
host navigation layout, or depend on host-only class names unless that contract
is documented by the host team.

## Deployment Domain

Angular build owns browser output. `atlas:publish` reads that output, publishes
it beneath derived immutable version/build path, then replaces mutable catalogs
under storage lease.

Your CDN must:

- serve JavaScript as module-compatible JavaScript MIME types;
- serve `remoteEntry.json` as `application/json`;
- enable CORS for every host origin;
- keep app chunks and assets under the same immutable prefix;
- avoid rewriting missing asset paths to the host `index.html`.

## Monorepos

In Nx or Angular CLI workspaces, keep assets in the project that owns the app.
Atlas follows the framework build output; it does not invent a second asset
pipeline.
