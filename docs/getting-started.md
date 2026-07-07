# Getting Started

Start with one framework. Learn the host, learn one MF, run it locally, then
publish it.

Choose the guide that matches your first application:

- [Getting Started With Angular](getting-started-angular.md): build an Angular host and Angular MF from install to production.
- [Getting Started With React](getting-started-react.md): build a React host and React MF from install to production.

Both guides follow the same path:

1. Install the Atlas CLI.
2. Generate a host.
3. Connect host services.
4. Generate an MF.
5. Place the MF on a host route.
6. Run the MF inside the host.
7. Build publication files.
8. Verify production.

Atlas can also mix frameworks: an Angular host can load React MFs, and a React
host can load Angular MFs. Learn one same-framework path first, then read the
advanced guides when you need cross-framework composition.

More docs:

- [Core concepts](overview.md): explains the host, MF, catalog, and runtime words used in every guide.
- [Architecture](architecture.md): shows how hosts, MFs, catalogs, SDK calls, and Native Federation fit together.
- [Generators](generators.md): lists CLI options when the default generated files are not enough.
- [Workspaces and monorepos](workspaces.md): helps place Atlas projects inside Nx, Turborepo, pnpm, Yarn, or npm workspaces.
- [Production deployment](production-deployment.md): explains how to upload built files, update catalogs, verify, and roll back.
