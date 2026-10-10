import { describe, expect, it } from "vitest";
import {
  ALERTS,
  type AlertDefinition,
  isAlertEnabled,
  isAlertToggleable,
  mergeAlertPrefs,
} from "./alerts";
import { NotificationType } from "./enums";

describe("ALERTS", () => {
  it("lists every notification type", () => {
    for (const type of Object.values(NotificationType)) {
      expect(ALERTS).toHaveProperty(type);
    }
  });

  it("only puts notification types in the bell", () => {
    const types: string[] = Object.values(NotificationType);

    for (const [key, alert] of Object.entries(ALERTS)) {
      if ((alert as AlertDefinition).bell) expect(types).toContain(key);
    }
  });
});

describe("isAlertEnabled", () => {
  it("follows the default until the account chose", () => {
    expect(isAlertEnabled({}, "COMMENT_REPLY", "push")).toBe(false);
    expect(
      isAlertEnabled(
        { COMMENT_REPLY: { push: true } },
        "COMMENT_REPLY",
        "push",
      ),
    ).toBe(true);
    expect(isAlertEnabled({}, "ADMIN_JOB_FAILED", "email")).toBe(true);
    expect(
      isAlertEnabled(
        { ADMIN_JOB_FAILED: { email: false } },
        "ADMIN_JOB_FAILED",
        "email",
      ),
    ).toBe(false);
  });

  it("ignores a choice on a channel that has no setting", () => {
    expect(
      isAlertEnabled(
        { API_KEY_LEAKED: { email: false } },
        "API_KEY_LEAKED",
        "email",
      ),
    ).toBe(true);
    expect(
      isAlertEnabled(
        { API_KEYS_REVIEW: { push: true } },
        "API_KEYS_REVIEW",
        "push",
      ),
    ).toBe(false);
    expect(isAlertToggleable("API_KEYS_REVIEW", "push")).toBe(false);
  });
});

describe("mergeAlertPrefs", () => {
  it("lays a change over what was stored", () => {
    expect(
      mergeAlertPrefs(
        { COMMENT_REPLY: { push: true } },
        { COMMENT_REPLY: { push: false }, ADMIN_QUOTA: { push: true } },
      ),
    ).toEqual({
      COMMENT_REPLY: { push: false },
      ADMIN_QUOTA: { push: true },
    });
  });

  it("refuses an alert, a channel or a value it can't store", () => {
    expect(mergeAlertPrefs({}, { NOPE: { push: true } })).toBeNull();
    expect(
      mergeAlertPrefs({}, { API_KEY_LEAKED: { email: false } }),
    ).toBeNull();
    expect(mergeAlertPrefs({}, { COMMENT_REPLY: { bell: false } })).toBeNull();
    expect(mergeAlertPrefs({}, { COMMENT_REPLY: { push: "yes" } })).toBeNull();
  });
});
