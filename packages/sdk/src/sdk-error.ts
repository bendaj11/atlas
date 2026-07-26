import { AtlasError } from "@atlas/schema";

interface SdkErrorOptions {
  suggestedActions: string | readonly string[];
  code: string;
  cause?: unknown;
}

export function sdkError(
  summary: string,
  options: SdkErrorOptions
): AtlasError {
  return new AtlasError(summary, {
    suggestedActions: options.suggestedActions,
    ...(options.cause !== undefined ? { cause: options.cause } : {}),
    code: options.code,
    surface: "browser"
  });
}
