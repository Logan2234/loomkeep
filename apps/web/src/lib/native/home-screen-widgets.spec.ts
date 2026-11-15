import { apiUrl, server } from "#lib/test/msw.js";
import { http, HttpResponse } from "msw";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const { plugin, appListeners } = vi.hoisted(() => ({
  plugin: {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    refresh: vi.fn(async () => undefined),
  },
  appListeners: [] as ((state: { isActive: boolean }) => void)[],
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isPluginAvailable: () => true },
  registerPlugin: () => plugin,
}));
vi.mock("@capacitor/app", () => ({
  App: {
    addListener: (
      _: string,
      listener: (state: { isActive: boolean }) => void,
    ) => {
      appListeners.push(listener);
      return Promise.resolve({ remove: vi.fn() });
    },
  },
}));
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  appListeners.length = 0;
  server.use(
    http.post(apiUrl("/home-screen-widgets/token"), () =>
      HttpResponse.json({ token: "widget-token" }),
    ),
  );
});

describe("home-screen widgets", () => {
  it("hands them a token once signed in, and takes it back at sign-out", async () => {
    const { syncHomeScreenWidgets } = await import("./home-screen-widgets");

    await syncHomeScreenWidgets(true);
    expect(plugin.connect).toHaveBeenCalledWith({ token: "widget-token" });

    await syncHomeScreenWidgets(false);
    expect(plugin.disconnect).toHaveBeenCalledTimes(1);
  });

  // The app starts signed out until the session is restored: the widgets
  // keep the token they had meanwhile.
  it("leaves them alone while the session is still being restored", async () => {
    const { syncHomeScreenWidgets } = await import("./home-screen-widgets");

    await syncHomeScreenWidgets(false);

    expect(plugin.disconnect).not.toHaveBeenCalled();
  });

  it("redraws them when the app goes to the background", async () => {
    const { startHomeScreenWidgets } = await import("./home-screen-widgets");
    startHomeScreenWidgets();

    appListeners.forEach((listener) => listener({ isActive: true }));
    expect(plugin.refresh).not.toHaveBeenCalled();

    appListeners.forEach((listener) => listener({ isActive: false }));
    expect(plugin.refresh).toHaveBeenCalledTimes(1);
  });
});
