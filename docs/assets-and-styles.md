# Assets And Styles

Asset setup is framework-specific because Angular and React build assets
differently. Pick the page for the framework you are using:

- [Angular assets and styles](angular/assets-and-styles.md)
- [React assets and styles](react/assets-and-styles.md)

Shared rule: apps are loaded from immutable Atlas version paths. App assets
should be relative to the app build output, not hardcoded to the host origin.

Host styles own the product shell. App styles own feature UI inside the route or
slot where the app is mounted.

Apps mount in an open Shadow DOM boundary by default. Atlas installs each
declared app stylesheet inside that boundary, so selectors and CSS variables
from one app cannot restyle the host or another app. Set `domIsolation:
'shared-dom'` only when an app intentionally participates in a documented host
design-system contract. It adds a DOM wrapper but leaves CSS global. `scoped`
remains a legacy alias.

Native Federation dependency sharing is independent of DOM isolation. Shared
runtime packages still use the host's import map and singleton/version rules;
only style attachment changes.
