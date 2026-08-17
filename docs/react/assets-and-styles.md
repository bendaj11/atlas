# React Assets And Styles

React apps are deployed under immutable Atlas version paths, so asset URLs must
work after the app is loaded by a host from a CDN.

## App Domain

Generated React apps use Vite with a relative base. Keep app assets in source
folders or `public` according to normal Vite rules, and prefer relative imports
from components and CSS.

Good:

```tsx
import heroUrl from './assets/orders-hero.png';

export function OrdersHero() {
  return <img src={heroUrl} alt="Orders" />;
}
```

Good:

```css
.orders-hero {
  background-image: url('./assets/orders-hero.png');
}
```

Risky in an app:

```css
.orders-hero {
  background-image: url('/assets/orders-hero.png');
}
```

Absolute `/assets/...` resolves against the host origin, not the app's
immutable CDN directory.

### Assets in HTML, CSS, and runtime code

Import app-owned assets. Vite replaces the import with the correct emitted URL:

```tsx
import pointImageUrl from './assets/images/point.png';

export function PointImage() {
  return <img src={pointImageUrl} alt="Point" />;
}
```

In CSS, use a relative `url('./assets/images/point.png')`; Vite resolves it
during the build. Both forms work because Vite owns those source files.

Runtime code is different. A library receives a plain URL string and fetches it
itself, so it cannot rely on an Atlas DOM rewrite. Pass the imported URL to the
library. `new URL('./assets/images/point.png', import.meta.url).href` is an
equivalent alternative when an import is not suitable. Do not use
`document.baseURI` or `location.origin`: they point at the host page or discard
the app path.

## Isolation

Atlas mounts apps in Shadow DOM by default and installs declared standalone
stylesheets in that shadow root. This prevents global library CSS from leaking
into the host or other apps. Use `domIsolation: 'shared-dom'` only for an app
intentionally sharing a documented host design-system contract. Shared DOM mode
is a DOM wrapper, not CSS isolation.

## Host Domain

The host owns global layout styles, design-system CSS, fonts, and CSS variables
that are intentionally shared with apps. Apps should not reset `body`, change
host navigation layout, or depend on host-only class names unless that contract
is documented by the host team.

## Deployment Domain

Vite owns framework output. `atlas:publish` reads that output, publishes it
beneath derived immutable version/build path, then replaces mutable catalogs
under storage lease.

Your CDN must:

- serve JavaScript modules as JavaScript MIME types;
- serve `remoteEntry.json` as `application/json`;
- enable CORS for every host origin;
- keep app chunks and assets under the same immutable prefix;
- avoid rewriting missing asset paths to the host `index.html`.

## Monorepos

In Nx, Turborepo, pnpm, Yarn, or npm workspaces, keep assets in the package that
owns the app. Atlas follows the framework build output; it does not invent a
second asset pipeline.
