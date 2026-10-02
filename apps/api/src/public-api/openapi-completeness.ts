import type { OpenAPIObject } from "@nestjs/swagger";

type Schema = Record<string, unknown>;

const PLAIN_TYPES = new Set(["string", "number", "integer", "boolean"]);
// Generated clients name their methods after it: `listLibraryEntries`, not
// Nest's default `LibraryV1Controller_list_v1`.
const OPERATION_ID = /^[a-z][A-Za-z]*$/;

/**
 * What the published API reference must never lack: an operationId of its
 * own, a summary and a description on every operation, a description on every parameter and tag,
 * and on every schema property — plus an example on every property holding
 * plain values. Run by `generate:openapi`, the one place the Swagger
 * plugin's output exists (descriptions come from the DTOs' JSDoc).
 */
export function undocumentedParts(document: OpenAPIObject): string[] {
  const gaps: string[] = [];
  const tags = new Map(document.tags?.map((tag) => [tag.name, tag]));

  for (const [path, item] of Object.entries(document.paths)) {
    for (const [method, operation] of Object.entries(item)) {
      if (
        !operation ||
        typeof operation !== "object" ||
        !("responses" in operation)
      ) {
        continue;
      }

      const where = `${method.toUpperCase()} ${path}`;

      if (!OPERATION_ID.test(operation.operationId ?? "")) {
        gaps.push(`${where}: operationId`);
      }

      if (!operation.summary) gaps.push(`${where}: summary`);
      if (!operation.description) gaps.push(`${where}: description`);

      for (const parameter of operation.parameters ?? []) {
        if ("name" in parameter && !parameter.description) {
          gaps.push(`${where}: parameter ${parameter.name}`);
        }
      }

      for (const tag of operation.tags ?? []) {
        if (!tags.get(tag)?.description) gaps.push(`tag ${tag}: description`);
      }
    }
  }

  for (const [name, schema] of Object.entries(
    document.components?.schemas ?? {},
  )) {
    const properties = (schema as Schema).properties as
      Record<string, Schema> | undefined;

    for (const [property, definition] of Object.entries(properties ?? {})) {
      if (!definition.description) {
        gaps.push(`${name}.${property}: description`);
      }

      if (holdsPlainValues(definition) && definition.example === undefined) {
        gaps.push(`${name}.${property}: example`);
      }
    }
  }

  return [...new Set(gaps)];
}

function holdsPlainValues(definition: Schema): boolean {
  if (definition.type === "array") {
    return holdsPlainValues((definition.items ?? {}) as Schema);
  }

  return PLAIN_TYPES.has(definition.type as string);
}
