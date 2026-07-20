import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { defineApp, useAtlasSdk } from "@atlas/sdk/react";
import type { AtlasAppMountRequest } from "@atlas/sdk/lifecycle";
import "./styles.css";

function App({ context }: AtlasAppMountRequest) {
  const atlas = useAtlasSdk();
  const ProductCount = atlas.getWidget<{ status: string }>("98abc74d-a11f-4eca-8255-c6f2f49e3d6e");
  return <section><h1>Dashboard React</h1><p>{atlas.hostData.name} mounted at {context.basePath}</p><ProductCount status="paid" /></section>;
}

export default defineApp({ createRoot, createElement: (request) => createElement(App, request) });
