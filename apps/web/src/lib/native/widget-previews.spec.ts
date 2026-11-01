import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const LAYOUTS = new URL(
  "../../../../mobile/android/app/src/main/res/layout/",
  import.meta.url,
);

// RemoteViews inflates only these: anything else, a plain <View> included,
// and the widget picker says the widget can't be loaded.
const ALLOWED = new Set([
  "LinearLayout",
  "FrameLayout",
  "RelativeLayout",
  "TextView",
  "ImageView",
  "Chronometer",
]);

describe("Widget layouts drawn outside the app", () => {
  const files = readdirSync(LAYOUTS).filter(
    (name) =>
      name.startsWith("widget_preview_") || name.startsWith("widget_clock_"),
  );

  it.each(files)("%s only uses views RemoteViews can inflate", (name) => {
    const xml = readFileSync(new URL(name, LAYOUTS), "utf8");
    const tags = [...xml.matchAll(/<([A-Za-z][\w.]*)/g)].map((m) => m[1]);

    expect(tags.filter((tag) => !ALLOWED.has(tag))).toEqual([]);
  });
});
