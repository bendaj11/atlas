import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, Link, Outlet, RouterProvider, useParams } from "react-router-dom";
import { createRouterOptions, createRoutedApp } from "@atlas/sdk/react";
import "./styles.css";

function Layout() {
  return <section><h1>Catalog React</h1><nav><Link to="/">Products</Link> <Link to="products/42">Product 42</Link></nav><Outlet /></section>;
}

function Products() { return <p>Product list</p>; }
function ProductDetails() { const { id } = useParams(); return <p>Product {id}</p>; }

const routes = [{ path: "/", Component: Layout, children: [
  { index: true, Component: Products },
  { path: "products/:id", Component: ProductDetails }
] }];

export default createRoutedApp({
  createRoot,
  createRouter: ({ context }) => createMemoryRouter(routes, createRouterOptions(context)),
  createElement: (router) => createElement(RouterProvider, { router })
});
