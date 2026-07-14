# Angular getting started

Complete the canonical [Getting started](../getting-started.md) first. This page explains the Angular files you will edit.

## Generate

```sh
atlas g host customer-host --framework=angular
atlas g app orders --framework=angular --host=customer-host
```

The host has two distinct entry points:

- `src/main.ts` is a convenient framework development entry;
- `src/host.ts` exports the versioned `mount` lifecycle used by the stable loader.

`src/bootstrap.ts` creates the Angular product shell and Atlas runtime services. `src/app/app.component.ts` owns navigation, slots, status, and the route outlet. Product teams may customize these. Do not make the host client fetch a catalog; it receives one in its mount request.

The app exports its lifecycle from `src/entry.ts`. Feature routes live under `src/app/routes.ts`. Apps receive host services with `injectAtlasSdk()`.

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

Expected: host Native Federation output exposes `./host`, app output exposes `./entry`, and publication paths use `hosts/` and `apps/` respectively.

The generated `Containerfile` runs `atlas-host-server`. It does not contain Angular browser output. Read [Angular host details](host-getting-started.md), [routing](routing.md), [SDK](sdk.md), [assets](assets-and-styles.md), and [production deployment](production-deployment.md) next.
