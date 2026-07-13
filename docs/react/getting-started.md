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

`HostAtlasProvider.tsx` creates product routing and Atlas SDK services. `HostLayout.tsx` owns navigation, slots, status, and the route outlet. Product teams may customize these. Do not make the host client fetch a catalog; it receives one in its mount request.

The app exports `mount` from `src/entry.tsx`. Feature routes live under `src/app/routes.tsx`. Apps receive host services with `useAtlasSdk()`.

## Local checkpoint

```sh
atlas dev customer-host
atlas dev orders --host=customer-host --host-url=http://127.0.0.1:4300/orders
```

Expected: host preview loads on port 4300; Orders mounts at `/orders`; Columbus can switch host and app independently.

## Build checkpoint

```sh
ATLAS_REGISTRY_BASE_URL=https://cdn.example.com/atlas atlas build customer-host
ATLAS_REGISTRY_BASE_URL=https://cdn.example.com/atlas atlas build orders
```

Expected: host Vite output exposes `./host`, app output exposes `./entry`, and publication paths use `hosts/` and `apps/` respectively.

The generated `Containerfile` runs `atlas-host-server`. It does not contain React output. Read [React routing](routing.md), [React SDK](sdk.md), [assets](assets-and-styles.md), and [production deployment](production-deployment.md) next.
