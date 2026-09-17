export interface ArtifactoryConnectionOptions {
  readonly url: string;
  readonly repository: string;
  readonly prefix: string;
  readonly accessToken: string;
  readonly publicUrl: string;
  readonly requestTimeoutMs?: number;
}

export interface ArtifactoryDependencies {
  readonly fetch?: typeof fetch;
  readonly timeoutSignal?: (milliseconds: number) => AbortSignal;
}

export interface ArtifactUpload {
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly contentType: string;
  readonly cacheControl: string;
  readonly sha256: string;
}

export interface ArtifactoryFileInfo {
  size: number;
  versionToken: string;
}

export interface ArtifactoryObjectMetadata {
  cacheControl: string;
  contentType: string;
}

export interface ArtifactoryResponse {
  readonly response: Response;
  readonly signal: AbortSignal;
}
