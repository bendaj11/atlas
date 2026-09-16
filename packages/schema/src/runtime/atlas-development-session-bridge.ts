export const ATLAS_DEV_BRIDGE_MARKER = 'atlas-development-session-bridge';
export const ATLAS_DEV_SESSION_REQUEST = 'atlas.development-session.request';
export const ATLAS_DEV_SESSION_RESPONSE = 'atlas.development-session.response';

export interface AtlasDevelopmentSessionRequest {
  type: typeof ATLAS_DEV_SESSION_REQUEST;
  requestId: string;
  hostId: string;
}

export interface AtlasDevelopmentSessionResponse {
  type: typeof ATLAS_DEV_SESSION_RESPONSE;
  requestId: string;
  hostId: string;
  document?: unknown;
  error?: string;
}
