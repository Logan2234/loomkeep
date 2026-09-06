// The class-validator constraint names ("minLength", "isEmail"...) currently
// used across every DTO in apps/api/src — the key in a class-validator
// ValidationError's `constraints` object, and in
// ApiErrorBody.details[].constraint. Two guard tests keep this list honest:
// apps/api's validation-constraint-names.spec.ts fails if a DTO starts using
// a constraint missing here, and apps/web's validation-messages.spec.ts
// fails if its translation table doesn't cover every name here.
export const VALIDATION_CONSTRAINT_NAMES = [
  "isString",
  "isNotEmpty",
  "isEmail",
  "isBoolean",
  "isNumber",
  "isInt",
  "isArray",
  "isObject",
  "isDateString",
  "isIso8601",
  "isIn",
  "equals",
  "minLength",
  "maxLength",
  "isLength",
  "min",
  "max",
  "matches",
  "arrayMinSize",
  "arrayMaxSize",
  "arrayNotEmpty",
  "arrayUnique",
  "isPushEndpoint",
] as const;

export type ValidationConstraintName =
  (typeof VALIDATION_CONSTRAINT_NAMES)[number];
