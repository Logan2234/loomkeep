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

  it("keeps a reply's field", () => {
    const [reply] = samplePush(
      "CHAT_MESSAGE",
      notificationCopy("en"),
    )!.actions!;

    expect(reply).toMatchObject({ label: "Reply", replyHint: "Your reply" });
  });
});
