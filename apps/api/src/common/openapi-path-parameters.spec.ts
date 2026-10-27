import type { OpenAPIObject } from "@nestjs/swagger";

import { undeclaredPathParameters } from "./openapi-path-parameters";

function document(paths: OpenAPIObject["paths"]): OpenAPIObject {
  return { openapi: "3.0.0", info: { title: "API", version: "1" }, paths };
}

describe("undeclaredPathParameters", () => {
  it("accepts operations that declare each of their path's parameters", () => {
    const gaps = undeclaredPathParameters(
      document({
        "/api/import/{source}/{jobId}": {
          get: {
            parameters: [
              { name: "source", in: "path", required: true },
              { name: "jobId", in: "path", required: true },
            ],
            responses: {},
          },
        },
      }),
    );

    expect(gaps).toEqual([]);
  });

  // GET /import/:source/:jobId read only jobId: the document left `source`
  // undeclared, and ZAP's API scan refused to import it.
  it("names a path parameter an operation leaves out", () => {
    const gaps = undeclaredPathParameters(
      document({
        "/api/import/{source}/{jobId}": {
          get: {
            parameters: [{ name: "jobId", in: "path", required: true }],
            responses: {},
          },
        },
      }),
    );

    expect(gaps).toEqual([
      "GET /api/import/{source}/{jobId}: path parameter source",
    ]);
  });

  it("counts parameters declared once for the whole path", () => {
    const gaps = undeclaredPathParameters(
      document({
        "/api/lists/{id}": {
          parameters: [{ name: "id", in: "path", required: true }],
          get: { responses: {} },
        },
      }),
    );

    expect(gaps).toEqual([]);
  });

  it("doesn't take a query parameter of the same name for the path's", () => {
    const gaps = undeclaredPathParameters(
      document({
        "/api/lists/{id}": {
          get: {
            parameters: [{ name: "id", in: "query" }],
            responses: {},
          },
        },
      }),
    );

    expect(gaps).toEqual(["GET /api/lists/{id}: path parameter id"]);
  });
});
