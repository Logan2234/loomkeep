// lhci runs this before each audited URL of the `app` group: signs in as the
// seed's alice once, the session then carries over (disableStorageReset).
module.exports = async (browser) => {
  const page = await browser.newPage();
  await page.goto("http://localhost:18080/app", { waitUntil: "networkidle0" });

  if (new URL(page.url()).pathname === "/login") {
    await page.type("input[name=identifier]", "alice@example.com");
    await page.type("input[name=password]", "Password123!");
    await page.click("button[type=submit]");
    await page.waitForFunction(() => location.pathname === "/app");
  }

  await page.close();
};
