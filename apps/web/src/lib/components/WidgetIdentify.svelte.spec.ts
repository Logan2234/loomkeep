import { auth } from "#lib/auth.svelte.js";
import { layout } from "#lib/layout.svelte.js";
import { onboardingReplay } from "#lib/onboarding-replay.svelte.js";
import { toast } from "#lib/toast.svelte.js";
import type { UserDto } from "@loomkeep/shared";
import { render } from "@testing-library/svelte";
import { createRawSnippet, flushSync } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SidePanel from "./SidePanel.svelte";
import WidgetIdentify from "./WidgetIdentify.svelte";

vi.mock("$app/env/public", () => ({
  PUBLIC_QUACKBACK_URL: "https://feedback.example.com/",
}));

const body = createRawSnippet(() => ({ render: () => "<p>Discussion</p>" }));

let quackback: ReturnType<typeof vi.fn<(...args: unknown[]) => void>>;
const lastCommand = () => quackback.mock.calls.at(-1)?.[0];

beforeEach(() => {
  quackback = vi.fn<(...args: unknown[]) => void>();
  window.Quackback = quackback;
  layout.compact = false;
  auth.user = { id: "u1", onboardedAt: "2026-11-01T00:00:00.000Z" } as UserDto;
});

afterEach(() => {
  delete window.Quackback;
  layout.compact = true;
  auth.user = null;
  onboardingReplay.active = false;
});

describe("WidgetIdentify", () => {
  it("hides the feedback launcher while a side panel covers its corner", () => {
    render(WidgetIdentify);
    expect(lastCommand()).toBe("showLauncher");

    const panel = render(SidePanel, {
      props: { onclose: () => {}, children: body },
    });
    flushSync();
    expect(lastCommand()).toBe("hideLauncher");

    panel.unmount();
    flushSync();
    expect(lastCommand()).toBe("showLauncher");
  });

  it("loads the SDK from the instance's own feedback board", () => {
    delete window.Quackback;
    // Kept out of the document: the test environment can't load it anyway.
    const append = vi
      .spyOn(document.head, "appendChild")
      .mockImplementation((node) => node);
    render(WidgetIdentify);

    const script = append.mock.calls[0]?.[0] as HTMLScriptElement;
    expect(script.src).toBe("https://feedback.example.com/api/widget/sdk.js");
    append.mockRestore();
  });

  it("stays away for an account that turned the launcher off", () => {
    auth.user = {
      id: "u1",
      onboardedAt: "2026-11-01T00:00:00.000Z",
      feedbackWidget: false,
    } as UserDto;
    render(WidgetIdentify);

    expect(quackback).not.toHaveBeenCalled();
  });

  it("hides the feedback launcher while the welcome tour covers the screen", () => {
    auth.user = { id: "u1", onboardedAt: null } as UserDto;
    render(WidgetIdentify);
    expect(lastCommand()).toBe("hideLauncher");

    auth.user = {
      id: "u1",
      onboardedAt: "2026-11-05T00:00:00.000Z",
    } as UserDto;
    flushSync();
    expect(lastCommand()).toBe("showLauncher");

    onboardingReplay.active = true;
    flushSync();
    expect(lastCommand()).toBe("hideLauncher");
  });

  it("hides the feedback launcher while a toast shares its corner", () => {
    render(WidgetIdentify);
    expect(lastCommand()).toBe("showLauncher");

    const id = toast.show("Saved");
    flushSync();
    expect(lastCommand()).toBe("hideLauncher");

    toast.dismiss(id);
    flushSync();
    expect(lastCommand()).toBe("showLauncher");
  });
});
