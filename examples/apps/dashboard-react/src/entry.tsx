import { createElement, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { defineApp, useAppLoaded, useAtlasSdk } from "@atlas/sdk/react";
import type { AtlasAppMountRequest } from "@atlas/sdk/lifecycle";
import "./styles.css";

function App({ context }: AtlasAppMountRequest) {
  const atlas = useAtlasSdk();
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
  return <section><h1>Dashboard React</h1><p>{atlas.hostData.name} mounted at {context.basePath}</p><div ref={widget} /><button type="button" onClick={() => atlas.toast.open({ title: "Dashboard React is ready" })}>Show toast</button><button type="button" onClick={() => atlas.popup.open({ title: "Order status", content: { widget: "orders-angular/order-status", props: { status: "processing" } }, draggable: true, resizable: true })}>Open Angular widget popup</button></section>;
}

export default defineApp({ createRoot, createElement: (request) => createElement(App, request) });
