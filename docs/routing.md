# Routing And Navigation

Atlas routing is framework-specific at the app boundary. Pick the page for the
framework you are using:

- [Angular routing](angular/routing.md)
- [React routing](react/routing.md)

Shared rule: **the host owns the browser URL**. Apps may have inner routes, but
only under the base path assigned by the host catalog.

For low-level framework-independent code, every mounted app receives scoped
navigation:

```ts
context.navigation.navigate("details/42");
context.navigation.replace("settings");
context.navigation.back();
context.navigation.createHref("details/42");
context.navigation.subscribe((location) => console.log(location));
context.navigation.getCurrentLocation();
context.route.setTabTitle("Order 42");
```

The scoped navigation object turns `details/42` into the correct host URL for
the app's assigned base path.
