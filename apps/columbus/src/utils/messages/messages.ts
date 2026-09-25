import type { ArtifactVersion } from '../../types/artifact-version';
import type { HostData, HostPageState } from '../../types/host-data';

export type ColorScheme = 'dark' | 'light';

export interface InspectHostRequest {
  type: 'atlas.inspect-host';
  documentKey: string;
}

export interface ReadPageStateRequest {
  type: 'atlas.read-page-state';
}

export interface LoadArtifactVersionRequest {
  type: 'atlas.load-artifact-version';
  artifactKey: string;
  versionKey: string;
}

export interface OverrideCountMessage {
  type: 'atlas.override-count';
  overrideCount: number;
}

export interface FocusPreviewRequest {
  type: 'atlas.focus-preview';
}

export interface ActionThemeMessage {
  type: 'columbus.action-theme';
  colorScheme: ColorScheme;
}

export interface LoadDevelopmentSessionRequest {
  type: 'atlas.load-development-session';
  hostId: string;
  previewUrl: string;
  controlPort?: number;
}

export type ContentResponse<Payload> =
  ({ ok: true } & Payload) | { ok: false; error: string };

export function inspectHostRequest(documentKey: string): InspectHostRequest {
  return { type: 'atlas.inspect-host', documentKey };
}

export function isInspectHostRequest(
  value: unknown,
): value is InspectHostRequest {
  return (
    isMessage(value, 'atlas.inspect-host') &&
    typeof value.documentKey === 'string'
  );
}

export function readPageStateRequest(): ReadPageStateRequest {
  return { type: 'atlas.read-page-state' };
}

export function isReadPageStateRequest(
  value: unknown,
): value is ReadPageStateRequest {
  return isMessage(value, 'atlas.read-page-state');
}

export function loadArtifactVersionRequest({
  artifactKey,
  versionKey,
}: Omit<LoadArtifactVersionRequest, 'type'>): LoadArtifactVersionRequest {
  return { type: 'atlas.load-artifact-version', artifactKey, versionKey };
}

export function isLoadArtifactVersionRequest(
  value: unknown,
): value is LoadArtifactVersionRequest {
  return (
    isMessage(value, 'atlas.load-artifact-version') &&
    typeof value.artifactKey === 'string' &&
    typeof value.versionKey === 'string'
  );
}

export function overrideCountMessage(
  overrideCount: number,
): OverrideCountMessage {
  return { type: 'atlas.override-count', overrideCount };
}

export function isOverrideCountMessage(
  value: unknown,
): value is OverrideCountMessage {
  return (
    isMessage(value, 'atlas.override-count') &&
    typeof value.overrideCount === 'number' &&
    Number.isInteger(value.overrideCount) &&
    value.overrideCount >= 0
  );
}

export function actionThemeMessage(
  colorScheme: ColorScheme,
): ActionThemeMessage {
  return { type: 'columbus.action-theme', colorScheme };
}

export function isActionThemeMessage(
  value: unknown,
): value is ActionThemeMessage {
  return (
    isMessage(value, 'columbus.action-theme') &&
    (value.colorScheme === 'dark' || value.colorScheme === 'light')
  );
}

export function loadDevelopmentSessionRequest(
  request: Omit<LoadDevelopmentSessionRequest, 'type'>,
): LoadDevelopmentSessionRequest {
  return { type: 'atlas.load-development-session', ...request };
}

export function focusPreviewRequest(): FocusPreviewRequest {
  return { type: 'atlas.focus-preview' };
}

export function isFocusPreviewRequest(
  value: unknown,
): value is FocusPreviewRequest {
  return isMessage(value, 'atlas.focus-preview');
}

export function isLoadDevelopmentSessionRequest(
  value: unknown,
): value is LoadDevelopmentSessionRequest {
  return (
    isMessage(value, 'atlas.load-development-session') &&
    typeof value.hostId === 'string' &&
    typeof value.previewUrl === 'string' &&
    (value.controlPort === undefined || typeof value.controlPort === 'number')
  );
}

export function isHostDataResponse(
  value: unknown,
): value is ContentResponse<{ hostData: HostData }> {
  return isContentResponse(value, (payload) => isRecord(payload.hostData));
}

export function isPageStateResponse(
  value: unknown,
): value is ContentResponse<{ pageState: HostPageState }> {
  return isContentResponse(
    value,
    (payload) =>
      isRecord(payload.pageState) &&
      Array.isArray(payload.pageState.visibleAppIds) &&
      Array.isArray(payload.pageState.runtimeErrors),
  );
}

export function isManifestResponse(
  value: unknown,
): value is ContentResponse<{ manifest: ArtifactVersion }> {
  return isContentResponse(value, (payload) => isRecord(payload.manifest));
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMessage<Type extends string>(
  value: unknown,
  type: Type,
): value is Record<string, unknown> & { type: Type } {
  return isRecord(value) && value.type === type;
}

function isContentResponse(
  value: unknown,
  hasPayload: (payload: Record<string, unknown>) => boolean,
): boolean {
  if (!isRecord(value)) return false;
  if (value.ok === true) return hasPayload(value);

  return value.ok === false && typeof value.error === 'string';
}
