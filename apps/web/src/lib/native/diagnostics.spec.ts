import { expect, it, vi } from "vitest";
import { runProbe } from "./diagnostics";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isPluginAvailable: () => false },
  registerPlugin: () => ({}),
}));
vi.mock("@capacitor/haptics", () => ({
  Haptics: {},
  ImpactStyle: { Heavy: "HEAVY" },
}));

const probe = (run: () => Promise<unknown>) => ({
  id: "probe",
  plugin: "Plugin",
  run,
});

it("reports the exact error a vibration fails with", async () => {
  const result = await runProbe(
    probe(() => Promise.reject(new Error("no permission"))),
    () => true,
  );

  expect(result).toBe("error: no permission");
});

it("says when the APK doesn't have the plugin, without trying", async () => {
  const run = vi.fn();

  expect(await runProbe(probe(run), () => false)).toBe("unavailable");
  expect(run).not.toHaveBeenCalled();
});

it("reports a vibration Android accepted", async () => {
  expect(
    await runProbe(
      probe(() => Promise.resolve()),
      () => true,
    ),
  ).toBe("ok");
});
