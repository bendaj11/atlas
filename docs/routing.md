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
context.navigation.navigate('details/42');
context.navigation.replace('settings');
context.route.setTabTitle('Order 42');
```

For app-internal navigation, use framework router APIs. They preserve native
routing state. Do not use an app route as an app identifier.

For cross-app navigation, use stable app id. Atlas resolves destination's
current `route` from host catalog and sends state as search parameters:

```ts
atlas.navigateTo('2bea9c13-4899-4f93-9211-cd8c55e9c529', {
  orderId: '42',
  tab: 'history',
});
```

Destination reads `orderId` and `tab` with its framework query API, or with
`context.route.getCurrent().query` in low-level code. State values may be
strings, numbers, booleans, `null`, or `undefined`; do not pass secrets.

## App Routes And Host Layouts

Apps declare the URLs they own, including route matching, redirects, and the
host layout to activate. The host only renders layouts and anchors:

```ts
export default {
  type: 'app',
  id: 'orders-app',
  framework: 'react',
  routes: [
    { hostId: 'host-id', path: '/', match: 'full', redirectTo: '/dashboard' },
    { hostId: 'host-id', path: '/orders/:orderId', layoutId: 'workspace' },
    { hostId: 'host-id', path: '/orders', layoutId: 'workspace' },
  ],
} satisfies AtlasAppConfig;
```

Atlas selects the most-specific matching app route. `path` supports static
segments, `:params`, and a final `*` wildcard. Use
`match: 'full'` for an exact root redirect; other routes match path prefixes by
default. Redirect routes cannot set a layout.

Atlas uses the selected app route's `layoutId`, then `default`. Slot apps never
declare paths. They mount whenever the active host layout renders their slot
anchor.
