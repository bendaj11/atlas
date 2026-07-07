import { createElement, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { defineMicrofrontend, useAppLoaded, useAtlasSdk } from "@atlas/sdk/react";
import type { AtlasMfMountRequest } from "@atlas/sdk/lifecycle";
import "./styles.css";

if (import.meta.hot) await import("@vitejs/plugin-react/preamble");

interface SystemHostData {
  projectId: string;
}

function App({ context }: AtlasMfMountRequest) {
  const atlas = useAtlasSdk<{}, {}, SystemHostData>();
  const appLoaded = useAppLoaded();
  const widget = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false;
    let unmount: () => Promise<void> = async () => undefined;
    context.loading.show();
    void context.widgets.mount("orders-angular/order-status", widget.current!, { status: "paid" }).then((mounted) => {
      if (disposed) return mounted.unmount();
      unmount = mounted.unmount;
      appLoaded();
    });
    return () => { disposed = true; void unmount(); };
  }, [appLoaded, context]);
  return <section><h1>Dashboard React</h1><p>Project {atlas.hostData.projectId} mounted at {context.basePath}</p><div ref={widget} /><button type="button" onClick={() => atlas.toast.open({ title: "Dashboard React is ready" })}>Show toast</button><button type="button" onClick={() => atlas.popup.open({ title: "Order status", content: { widget: "orders-angular/order-status", props: { status: "processing" } }, draggable: true, resizable: true })}>Open Angular widget popup</button></section>;
}

export default defineMicrofrontend({ createRoot, createElement: (request) => createElement(App, request) });
