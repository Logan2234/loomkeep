/**
 * Version of the terms of service currently in effect, ISO date format
 * (matches the "Dernière mise à jour" date shown on the CGU page). Bump this
 * whenever the CGU change substantially — existing users whose
 * `UserDto.acceptedTermsVersion` no longer matches are prompted to
 * re-accept before continuing to use the app.
 */
export const LEGAL_VERSION = "2026-08-16";
