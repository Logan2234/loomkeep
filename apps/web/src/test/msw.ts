import { API_URL } from "$lib/api/core";
import { setupServer } from "msw/node";

export const server = setupServer();

/** Absolute URL of an API path, as `request()` (core.ts) builds it. */
export const apiUrl = (path: string) => `${API_URL}${path}`;
