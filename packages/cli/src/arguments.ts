import type { AtlasFramework, AtlasVersionChannel } from "@atlas/schema";

export type SupportedFramework = Exclude<AtlasFramework, "vue">;

export class CliArguments {
  constructor(readonly values: readonly string[]) {}

  get command(): string | undefined { return this.values[0]; }
  get subcommand(): string | undefined { return this.values[1]; }
  get name(): string | undefined { return this.values[2]; }

  flag(name: string): string | undefined {
    const exactIndex = this.values.indexOf(`--${name}`);
    if (exactIndex >= 0) return this.values[exactIndex + 1] ?? "true";
    const prefix = `--${name}=`;
    return this.values.find((value) => value.startsWith(prefix))?.slice(prefix.length);
  }

  hasFlag(name: string): boolean {
    return this.flag(name) !== undefined;
  }

  routing(): boolean {
    if (this.hasFlag("no-routing")) return false;
    const value = this.flag("routing");
    if (value === undefined || value === "true") return true;
    if (value === "false") return false;
    throw new Error("--routing must be true or false.");
  }

  framework(): SupportedFramework {
    const value = this.flag("framework") ?? "react";
    if (value === "angular" || value === "react") return value;
    throw new Error(`Unsupported framework "${value}". Use angular or react.`);
  }

  channel(fallback: string): AtlasVersionChannel {
    const value = this.flag("channel") ?? fallback;
    if (value === "production" || value === "pr" || value === "local") return value;
    throw new Error(`Unsupported channel "${value}".`);
  }

  port(name: string, fallback: number): number {
    const value = Number(this.flag(name) ?? fallback);
    if (!Number.isInteger(value) || value < 1 || value > 65535) {
      throw new Error(`--${name} must be an integer between 1 and 65535.`);
    }
    return value;
  }
}
