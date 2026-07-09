import type { SupportedFramework } from "./arguments.js";

export function frameworkLabel(framework: SupportedFramework): string {
  return framework === "angular" ? "Angular" : "React";
}
