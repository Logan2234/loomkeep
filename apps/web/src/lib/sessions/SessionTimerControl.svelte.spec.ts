import { apiUrl, server } from "#lib/test/msw.js";
import { visit } from "#lib/test/navigation.svelte.js";
import { renderWithQuery } from "#lib/test/render.js";
import { waitFor } from "@testing-library/svelte";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SessionTimerControl from "./SessionTimerControl.svelte";

vi.mock("$app/state", () => import("#lib/test/navigation.svelte.js"));

const TIMER = {
  id: "timer-1",
  domain: "BOOKS",
  entryId: "entry-1",
  startedAt: "2026-10-30T10:00:00.000Z",
  pausedAt: "2026-10-30T10:45:00.000Z",
  elapsedSeconds: 2700,
};

function mount(entryId = "entry-1") {
  const onFinish = vi.fn();
  renderWithQuery(SessionTimerControl, { domain: "BOOKS", entryId, onFinish });
  return onFinish;
}

describe("SessionTimerControl", () => {
  beforeEach(() => {
    server.use(
      http.get(apiUrl("/session-timer"), () => HttpResponse.json(TIMER)),
    );
  });

  it("opens the finish form when the Android widget's stop button links here", async () => {
    visit("/app/books/1?finishSession=1");

    const onFinish = mount();

    await waitFor(() => expect(onFinish).toHaveBeenCalledWith(2700));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("leaves another book's page alone", async () => {
    visit("/app/books/2?finishSession=1");

    const onFinish = mount("entry-2");

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("doesn't finish anything on an ordinary visit", async () => {
    visit("/app/books/1");

    const onFinish = mount();

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onFinish).not.toHaveBeenCalled();
  });
});
