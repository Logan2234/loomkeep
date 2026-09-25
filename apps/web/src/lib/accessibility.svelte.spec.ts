import { describe, expect, it } from "vitest";
import {
  contrastPreference,
  densityPreference,
  motionPreference,
} from "./accessibility.svelte";

describe("accessibility preferences", () => {
  it("accepts only supported persisted values", () => {
    expect(motionPreference("reduce")).toBe("reduce");
    expect(motionPreference("fast")).toBe("system");
    expect(contrastPreference("high")).toBe("high");
    expect(contrastPreference(null)).toBe("default");
    expect(densityPreference("compact")).toBe("compact");
    expect(densityPreference("comfortable")).toBe("comfortable");
    expect(densityPreference("wide")).toBe("default");
  });
});
