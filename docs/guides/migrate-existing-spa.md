---
title: Migrate an existing single-page app
description: Adopt Atlas in an existing Angular or React single-page app one feature at a time, keeping the product working at every step.
---

# Migrate an existing single-page app

This guide shows how to move an existing Angular or React single-page app to Atlas incrementally. You wrap the whole app as one Atlas App, then move features into their own Apps one at a time. It is for tech leads planning an adoption. You should know the [Tutorial](../get-started/tutorial.md) and the [Routing](../concepts/routing.md) concepts.

Atlas has no automated migration tool. The approach below relies on how Atlas matches routes, so every step is a normal Atlas release that you can roll back.

## How the approach works

The Atlas loader starts a Host, and the runtime inside the Host mounts Apps into route outlets and slots. Atlas does not document a way to mount Apps in a page that the loader did not start, so adoption starts with the Host.

Two routing rules make incremental migration possible:

- A route with the default `match: 'prefix'` also matches every URL below its path. A route at `/` therefore matches every URL.
- When several routes match, Atlas picks the one whose `path` string is longest. A new App at `/orders` wins over the wrapped App at `/` for `/orders` and everything below it, and the wrapped App keeps every other URL.

## Before you begin

- Install the Atlas CLI in your workspace. See [Get the packages](../reference/compatibility.md#get-the-packages).
- Align the versions of shared packages, such as Angular or React, between the existing app and the new Host. An App reuses the Host's copy of a shared package only when both use exactly the same version. See [Shared dependencies](../deploy/governance.md#shared-dependencies).

## 1. Build the Host from your current layout

1. Generate a Host with the framework of your existing app:

   ```sh
   npx atlas g host customer-host --framework react
   ```

2. Move the parts of your app that every page shares into the Host: the header, the navigation, sign-in, and any product-wide services. Put a route outlet where the page content goes; see [Host anchors](../concepts/host-anchors.md).
3. Give Apps what they need from the Host, such as the signed-in user, through [host data](host-data.md) or a Host-defined SDK extension.

> **Expected result:** `npx atlas dev customer-host` shows your layout with an empty content area.

## 2. Wrap the existing app as one App at `/`

1. Generate an App for the Host. Replace the UUID with your Host ID from the Host's `atlas.config.ts`:

   ```sh
   npx atlas g app legacy --framework react --host-id 0a17281f-287b-4d89-a8ca-0ab0e577c506 --routing true
   ```

2. Move the existing app's feature code and routes into the generated App. Keep its framework router; Atlas scopes the router to the App's route path, which is `/` here, so your existing inner paths stay the same. See [React routing](react/routing.md) or [Angular routing](angular/routing.md) for the router setup.
3. In the App's `atlas.config.ts`, change the generated route to `/` and hide it from the Host navigation, because the Host layout already renders your menu:

   ```ts
   routes: [
     {
       hostId: '0a17281f-287b-4d89-a8ca-0ab0e577c506',
       path: '/',
       nav: { label: 'Home', visible: false },
     },
   ],
   ```

   Without `nav.visible: false`, the navigation anchor shows a link for the route.

4. If the existing app relies on global CSS that must reach the whole page, set `domIsolation: 'shared-dom'` in the App's `atlas.config.ts`. Otherwise keep the default Shadow DOM isolation. See [Styles and isolation](../concepts/styles-and-isolation.md).

> **Expected result:** With both projects running under `npx atlas dev`, every URL of your product shows the existing screens inside the Host.

## 3. Release the Host and the wrapped App

Publish both projects and deploy them to staging, then to production, as described in [Production deployment](../deploy/production-deployment.md). Confirm that behavior is unchanged before you move any feature.

> **Expected result:** Users see the same product, now served by an Atlas Host.

## 4. Move one feature at a time

1. Generate a new App for the feature, for example `orders`, with a route such as `/orders`.
2. Move the feature's screens into the new App. Keep its inner routes relative to `/orders`.
3. In other Apps, including the wrapped App, open the feature with `sdk.navigateTo()` and the new App's `id` instead of a hard-coded path. See [Navigate to another App](../concepts/routing.md#navigate-to-another-app).
4. Publish and deploy the new App. Because `/orders` is longer than `/`, the new App takes over `/orders` and every URL below it.

> **Expected result:** `/orders` shows the new App, and every other URL still shows the wrapped App.

If the new App misbehaves, deploy the previous state again; the wrapped App still contains the feature. See [How publish, deploy, and rollback work](../introduction/architecture.md#how-publish-deploy-and-rollback-work).

## 5. Remove moved code from the wrapped App

After the new App is stable in production, delete the feature's code and routes from the wrapped App and release it. Repeat step 4 for the next feature. When the wrapped App no longer owns any screens, remove its route.

## Related

- [Routing](../concepts/routing.md)
- [Governance](../deploy/governance.md)
- [Workspaces and CI](workspaces-and-ci.md)
- [Production deployment](../deploy/production-deployment.md)
