import { ALERTS, PUSH_SAMPLE_KEYS } from "@loomkeep/shared";
import { NotificationAction } from "../notifications/notification-action";
import { notificationCopy } from "../notifications/notification-copy";
import { samplePush } from "./push-samples";

describe("samplePush", () => {
  it("has a sample for every alert the admin can pick", () => {
    for (const key of PUSH_SAMPLE_KEYS) {
      expect({ key, sample: samplePush(key, notificationCopy("en")) }).toEqual({
        key,
        sample: expect.objectContaining({ group: ALERTS[key].group }),
      });
    }
  });

  it("shows a push's real buttons, which only reach the API", () => {
    const sample = samplePush("FOLLOW_REQUEST", notificationCopy("fr"))!;

    expect(sample.actions).toEqual([
      { action: NotificationAction.TEST, label: "Accepter", target: {} },
      { action: NotificationAction.TEST, label: "Refuser", target: {} },
    ]);
  });

  it("links to a page that exists", () => {
    for (const key of ["SAGA_SEQUEL_ANNOUNCED", "PAUSED_REMINDER"] as const) {
      expect(samplePush(key, notificationCopy("en"))!.url).toMatch(
        /^\/app\/media\/(movie|series|anime)\//,
      );
    }
  });

  it("shows the pictures a real push carries", () => {
    const context = {
      avatar: "/api/users/u1/avatar?v=1",
      work: { title: "Arrival", url: "/app/media/movie/1", poster: "poster" },
    };
    const copy = notificationCopy("en");

    expect(samplePush("FOLLOW", copy, context)).toMatchObject({
      image: context.avatar,
      imageKind: "person",
    });
    expect(samplePush("SAGA_SEQUEL_ANNOUNCED", copy, context)).toMatchObject({
      image: "poster",
      imageKind: "work",
      url: "/app/media/movie/1",
    });
    expect(samplePush("CHAT_MESSAGE", copy, context)).toMatchObject({
      conversationId: "sample",
      image: context.avatar,
    });
  });

  it("can give its buttons an action the server refuses", () => {
    const sample = samplePush("FOLLOW", notificationCopy("en"), undefined, {
      failing: true,
    })!;

    expect(sample.actions![0].action).toBe(NotificationAction.TEST_FAILURE);
  });

  it("keeps a reply's field", () => {
    const [reply] = samplePush(
      "CHAT_MESSAGE",
      notificationCopy("en"),
    )!.actions!;

    expect(reply).toMatchObject({ label: "Reply", replyHint: "Your reply" });
  });
});
