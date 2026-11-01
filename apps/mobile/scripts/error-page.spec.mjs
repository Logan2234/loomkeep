import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const html = await readFile(
  new URL("../www/error.html", import.meta.url),
  "utf8",
);
const script = html.split("<script>")[1].split("</script>")[0];

// Runs the page's script against just enough of a DOM.
function load({ search = "", hash = "", userAgent } = {}) {
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
  const windowListeners = {};
  runInNewContext(script, {
    URL,
    URLSearchParams,
    navigator: { languages: ["en-US"], userAgent },
    document: { documentElement: {}, getElementById: element },
    location: { search, hash, replace: (url) => replaced.push(url) },
    addEventListener: (type, listener) => (windowListeners[type] = listener),
  });
  return { element, replaced, windowListeners };
}

// Clicks Retry: returns where the page navigated to, if anywhere.
function clickRetry(search) {
  const { element, replaced } = load({ search });
  element("retry").listeners.click();
  return { replaced, current: element("current").textContent };
}

const instance = `?retry=${encodeURIComponent("https://media.example.com/app")}`;

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

test("Retry shows that it's connecting", () => {
  const { element } = load({ search: instance });
  element("retry").listeners.click();
  assert.equal(element("retry").disabled, true);
  assert.equal(element("retry").textContent, "Connecting…");
});

test("The page retries on its own when the network returns", () => {
  const { replaced, windowListeners } = load({ search: instance });
  windowListeners.online();
  assert.deepEqual(replaced, ["https://media.example.com/app"]);
});

test("The network returning doesn't interrupt the instance picker", () => {
  const { replaced, windowListeners } = load({
    search: instance,
    hash: "#pick",
  });
  windowListeners.online();
  assert.deepEqual(replaced, []);
});

test("A network failure doesn't mention updating the WebView", () => {
  const { element } = load({ userAgent: "Mozilla/5.0 Chrome/140.0.0.0" });
  assert.equal(element("update").hidden, true);
  assert.doesNotMatch(element("body").textContent, /WebView/);
});

test("A WebView too old for the app is told to update", () => {
  const { element } = load({ userAgent: "Mozilla/5.0 Chrome/100.0.0.0" });
  assert.equal(element("update").hidden, false);
  assert.match(element("body").textContent, /WebView/);
});

// ShellWebViewClient.java sets the theme by replacing exactly this tag.
test("The page keeps the tag the shell adds its theme to", () => {
  assert.ok(html.includes('<html lang="en">'));
});
