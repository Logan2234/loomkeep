import assert from "node:assert/strict";

export async function assertMobileNavigationAlignment(page) {
  const labels = await page
    .locator("[data-mobile-navigation]")
    .evaluate((nav) =>
      [...nav.children].flatMap((tab) => {
        const icon = tab.querySelector("svg");
        const label = tab.lastElementChild;
        if (!icon || !label || label.getBoundingClientRect().width <= 1)
          return [];

        const text = document.createRange();
        text.selectNodeContents(label);
        const textBounds = text.getBoundingClientRect();
        const iconBounds = icon.getBoundingClientRect();

        return [
          {
            label: label.textContent.trim(),
            offset: Math.abs(
              textBounds.x +
                textBounds.width / 2 -
                (iconBounds.x + iconBounds.width / 2),
            ),
          },
        ];
      }),
    );

  assert.ok(
    labels.length > 0,
    "The mobile navigation must expose visible labels",
  );

  for (const { label, offset } of labels) {
    assert.ok(
      offset <= 1,
      `${label} is ${offset.toFixed(2)}px off its icon's center`,
    );
  }

  return labels;
}
