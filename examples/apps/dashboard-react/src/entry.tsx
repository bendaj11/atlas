import { createElement, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { defineApp, useAtlasSdk } from "@atlas/sdk/react";
import type { AtlasAppMountRequest } from "@atlas/sdk/lifecycle";
import "./styles.css";

function App({ context }: AtlasAppMountRequest) {
  const atlas = useAtlasSdk();
  const widget = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false;
    let unmount: () => Promise<void> = async () => undefined;
    void atlas.getWidget("98abc74d-a11f-4eca-8255-c6f2f49e3d6e").then((resolved) =>
      resolved.mount(widget.current!, { status: "paid" })).then((mounted) => {
      if (disposed) return mounted.unmount();
      unmount = mounted.unmount;
    });
    return () => { disposed = true; void unmount(); };
  }, [atlas]);
  return <section><h1>Dashboard React</h1><p>{atlas.hostData.name} mounted at {context.basePath}</p><div ref={widget} /></section>;
}

export default defineApp({ createRoot, createElement: (request) => createElement(App, request) });
