// Reaches the app's WebView through the DevTools socket a debug build
// exposes (forwarded to :9222 by smoke-test.sh).

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function appPage() {
  const pages = await (await fetch("http://127.0.0.1:9222/json")).json();
  return pages.find(
    (page) => page.type === "page" && page.url.startsWith("https://"),
  );
}

function evaluate(webSocketUrl, expression) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketUrl);
    // A page that navigates away mid-evaluation never answers.
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("DevTools evaluation timed out"));
    }, 10_000);

    socket.onopen = () =>
      socket.send(
        JSON.stringify({
          id: 1,
          method: "Runtime.evaluate",
          params: { expression, returnByValue: true },
        }),
      );

    socket.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (message.id !== 1) return;
      clearTimeout(timeout);
      socket.close();
      resolve(message.result?.result?.value);
    };

    socket.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("DevTools socket error"));
    };
  });
}

/**
 * Waits up to 90 s for the app to show a loaded page whose URL has
 * `expectedInUrl`, then evaluates `expression` there and returns its value.
 */
export async function onPage(expectedInUrl, expression) {
  const deadline = Date.now() + 90_000;
  let href;

  while (Date.now() < deadline) {
    try {
      const page = await appPage();

      if (page) {
        const state = await evaluate(
          page.webSocketDebuggerUrl,
          `({ href: location.href, ready: document.readyState === "complete" })`,
        );
        href = state?.href;

        if (state?.ready && href.includes(expectedInUrl)) {
          return await evaluate(page.webSocketDebuggerUrl, expression);
        }
      }
    } catch {
      // The WebView isn't up yet, or is between two pages.
    }

    await sleep(2000);
  }

  throw new Error(
    `The app never showed a page whose URL has "${expectedInUrl}" (last: ${href})`,
  );
}
