import type { OpenAPIObject } from "@nestjs/swagger";

/**
 * Every `{name}` in a path must be declared as a path parameter by each of
 * its operations, or the document is invalid OpenAPI: generated clients
 * can't fill it and scanners such as ZAP refuse to import it. Nest only
 * declares the route params a handler reads with `@Param()`, so a handler
 * that ignores one of its route's params leaves it out.
 */
export function undeclaredPathParameters(document: OpenAPIObject): string[] {
  const gaps: string[] = [];

  for (const [path, item] of Object.entries(document.paths)) {
    const names = [...path.matchAll(/\{([^}]+)\}/g)].map(([, name]) => name);

    for (const [method, operation] of Object.entries(item)) {
      if (
        !operation ||
        typeof operation !== "object" ||
        !("responses" in operation)
      ) {
        continue;
      }

      const declared = new Set(
        [...(item.parameters ?? []), ...(operation.parameters ?? [])]
          .filter((parameter) => "in" in parameter && parameter.in === "path")
          .map((parameter) => ("name" in parameter ? parameter.name : "")),
      );

      for (const name of names) {
        if (!declared.has(name)) {
          gaps.push(`${method.toUpperCase()} ${path}: path parameter ${name}`);
        }
      }
    }
  }

  return gaps;
}
