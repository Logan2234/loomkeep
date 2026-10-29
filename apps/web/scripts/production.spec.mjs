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

// A campaign link (?utm_source=…) must not declare itself canonical: every
// variant would compete with the page in search indexes.
test("names the page's canonical URL without its query string", async () => {
  const response = await fetch(`${serverOrigin}/?utm_source=newsletter&ref=x`);
  const html = await response.text();
  // The scheme is whatever adapter-node infers; only the path matters here.
  const home = `https?://${new URL(serverOrigin).host}/"`;
  assert.match(html, new RegExp(`<link rel="canonical" href="${home}`));
  assert.match(html, new RegExp(`<meta property="og:url" content="${home}`));
});

// A preload whose URL differs from the stylesheet's downloads the font twice.
test("preloads the two Latin fonts the stylesheet actually uses", async () => {
  const html = await (await fetch(serverOrigin)).text();
  const preloads = [
    ...html.matchAll(/<link rel="preload" href="([^"]+\.woff2)"/g),
  ].map(([, href]) => href);
  assert.equal(preloads.length, 2);
  const css = await Promise.all(
    [...html.matchAll(/<link href="([^"]+\.css)" rel="stylesheet"/g)].map(
      async ([, href]) =>
        (await fetch(new URL(href, `${serverOrigin}/`))).text(),
    ),
  );

  for (const href of preloads) {
    const file = href.split("/").pop();
    assert.ok(
      css.some((sheet) => sheet.includes(file)),
      `${file} isn't referenced by the stylesheet`,
    );
  }
});

// Search engines flag pages sharing one description, and every public page
// used to carry the landing page's.
test("gives each public page its own single description", async () => {
  const descriptions = [];

  for (const pathname of [
    "/",
    "/legal/legal-notice",
    "/legal/privacy-policy",
    "/legal/terms-of-service",
    "/legal/transparency",
  ]) {
    const html = await (await fetch(serverOrigin + pathname)).text();
    const found = [
      ...html.matchAll(/<meta name="description" content="([^"]*)"/g),
    ];
    assert.equal(
      found.length,
      1,
      `${pathname} has ${found.length} descriptions`,
    );
    descriptions.push(found[0][1]);
  }

  assert.equal(new Set(descriptions).size, descriptions.length);
});

// The server runs without PUBLIC_SEARCH_INDEXING, like a fresh self-host.
test("keeps an instance out of search results unless indexing is switched on", async () => {
  const html = await (await fetch(serverOrigin)).text();
  assert.match(html, /<meta name="robots" content="noindex"/);
  const robots = await (await fetch(`${serverOrigin}/robots.txt`)).text();
  assert.match(robots, /^Disallow: \/$/m);
});

test("describes Loomkeep as a free application in structured data", async () => {
  const html = await (await fetch(serverOrigin)).text();
  const [, json] =
    html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s) ?? [];
  assert.ok(json, "no JSON-LD on the landing page");
  const data = JSON.parse(json);
  assert.equal(data["@type"], "SoftwareApplication");
  assert.equal(data.name, "Loomkeep");
  assert.equal(data.offers.price, "0");
  assert.match(data.url, new RegExp(`${new URL(serverOrigin).host}/$`));
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

// Enforced, not Report-Only: SvelteKit's scripts and app.html's boot script
// run only because they carry this response's nonce.
test("enforces a CSP whose nonce every inline script carries", async () => {
  for (const pathname of ["/", "/app", "/login"]) {
    const response = await fetch(serverOrigin + pathname);
    const csp = response.headers.get("content-security-policy");
    assert.ok(csp, `${pathname} has no Content-Security-Policy`);

    const scriptSrc = csp
      .split(";")
      .find((d) => d.trim().startsWith("script-src"));
    assert.doesNotMatch(scriptSrc, /'unsafe-inline'/);
    const [, nonce] = scriptSrc.match(/'nonce-([^']+)'/) ?? [];
    assert.ok(nonce, `${pathname}'s script-src has no nonce`);

    const html = await response.text();
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)]
      .map(([, attributes]) => attributes)
      .filter((attributes) => !attributes.includes("application/ld+json"));
    assert.ok(inline.length > 0);

    for (const attributes of inline) {
      assert.ok(
        attributes.includes(`nonce="${nonce}"`),
        `${pathname}: <script${attributes}> lacks the nonce`,
      );
    }

    // PUBLIC_API_URL's origin, appended at runtime (src/lib/server/csp.ts).
    assert.match(csp, new RegExp(`connect-src [^;]*${serverOrigin}`));
  }
});
