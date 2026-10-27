import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const html = await readFile(
  new URL("../www/error.html", import.meta.url),
  "utf8",
);
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// Runs the page's script against just enough of a DOM, then clicks Retry:
// returns where the page navigated to, if anywhere.
function clickRetry(search) {
  const elements = new Map();

  const element = (id) => {
    if (!elements.has(id)) {
      const listeners = {};
      elements.set(id, {
        listeners,
        addEventListener: (type, listener) => (listeners[type] = listener),
      });
    }

    return elements.get(id);
  };

  const replaced = [];
  runInNewContext(script, {
    URL,
    URLSearchParams,
    navigator: { languages: ["en-US"] },
    document: { documentElement: {}, getElementById: element },
    location: { search, hash: "", replace: (url) => replaced.push(url) },
    addEventListener: () => {},
  });
  element("retry").listeners.click();
  return { replaced, current: element("current").textContent };
}

test("Retry goes back to the instance the shell was loading", () => {
  const { replaced, current } = clickRetry(
    `?retry=${encodeURIComponent("https://media.example.com/app")}`,
  );
  assert.deepEqual(replaced, ["https://media.example.com/app"]);
  assert.equal(current, "Current instance: media.example.com");
});

test("Retry follows a dev build's http address", () => {
  const { replaced } = clickRetry(
    `?retry=${encodeURIComponent("http://10.0.2.2:5173/app")}`,
  );
  assert.deepEqual(replaced, ["http://10.0.2.2:5173/app"]);
});

for (const retry of [
  "javascript:alert(document.cookie)",
  "data:text/html,<script>alert(1)</script>",
  "/_instance?use=evil.example",
]) {
  test(`Retry ignores ${retry.split(":")[0]} addresses`, () => {
    const { replaced } = clickRetry(`?retry=${encodeURIComponent(retry)}`);
    assert.deepEqual(replaced, []);
  });
}

test("Retry does nothing without an instance", () => {
  assert.deepEqual(clickRetry("").replaced, []);
});
