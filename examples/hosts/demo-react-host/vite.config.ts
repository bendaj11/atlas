import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({ plugins: [react({ babel: { plugins: [["babel-plugin-react-compiler", { target: "19", panicThreshold: "none" }]] } })], server: { port: 4200 }, build: { target: "esnext" } });
