import { mergeAlertPrefs, readAlertPrefs } from "./alert-prefs.util";

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

describe("stored alert preferences", () => {
  it("retains known boolean choices and ignores malformed JSON channels", () => {
    expect(
      readAlertPrefs({
        COMMENT_REPLY: { push: true, email: false, bell: true },
        ADMIN_QUOTA: { push: "yes" },
        UNKNOWN: { push: true },
      }),
    ).toEqual({
      COMMENT_REPLY: { push: true, email: false, bell: true },
      ADMIN_QUOTA: {},
    });
    expect(readAlertPrefs(null)).toEqual({});
    expect(readAlertPrefs([])).toEqual({});
  });
});
