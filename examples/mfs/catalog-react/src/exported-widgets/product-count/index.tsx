import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { defineExportedWidget } from "@atlas/sdk/react";

export interface ProductCountProps {
  count: number;
  label?: string;
}

function ProductCount({ count, label = "Products" }: ProductCountProps) {
  return <span>{label}: {count}</span>;
}

export default defineExportedWidget<ProductCountProps>({
  createRoot,
  createElement: ({ props }) => createElement(ProductCount, props)
});
