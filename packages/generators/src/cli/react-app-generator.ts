import { title } from './common-generator.js';
import type { ReactVersionProfile } from './generator-versions.js';

export function reactAppBootstrap(profile: ReactVersionProfile): string {
  const root =
    profile.major === 17
      ? `import type { ReactNode } from "react";
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
}`
      : 'import { createRoot } from "react-dom/client";';
  return `import { createElement } from "react";\n${root}\nimport { createMemoryRouter, RouterProvider } from "react-router-dom";\nimport { createRouterOptions, createRoutedApp } from "@atlas/sdk/react";\nimport { routes } from "./routes";\nimport "./index.css";\n\nexport default createRoutedApp({\n  createRoot,\n  createRouter: ({ context }) => createMemoryRouter(routes, createRouterOptions(context)),\n  createElement: (router) => createElement(RouterProvider, { router })\n});\n`;
}

export function reactSinglePageAppBootstrap(
  name: string,
  profile: ReactVersionProfile,
): string {
  const root =
    profile.major === 17
      ? `import type { ReactNode } from "react";
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
}`
      : 'import { createRoot } from "react-dom/client";';
  return `import { createElement } from "react";\n${root}\nimport { defineApp } from "@atlas/sdk/react";\nimport { App } from "./App";\nimport "./index.css";\n\nexport default defineApp({\n  createRoot,\n  createElement: () => createElement(App, { name: "${title(name)}" })\n});\n`;
}

export function reactAppApp(name: string): string {
  return `import { Link, Outlet } from "react-router-dom";
export function App() {
  return (
    <section>
      <h1>${title(name)}</h1>
      <nav>
        <Link to="/">Home</Link>
        <Link to="details/42">Details</Link>
      </nav>
      <Outlet />
    </section>
  );
}
`;
}

export function reactSinglePageApp(name: string): string {
  return `interface AppProps {
  name?: string;
}

export function App({ name = "${title(name)}" }: AppProps) {
  return (
    <section>
      <h1>{name}</h1>
      <p>Single-page Atlas app</p>
    </section>
  );
}
`;
}

export function reactAppHome(name: string): string {
  return `export function Home() {
  return <p>${title(name)} home</p>;
}
`;
}

export function reactAppDetails(): string {
  return `export function Details() {
  return <p>Routed details page</p>;
}
`;
}

export function reactAppRoutes(): string {
  return `import type { RouteObject } from "react-router-dom";
import { App } from "./App";
import { Details } from "./details/Details";
import { Home } from "./home/Home";

export const routes: RouteObject[] = [
  {
    path: "/",
    Component: App,
    children: [
      { index: true, Component: Home },
      { path: "details/:id", Component: Details }
    ]
  }
];
`;
}
