import type { OpenAPIObject } from "@nestjs/swagger";
import { describe, expect, it } from "vitest";
import { undocumentedParts } from "./openapi-completeness";

function document(overrides: Partial<OpenAPIObject> = {}): OpenAPIObject {
  return {
    openapi: "3.0.0",
    info: { title: "API", version: "1" },
    tags: [{ name: "Library", description: "Everything tracked." }],
    paths: {
      "/api/v1/library": {
        get: {
          tags: ["Library"],
          summary: "List entries",
          description: "Every tracked work.",
          parameters: [
            { name: "page", in: "query", description: "Page number." },
          ],
          responses: {},
        },
      },
    },
    components: {
      schemas: {
        Entry: {
          type: "object",
          properties: {
            id: { type: "string", description: "Its id.", example: "e1" },
            creators: {
              type: "array",
              items: { type: "string" },
              description: "Authors.",
              example: [],
            },
            work: {
              description: "The work.",
              allOf: [{ $ref: "#/components/schemas/Work" }],
            },
          },
        },
      },
    },
    ...overrides,
  };
}

describe("undocumentedParts", () => {
  it("passes a fully documented document", () => {
    expect(undocumentedParts(document())).toEqual([]);
  });

  it("names every missing operation, parameter and tag text", () => {
    const gaps = undocumentedParts(
      document({
        tags: [{ name: "Library" }],
        paths: {
          "/api/v1/library": {
            get: {
              tags: ["Library"],
              parameters: [{ name: "page", in: "query" }],
              responses: {},
            },
          },
        },
      }),
    );

    expect(gaps).toEqual([
      "GET /api/v1/library: summary",
      "GET /api/v1/library: description",
      "GET /api/v1/library: parameter page",
      "tag Library: description",
    ]);
  });

  it("asks for an example on plain values only", () => {
    const gaps = undocumentedParts(
      document({
        components: {
          schemas: {
            Entry: {
              type: "object",
              properties: {
                id: { type: "string" },
                creators: { type: "array", items: { type: "string" } },
                work: { allOf: [{ $ref: "#/components/schemas/Work" }] },
              },
            },
          },
        },
      }),
    );

    expect(gaps).toEqual([
      "Entry.id: description",
      "Entry.id: example",
      "Entry.creators: description",
      "Entry.creators: example",
      "Entry.work: description",
    ]);
  });
});
