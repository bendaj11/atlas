# Routing And Navigation

Atlas routing is framework-specific at the app boundary. Pick the page for the
framework you are using:

- [Angular routing](angular/routing.md)
- [React routing](react/routing.md)

Shared rule: **the host owns the browser URL**. Apps may have inner routes, but
only under the `route` assigned by the host catalog. `route` may change; an
app's `id` is its stable cross-app identity.

For low-level framework-independent code, every mounted app receives scoped
navigation:

```ts
context.navigation.navigate("details/42");
context.navigation.replace("settings");
context.route.setTabTitle("Order 42");
```

For app-internal navigation, use framework router APIs. They preserve native
routing state. Do not use an app route as an app identifier.

For cross-app navigation, use stable app id. Atlas resolves destination's
current `route` from host catalog and sends state as search parameters:

```ts
atlas.navigateTo("2bea9c13-4899-4f93-9211-cd8c55e9c529", {
  orderId: "42",
  tab: "history"
});
```

Destination reads `orderId` and `tab` with its framework query API, or with
`context.route.getCurrent().query` in low-level code. State values may be
strings, numbers, booleans, `null`, or `undefined`; do not pass secrets.
