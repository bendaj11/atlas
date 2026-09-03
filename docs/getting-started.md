# Get Started With Atlas

Install Atlas and create a Host and an App. Then read the Host or App guide for
your work. This page does not cover local development or deployment.

## Before You Start

Atlas supports Node.js 22.12 or newer within Node.js 22, or Node.js 24
(`^22.12.0 || ^24.0.0`). Run commands from the workspace root.

## 1. Install Atlas

```sh
npm install --save-dev @atlas/cli
```

**Expected result:** `npx atlas --help` lists Atlas commands.

> [!tip]
> Install Atlas in workspace containing host and app. Atlas uses workspace tool
> for framework builds and project selection.

## 2. Generate a Host

A Host is the main application page that users open. It provides layout, top-level
navigation, and shared services such as authentication.

```sh
npx atlas g host customer-host --framework=angular
```

```sh
npx atlas g host customer-host --framework=react
```

**Expected result:** Atlas creates `customer-host/` with `atlas.config.ts`.
Keep generated `id` stable; apps use it for routes and slots.

## 3. Generate an App

An App is a feature shown inside a Host. Copy the Host ID from
`customer-host/atlas.config.ts`, then choose framework:

```sh
npx atlas g app orders --framework=angular --host-id=<customer-host-id>
```

```sh
npx atlas g app orders --framework=react --host-id=<customer-host-id>
```

**Expected result:** Atlas creates `orders/` with `atlas.config.ts` and initial
route for supplied host ID.

> [!note]
> `--host-id` is optional. Omit it when app will declare routes or slots later.

Read [Atlas Host](host.md) when building the main application page, navigation, or
shared services. Read [Atlas App](app.md) when building a feature.

Use [Generate a Host](host/generate.md) or [Generate an App](app/generate.md)
for every generator option, generated-file detail, troubleshooting.
