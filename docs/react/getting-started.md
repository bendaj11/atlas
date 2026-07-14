# React getting started

Complete the canonical [Getting started](../getting-started.md) first. This page explains the React files you will edit.

## Generate

```sh
atlas g host customer-host --framework=react
atlas g app orders --framework=react --host=customer-host
```

The host has two distinct entry points:

- `src/main.tsx` is a convenient framework-only development entry;
- `src/host.tsx` exports the versioned `mount` lifecycle used by the stable loader.

`CustomerHostAtlasProvider.tsx` creates product routing and Atlas SDK services.
Filename derives from project name. `HostLayout.tsx` owns navigation, slots,
status, and route outlet. Product teams may customize these. Do not make host
client fetch a catalog; it receives one in mount request.

The app exports `mount` from `src/entry.tsx`. Feature routes live under `src/app/routes.tsx`. Apps receive host services with `useAtlasSdk()`.

## Local checkpoint

```sh
atlas dev customer-host
atlas dev orders --host-url=http://127.0.0.1:4300/orders
```

Expected: host preview loads on port 4300; Orders mounts at `/orders`; Columbus can switch host and app independently.

## Build checkpoint

```sh
ATLAS_REGISTRY_BASE_URL=https://cdn.example.com/atlas atlas build customer-host
ATLAS_REGISTRY_BASE_URL=https://cdn.example.com/atlas atlas build orders
```

Expected: host Vite output exposes `./host`, app output exposes `./entry`, and publication paths use `hosts/` and `apps/` respectively.

Generated `Containerfile` runs `atlas-host-server`; it does not contain React
output. Continue with [React host](host-getting-started.md), [React app](app-getting-started.md),
[routing](routing.md), [SDK](sdk.md), and [production deployment](production-deployment.md).
