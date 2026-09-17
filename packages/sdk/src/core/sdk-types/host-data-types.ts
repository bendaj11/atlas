export interface AtlasHostData {
  readonly hostId: string;
  readonly name: string;
}

/** Custom host-data fields declared by the host SDK type, without the Atlas-owned ones. */
export type AtlasHostDataOf<THostSdk extends object> = THostSdk extends {
  readonly hostData: infer THostData extends object;
}
  ? Omit<THostData, keyof AtlasHostData>
  : {};

export type AtlasHostDataValue<THostSdk extends object> = AtlasHostData &
  Readonly<AtlasHostDataOf<THostSdk>>;

/** `hostData` is optional when the host declares no custom fields, required otherwise. */
export type HostDataOption<THostSdk extends object> =
  keyof AtlasHostDataOf<THostSdk> extends never
    ? { hostData?: Partial<AtlasHostData> }
    : { hostData: AtlasHostDataOf<THostSdk> & Partial<AtlasHostData> };
