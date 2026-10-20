import type { Prisma } from "@prisma/client";

export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function jsonObject(value: unknown): Record<string, unknown> {
  return isJsonObject(value) ? value : {};
}

/** Use the JSON representation, including omission of undefined object fields. */
export function toJsonInput(value: object): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
