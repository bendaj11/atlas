# Assets And Styles

Asset setup is framework-specific because Angular and React build assets
differently. Pick the page for the framework you are using:

- [Angular assets and styles](angular/assets-and-styles.md)
- [React assets and styles](react/assets-and-styles.md)

Shared rule: apps are loaded from immutable Atlas version paths. App assets
should be relative to the app build output, not hardcoded to the host origin.

Host styles own the product shell. App styles own feature UI inside the route or
slot where the app is mounted.
