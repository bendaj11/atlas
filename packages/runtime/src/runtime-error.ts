import { AtlasError } from "@atlas/schema";

interface RuntimeErrorOptions {
  suggestedActions: string | readonly string[];
  code: string;
  cause?: unknown;
}

export function runtimeError(summary: string, options: RuntimeErrorOptions): AtlasError {
  return new AtlasError(summary, {
    suggestedActions: options.suggestedActions,
    ...(options.cause !== undefined ? { cause: options.cause } : {}),
    code: options.code,
    surface: "browser"
  });
}
