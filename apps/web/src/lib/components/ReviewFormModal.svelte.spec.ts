import { ApiError } from "$lib/api/core";
import { resolveApiError } from "$lib/api/errors";
import { auth } from "$lib/auth.svelte";
import { m } from "$lib/paraglide/messages.js";
import { apiUrl, server } from "$lib/test/msw";
import { renderWithQuery } from "$lib/test/render";
import {
  ErrorCode,
  type ReviewDto,
  type UpsertReviewDto,
  type UserDto,
} from "@loomkeep/shared";
import { fireEvent, screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReviewFormModal from "./ReviewFormModal.svelte";

const REVIEW_PATH = "/reviews/me/MEDIA/m1";

let saved: UpsertReviewDto | null;
let deleted: boolean;

beforeEach(() => {
  saved = null;
  deleted = false;
  localStorage.clear();
  auth.user = { id: "u1" } as UserDto;
  server.use(
    http.put(apiUrl(REVIEW_PATH), async ({ request }) => {
      saved = (await request.json()) as UpsertReviewDto;
      return HttpResponse.json({ id: "r1", ...saved } as Partial<ReviewDto>);
    }),
    http.delete(apiUrl(REVIEW_PATH), () => {
      deleted = true;
      return new HttpResponse(null, { status: 200 });
    }),
    http.get(apiUrl(`${REVIEW_PATH}/revisions`), () => HttpResponse.json([])),
  );
});

type Review = { rating: number; text: string | null; visibility: "FRIENDS" };

function renderModal(review: Review | null = null) {
  const props = $state({
    title: "Dune",
    targetType: "MEDIA" as const,
    targetId: "m1",
    review,
    onClose: vi.fn(),
    onSaved: vi.fn(),
    onDeleted: vi.fn(),
  });
  const result = renderWithQuery(ReviewFormModal, props);
  return { ...result, props, user: userEvent.setup() };
}

const slider = () =>
  screen.getByRole<HTMLInputElement>("slider", {
    name: m.reviews_rating_out_of_ten(),
  });
const textArea = () =>
  screen.getByRole<HTMLTextAreaElement>("textbox", {
    name: m.reviews_optional_text(),
  });
const saveButton = () =>
  screen.getByRole<HTMLButtonElement>("button", { name: m.common_save() });

async function rate(value: number) {
  slider().value = String(value);
  await fireEvent.input(slider());
}

describe("ReviewFormModal", () => {
  it("won't save a review without a rating", async () => {
    const { user } = renderModal();

    await user.type(textArea(), "Great");

    expect(saveButton().disabled).toBe(true);
  });

  it("saves a new review and closes", async () => {
    const { props, user } = renderModal();

    await rate(8);
    await user.type(textArea(), "  Great world-building  ");
    await user.click(saveButton());

    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    expect(saved).toEqual({
      rating: 8,
      text: "Great world-building",
      visibility: "FRIENDS",
      spoilerTag: false,
    });
    expect(props.onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ id: "r1", rating: 8 }),
    );
  });

  it("sends a blank text as no text at all", async () => {
    const { props, user } = renderModal();

    await rate(6);
    await user.type(textArea(), "   ");
    await user.click(saveButton());

    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    expect(saved?.text).toBeNull();
  });

  it("keeps what's being typed when the review refetches mid-edit", async () => {
    const { props, user } = renderModal({
      rating: 5,
      text: "First take",
      visibility: "FRIENDS",
    });
    expect(textArea().value).toBe("First take");
    expect(slider().value).toBe("5");

    await user.clear(textArea());
    await user.type(textArea(), "Second thoughts");
    props.review = {
      rating: 9,
      text: "From the server",
      visibility: "FRIENDS",
    };

    await waitFor(() => expect(slider().value).toBe("5"));
    expect(textArea().value).toBe("Second thoughts");
  });

  it("shows why a save failed and stays open", async () => {
    server.use(http.put(apiUrl(REVIEW_PATH), () => HttpResponse.error()));
    const { props, user } = renderModal();

    await rate(7);
    await user.click(saveButton());

    expect(
      await screen.findByText(
        resolveApiError(new ApiError(0, "", ErrorCode.NetworkOffline)),
      ),
    ).toBeTruthy();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("deletes an existing review only after a second confirmation", async () => {
    const { props, user } = renderModal({
      rating: 5,
      text: null,
      visibility: "FRIENDS",
    });

    await user.click(screen.getByRole("button", { name: m.common_delete() }));
    expect(deleted).toBe(false);
    await user.click(screen.getByRole("button", { name: m.common_confirm() }));

    await waitFor(() => expect(props.onDeleted).toHaveBeenCalled());
    expect(deleted).toBe(true);
    expect(props.onClose).toHaveBeenCalled();
  });

  it("restores an unsent review after an accidental close", async () => {
    const first = renderModal();
    await rate(9);
    await first.user.type(textArea(), "Unfinished thought");
    await first.user.click(
      screen.getAllByRole("button", { name: m.common_close() })[0],
    );
    first.unmount();

    renderModal();

    expect(slider().value).toBe("9");
    expect(textArea().value).toBe("Unfinished thought");
    expect(screen.getByText(m.reviews_draft_restored())).toBeTruthy();
  });

  it("forgets the draft when the user cancels on purpose", async () => {
    const first = renderModal();
    await rate(9);
    await first.user.click(
      screen.getByRole("button", { name: m.common_cancel() }),
    );
    first.unmount();

    renderModal();

    expect(slider().getAttribute("aria-valuetext")).toBe(
      m.reviews_rating_unrated(),
    );
    expect(screen.queryByText(m.reviews_draft_restored())).toBeNull();
  });

  it("never restores another account's draft", async () => {
    const first = renderModal();
    await rate(9);
    first.unmount();

    auth.user = { id: "u2" } as UserDto;
    renderModal();

    expect(slider().getAttribute("aria-valuetext")).toBe(
      m.reviews_rating_unrated(),
    );
  });
});
