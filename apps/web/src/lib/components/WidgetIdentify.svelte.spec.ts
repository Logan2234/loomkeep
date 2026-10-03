import { auth } from "$lib/auth.svelte";
import { layout } from "$lib/layout.svelte";
import type { UserDto } from "@loomkeep/shared";
import { render } from "@testing-library/svelte";
import { createRawSnippet, flushSync } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SidePanel from "./SidePanel.svelte";
import WidgetIdentify from "./WidgetIdentify.svelte";

const body = createRawSnippet(() => ({ render: () => "<p>Discussion</p>" }));

let quackback: ReturnType<typeof vi.fn<(...args: unknown[]) => void>>;
const lastCommand = () => quackback.mock.calls.at(-1)?.[0];

beforeEach(() => {
  quackback = vi.fn<(...args: unknown[]) => void>();
  window.Quackback = quackback;
  layout.compact = false;
  auth.user = { id: "u1" } as UserDto;
});

afterEach(() => {
  delete window.Quackback;
  layout.compact = true;
  auth.user = null;
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
});
