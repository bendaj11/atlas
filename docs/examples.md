# Examples

Examples are organized by framework:

- [Angular examples](guides/angular/examples.md)
- [React examples](guides/react/examples.md)

Both frameworks are also exercised together in the repository's cross-framework
browser tests:

- Angular app in Angular host
- Angular app in React host
- React app in React host
- React app in Angular host
- Angular exported widget consumed by React
- React exported widget consumed by Angular

Cross-framework behavior uses Atlas DOM mount/unmount lifecycles and widget
contracts. Apps do not import another app's framework runtime.
