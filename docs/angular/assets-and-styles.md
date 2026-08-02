# Angular Assets And Styles

Angular apps are deployed under immutable Atlas version paths, so asset URLs must
work after the app is loaded by a host from a CDN.

## App Domain

Use Angular's normal asset and style configuration:

- put static files under `public`;
- keep global styles in the Angular `styles` configuration;
- prefer component styles for feature UI;
- reference copied static assets from component CSS with root-relative `/assets/...`
  URLs. Atlas rewrites Angular-owned component styles to the app's remote origin
  before Angular inserts them into the host document.

Do not change these references to `./assets/...` merely to make them relative.
Angular resolves that form as a CSS source import and fails the build when no
matching path exists beside the component stylesheet.

Good:

```css
.orders-hero {
  background-image: url("/assets/orders-hero.png");
}
```

For global stylesheets emitted as standalone CSS, configure Angular's deploy URL
to the published artifact base. Those files load outside the component-style
ownership boundary and keep normal browser URL resolution.

Wrong when `assets` is not beside the component stylesheet:

```css
.orders-hero {
  background-image: url("./assets/orders-hero.png");
}
```

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
