# Assets And Styles

Each microfrontend owns its images, fonts, and styles. Atlas publishes them in
the same immutable version directory as the MF JavaScript and makes the host
load the MF's emitted CSS before mounting it.

## The Main Rule

Use asset references that your framework's build tool can process. Do not use a
root-relative URL beginning with `/`.

```css
/* Correct: resolved and rewritten by the MF build. */
.hero {
  background-image: url("./assets/images/hero.png");
}

/* Incorrect: requests the host application's origin. */
.hero {
  background-image: url("/assets/images/hero.png");
}
```

The browser interprets `/assets/images/hero.png` relative to the host origin.
Atlas cannot safely reinterpret that URL because the host and each MF may come
from different CDN directories or origins.

## Angular

Generated Angular MFs include `src/assets` in their Angular build configuration.
Place an image at:

```text
src/assets/images/hero.png
```

Reference it relatively from `src/styles.css` or a component stylesheet:

```css
.hero {
  background-image: url("./assets/images/hero.png");
}
```

Keep global styles in the Angular `styles` configuration in `angular.json` or,
for an existing Nx application, its `project.json`. Component styles continue
to work through Angular's normal style encapsulation.

For images selected from TypeScript, prefer a build-time URL supported by the
project's Angular builder. Avoid literal `/assets/...` values in templates or
TypeScript because those target the host origin after the MF is mounted.

## React And Vite

Keep assets under `src` and either reference them from CSS or import them:

```tsx
import logoUrl from "./assets/images/logo.png";

export function Logo() {
  return <img src={logoUrl} alt="Atlas" />;
}
```

```css
.logo {
  background-image: url("./assets/images/logo.png");
}
```

Generated React MFs use a relative Vite base. Vite therefore emits hashed asset
URLs that remain relative to the MF's immutable CDN directory. Prefer imported
assets over Vite's `public` directory because public files are commonly
referenced with root-relative URLs.

## What Atlas Does During Build

`atlas build` runs the project's normal production build and then:

1. Copies the emitted JavaScript, CSS, images, and fonts into the immutable MF
   publication directory.
2. Discovers emitted CSS files.
3. Adds each stylesheet's CDN URL and SHA-256 integrity value to the MF
   manifest.
4. Includes those files in the provider-neutral publication plan.

Atlas operates on final build output. It does not need to understand whether a
source style was registered by Nx, Angular CLI, a Vite import, Turbo, or a Yarn
workspace.

## What The Host Does

Before mounting an MF, the Atlas runtime:

1. Creates a `<link rel="stylesheet">` for each stylesheet in its manifest.
2. Applies the manifest's integrity and CORS attributes.
3. Waits until every stylesheet loads.
4. Mounts the MF only after its CSS is ready.

Stylesheets are reference-counted. If a page MF and several exported widgets
use the same owner build, the host downloads and attaches its stylesheet once.
Atlas removes it only after the final related mount is destroyed. A stylesheet
load failure uses the same host-owned fallback UI as a JavaScript loading
failure.

## Monorepos

No Atlas-specific style registration is required:

- **Nx:** keep styles and assets in the project's `project.json` or delegated
  Angular configuration.
- **Turborepo:** keep the framework's normal build script in the package and
  task graph.
- **Yarn workspaces:** keep the framework's normal package build script.

Atlas invokes the workspace's existing production target and consumes its
output. The resulting MF manifest and host behavior are identical across these
workspace types.

## Deployment Requirements

- Upload assets before replacing mutable catalogs.
- Serve versioned MF files with immutable cache headers.
- Preserve the publication directory structure.
- Return the correct MIME type for CSS, images, and fonts.
- Configure CORS when the MF CDN and host use different origins.
- Do not rewrite missing asset requests to the host's `index.html`.

