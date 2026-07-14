# React Assets And Styles

React apps are deployed under immutable Atlas version paths, so asset URLs must
work after the app is loaded by a host from a CDN.

## App Domain

Generated React apps use Vite with a relative base. Keep app assets in source
folders or `public` according to normal Vite rules, and prefer relative imports
from components and CSS.

Good:

```tsx
import heroUrl from "./assets/orders-hero.png";

export function OrdersHero() {
  return <img src={heroUrl} alt="Orders" />;
}
```

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

Absolute `/assets/...` resolves against the host origin, not the app's
immutable CDN directory.

## Host Domain

The host owns global layout styles, design-system CSS, fonts, and CSS variables
that are intentionally shared with apps. Apps should not reset `body`, change
host navigation layout, or depend on host-only class names unless that contract
is documented by the host team.

## Deployment Domain

`atlas build` places Vite output and generated manifest in local publication
tree under
selected immutable app version. CI uploads all immutable files before it
replaces mutable catalogs.

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
