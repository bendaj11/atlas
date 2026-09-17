import type { AngularVersionProfile } from '../../shared/versions/generator-versions.types.js';

export function selectNativeFederationPackage(
  profile: AngularVersionProfile,
): string {
  return usesNativeFederationV4Package(profile)
    ? '@angular-architects/native-federation-v4'
    : '@angular-architects/native-federation';
}

export function selectNativeFederationBuilder(
  profile: AngularVersionProfile,
): string {
  return `${selectNativeFederationPackage(profile)}:build`;
}

export function usesNativeFederationV4Package(
  profile: AngularVersionProfile,
): boolean {
  return profile.major === 20 || profile.major === 21;
}

export function usesNativeFederationV4ConfigApi(
  profile: AngularVersionProfile,
): boolean {
  return profile.major >= 20;
}
