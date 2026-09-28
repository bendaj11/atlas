# @atlas/generators

The Host, App, and exported widget templates behind `npx atlas generate`. It is an internal building block of `@atlas/cli`.

## Install

Do not install this package directly. Install `@atlas/cli`, which depends on it (see [Get the packages](https://github.com/bendaj11/atlas/blob/main/docs/reference/compatibility.md#get-the-packages)), and run the generators through the CLI:

```sh
npx atlas g host shop-host --framework angular
npx atlas g app orders --framework angular
npx atlas g widget order-summary --app-id 3ae54928-c2c6-491d-b766-6996ce0ef3c8
```

Replace the UUID with the `id` from the owning App's `atlas.config.ts`.

## Documentation

- [CLI reference: generate](https://github.com/bendaj11/atlas/blob/main/docs/reference/cli.md#generate)
- [React generators](https://github.com/bendaj11/atlas/blob/main/docs/guides/react/generators.md)
- [Angular generators](https://github.com/bendaj11/atlas/blob/main/docs/guides/angular/generators.md)
