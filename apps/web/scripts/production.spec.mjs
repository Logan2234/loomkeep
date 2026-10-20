import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { after, before, test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";

let server;
let serverOrigin;
let output = "";

before(async () => {
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const { port } = reservation.address();
  await new Promise((resolve) => reservation.close(resolve));
  serverOrigin = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ["build"], {
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      PUBLIC_API_URL: `${serverOrigin}/api`,
      PUBLIC_GLITCHTIP_WEB_DSN: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (data) => (output += data));
  server.stderr.on("data", (data) => (output += data));
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    assert.equal(server.exitCode, null, output);

    try {
      await fetch(serverOrigin, { signal: AbortSignal.timeout(1_000) });
      return;
    } catch {
      await sleep(50);
    }
  }

  assert.fail(`Production server did not start.\n${output}`);
});

after(async () => {
  if (server && server.exitCode === null) {
    const exited = once(server, "exit");
    server.kill();
    await exited;
  }
});

test("renders the public landing page and signed-in app shell", async () => {
  for (const pathname of ["/", "/app", "/login"]) {
    const response = await fetch(serverOrigin + pathname);
    assert.equal(response.status, 200, `${pathname}\n${output}`);
    assert.match(response.headers.get("content-type"), /text\/html/);
    const html = await response.text();
    assert.match(html, /<html/);
    if (pathname === "/app") assert.ok(html.includes(`${serverOrigin}/api`));
  }
});

test("serves the precaching service worker through the production asset manifest", async () => {
  const response = await fetch(`${serverOrigin}/service-worker.js`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /javascript/);
  const script = await response.text();
  assert.match(script, /_app\/immutable\//);
  assert.doesNotMatch(script, /self\.__WB_MANIFEST/);
  assert.match(script, /notificationclick/);
});

test("validates static assets by ETag and supports HEAD", async () => {
  const response = await fetch(`${serverOrigin}/favicon.svg`);
  assert.equal(response.status, 200);
  const etag = response.headers.get("etag");
  assert.ok(etag);
  assert.equal(response.headers.get("last-modified"), null);
  const cached = await fetch(`${serverOrigin}/favicon.svg`, {
    headers: { "if-none-match": etag },
  });
  assert.equal(cached.status, 304);
  const head = await fetch(`${serverOrigin}/favicon.svg`, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
});

test("rejects static asset POST requests", async () => {
  const response = await fetch(`${serverOrigin}/favicon.svg`, {
    method: "POST",
  });
  assert.equal(response.status, 405);
});

test("serves the dynamic localized manifest with security and cache headers", async () => {
  const response = await fetch(`${serverOrigin}/manifest.webmanifest`, {
    headers: { "accept-language": "fr" },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).lang, "fr");
  assert.match(response.headers.get("vary"), /Accept-Language/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});

test("keeps admin development workshops unavailable in production", async () => {
  for (const pathname of ["/app/admin/components", "/app/admin/schema"]) {
    const response = await fetch(serverOrigin + pathname);
    assert.equal(response.status, 404);
  }
});
