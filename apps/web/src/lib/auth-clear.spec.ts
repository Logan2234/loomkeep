import { describe, expect, it } from "vitest";
import { auth } from "./auth.svelte";
import { queryClient } from "./query-client";

describe("auth.clear", () => {
  it("drops the cached queries, so the next account in this tab never sees the previous one's data", () => {
    queryClient.setQueryData(["library", "list"], { items: ["previous"] });

    auth.clear();

    expect(queryClient.getQueryData(["library", "list"])).toBeUndefined();
    expect(auth.user).toBeNull();
  });
});
