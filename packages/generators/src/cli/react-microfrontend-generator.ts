import { title } from "./common-generator.js";
import type { ReactVersionProfile } from "./generator-versions.js";

export function reactMicrofrontendEntry(name: string, profile: ReactVersionProfile): string {
  const root = profile.major === 17
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
  return `import { createElement } from "react";\n${root}\nimport { createMemoryRouter, RouterProvider } from "react-router-dom";\nimport { createRouterOptions, createRoutedMicrofrontend } from "@atlas/sdk/react";\nimport { routes } from "./app/routes";\n\nexport default createRoutedMicrofrontend({\n  createRoot,\n  createRouter: ({ context }) => createMemoryRouter(routes, createRouterOptions(context)),\n  createElement: (router) => createElement(RouterProvider, { router })\n});\n`;
}

export function reactMicrofrontendMain(profile: ReactVersionProfile): string {
  const root = profile.major === 17
    ? `import { render } from "react-dom";

function mountApp(root: Element) {
  render(app, root);
}`
    : `import { createRoot } from "react-dom/client";

function mountApp(root: Element) {
  const reactRoot = createRoot(root);
  reactRoot.render(app);
}`;

  return `import { StrictMode } from "react";
${root}
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { createAtlasSdk } from "@atlas/sdk/host";
import { createBrowserNavigation } from "@atlas/sdk/navigation";
import { AtlasSdkProvider } from "@atlas/sdk/react";
import { routes } from "./app/routes";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Atlas React microfrontend root was not found.");
const navigation = createBrowserNavigation();
const sdk = createAtlasSdk({
  hostId: "local-dev",
  hostData: { hostId: "local-dev", name: "Local Dev" },
  navigation,
  showToast: (toast) => console.info("[Atlas toast]", toast.title)
});
const router = createBrowserRouter(routes);
const app = (
  <StrictMode>
    <AtlasSdkProvider sdk={sdk}>
      <RouterProvider router={router} />
    </AtlasSdkProvider>
  </StrictMode>
);

mountApp(root);
`;
}

export function reactMicrofrontendApp(name: string): string {
  return `import { Link, Outlet } from "react-router-dom";
import { useAtlasSdk } from "@atlas/sdk/react";
import "../styles.css";

export function App() {
  const atlas = useAtlasSdk();

  return (
    <section>
      <h1>${title(name)}</h1>
      <button type="button" onClick={() => atlas.toast.open({ title: "${title(name)} is ready" })}>
        Show toast
      </button>
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

export function reactMicrofrontendHome(name: string): string {
  return `export function Home() {
  return <p>${title(name)} home</p>;
}
`;
}

export function reactMicrofrontendDetails(): string {
  return `export function Details() {
  return <p>Routed details page</p>;
}
`;
}

export function reactMicrofrontendRoutes(): string {
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

export function appSourceReadme(entryFile: string, bundlerFile: string): string {
  return `# App source

Required Atlas wiring lives in \`${entryFile}\`, \`atlas.config.ts\`, and \`${bundlerFile}\`. Keep those files aligned with Atlas docs when changing platform wiring.

Main app component lives in \`src/app/App.tsx\`. Add routed screens under feature folders in \`src/app\`.

\`src/app/routes.tsx\` connects app screens to the router. Update it when adding routes.
`;
}
