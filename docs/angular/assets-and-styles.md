# Angular Assets And Styles

Angular apps are deployed under immutable Atlas version paths, so asset URLs must
work after the app is loaded by a host from a CDN.

## App Domain

Use Angular's normal asset and style configuration:

- put static files under `src/assets`;
- keep global styles in the Angular `styles` configuration;
- prefer component styles for feature UI;
- reference assets with relative URLs from CSS or Angular-managed imports.

Avoid absolute `/assets/...` paths inside mounted apps. The browser would
resolve them against the host origin, not the app's immutable CDN directory.

Good:

```css
.orders-hero {
  background-image: url("./assets/orders-hero.png");
}
```

Risky in an app:

```css
.orders-hero {
  background-image: url("/assets/orders-hero.png");
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
