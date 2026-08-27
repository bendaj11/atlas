export const ATLAS_DEV_ACTIVATION_PATH = '/atlas.dev-session/activate';
export const ATLAS_DEV_ACTIVATION_PROTOCOL_VERSION = '1';
export const ATLAS_DEV_ACTIVATION_TOKEN_PARAM = 'token';
export const ATLAS_DEV_ACTIVATION_VERSION_PARAM = 'protocol';
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

export interface AtlasDevelopmentActivationResponse {
  protocolVersion: typeof ATLAS_DEV_ACTIVATION_PROTOCOL_VERSION;
  targetUrl: string;
  document: unknown;
}
