import "@wix/design-system/styles.global.css";
import React from "react";
import { createRoot } from "react-dom/client";
import { PopupApp } from "./popup/components/PopupApp.js";
import "./popup.css";

const root = document.getElementById("root");

if (!root) throw new Error("Missing extension element #root.");

createRoot(root).render(<PopupApp />);
