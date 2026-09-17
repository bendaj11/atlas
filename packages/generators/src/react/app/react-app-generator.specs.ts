import { aReactVersionProfile } from '../../testkit/version-profiles.testkit.js';
import { ReactAppGeneratorDriver } from './react-app-generator.driver.js';

const LEGACY_ROOT_SHIM = `import type { ReactNode } from "react";
import { render, unmountComponentAtNode } from "react-dom";

function createRoot(container: Element) {
  return {
    render(element: ReactNode) {
      render(element, container);
    },
    unmount() {
      unmountComponentAtNode(container);
    }
  };
}`;
const MODERN_ROOT_IMPORT = 'import { createRoot } from "react-dom/client";';

describe('renderReactAppBootstrap', () => {
  let driver: ReactAppGeneratorDriver;

  beforeEach(() => {
    driver = new ReactAppGeneratorDriver();
  });

  it('should create a routed app over a memory router when routed and major is 18 or above', () => {
    driver.given
      .routed(true)
      .given.profile(aReactVersionProfile({ major: 19 }))
      .when.bootstrapGenerated();

    expect(driver.get.contents()).toBe(`import { createElement } from "react";
${MODERN_ROOT_IMPORT}
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { createRouterOptions, createRoutedApp } from "@atlas/sdk/react";
import { routes } from "./routes";
import "./index.css";

export default createRoutedApp({
  createRoot,
  createRouter: ({ context }) => createMemoryRouter(routes, createRouterOptions(context)),
  createElement: (router) => createElement(RouterProvider, { router })
});
`);
  });

  it('should define a single-page app rendering the titled app when single-page and major is 18 or above', () => {
    driver.given
      .name('orders-app')
      .given.routed(false)
      .given.profile(aReactVersionProfile({ major: 18 }))
      .when.bootstrapGenerated();

    expect(driver.get.contents()).toBe(`import { createElement } from "react";
${MODERN_ROOT_IMPORT}
import { defineApp } from "@atlas/sdk/react";
import { App } from "./App";
import "./index.css";

export default defineApp({
  createRoot,
  createElement: () => createElement(App, { name: "Orders App" })
});
`);
  });

  it.each([16, 17])(
    'should shim createRoot over legacy react-dom when major is %s',
    (major) => {
      driver.given
        .profile(aReactVersionProfile({ major }))
        .when.bootstrapGenerated();

      expect(driver.get.contents()).toContain(LEGACY_ROOT_SHIM);
    },
  );

  it.each([18, 19])(
    'should import createRoot from react-dom client when major is %s',
    (major) => {
      driver.given
        .profile(aReactVersionProfile({ major }))
        .when.bootstrapGenerated();

      expect(driver.get.contents()).toContain(MODERN_ROOT_IMPORT);
    },
  );
});

describe('renderReactAppComponent', () => {
  let driver: ReactAppGeneratorDriver;

  beforeEach(() => {
    driver = new ReactAppGeneratorDriver();
  });

  it('should render navigation links and an outlet when routed', () => {
    driver.given
      .name('orders-app')
      .given.routed(true)
      .when.componentGenerated();

    expect(driver.get.contents())
      .toBe(`import { Link, Outlet } from "react-router-dom";
export function App() {
  return (
    <section>
      <h1>Orders App</h1>
      <nav>
        <Link to="/">Home</Link>
        <Link to="details/42">Details</Link>
      </nav>
      <Outlet />
    </section>
  );
}
`);
  });

  it('should render a titled single-page section when single-page', () => {
    driver.given
      .name('orders-app')
      .given.routed(false)
      .when.componentGenerated();

    expect(driver.get.contents()).toBe(`interface AppProps {
  name?: string;
}

export function App({ name = "Orders App" }: AppProps) {
  return (
    <section>
      <h1>{name}</h1>
      <p>Single-page Atlas app</p>
    </section>
  );
}
`);
  });
});

describe('renderReactAppHome', () => {
  let driver: ReactAppGeneratorDriver;

  beforeEach(() => {
    driver = new ReactAppGeneratorDriver();
  });

  it('should render the titled home paragraph when generated', () => {
    driver.given.name('orders-app').when.homeGenerated();

    expect(driver.get.contents()).toBe(`export function Home() {
  return <p>Orders App home</p>;
}
`);
  });
});

describe('renderReactAppDetails', () => {
  let driver: ReactAppGeneratorDriver;

  beforeEach(() => {
    driver = new ReactAppGeneratorDriver();
  });

  it('should render the details paragraph when generated', () => {
    driver.when.detailsGenerated();

    expect(driver.get.contents()).toBe(`export function Details() {
  return <p>Routed details page</p>;
}
`);
  });
});

describe('renderReactAppRoutes', () => {
  let driver: ReactAppGeneratorDriver;

  beforeEach(() => {
    driver = new ReactAppGeneratorDriver();
  });

  it('should nest home and details under the app route when generated', () => {
    driver.when.routesGenerated();

    expect(driver.get.contents())
      .toContain(`export const routes: RouteObject[] = [
  {
    path: "/",
    Component: App,
    children: [
      { index: true, Component: Home },
      { path: "details/:id", Component: Details }
    ]
  }
];`);
  });
});
