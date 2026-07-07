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
  return `import { createElement } from "react";\n${root}\nimport { createMemoryRouter, RouterProvider } from "react-router-dom";\nimport { createRouterOptions, createRoutedMicrofrontend } from "@atlas/sdk/react";\nimport { routes } from "./app/routes";\n\nif (import.meta.hot) await import("@vitejs/plugin-react/preamble");\n\nexport default createRoutedMicrofrontend({\n  createRoot,\n  createRouter: ({ context }) => createMemoryRouter(routes, createRouterOptions(context)),\n  createElement: (router) => createElement(RouterProvider, { router })\n});\n`;
}

export function reactMicrofrontendLayout(name: string): string {
  return `import { Link, Outlet } from "react-router-dom";
import { useAtlasSdk } from "@atlas/sdk/react";
import "../../../styles.css";

export function StarterLayout() {
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
  return `export function StarterHome() {
  return <p>${title(name)} home</p>;
}
`;
}

export function reactMicrofrontendDetails(): string {
  return `export function StarterDetails() {
  return <p>Routed details page</p>;
}
`;
}

export function reactMicrofrontendRoutes(): string {
  return `import type { RouteObject } from "react-router-dom";
import { StarterDetails } from "./starter/details/details";
import { StarterHome } from "./starter/home/home";
import { StarterLayout } from "./starter/layout/layout";

export const routes: RouteObject[] = [
  {
    path: "/",
    Component: StarterLayout,
    children: [
      { index: true, Component: StarterHome },
      { path: "details/:id", Component: StarterDetails }
    ]
  }
];
`;
}

export function appSourceReadme(entryFile: string, bundlerFile: string): string {
  return `# App source

Required Atlas wiring lives in \`${entryFile}\`, \`atlas.config.ts\`, and \`${bundlerFile}\`. Keep those files aligned with Atlas docs when changing platform wiring.

Replaceable starter UI lives in \`src/app/starter\`. Delete or replace those folders when adding product screens.

\`src/app/routes.tsx\` connects starter screens to the router. Update it when replacing starter UI.
`;
}
