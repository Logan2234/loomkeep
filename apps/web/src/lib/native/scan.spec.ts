import { afterEach, describe, expect, it, vi } from "vitest";
import { scanNatively } from "./scan";

const { plugin, progress } = vi.hoisted(() => {
  let listener: ((event: { state: number }) => void) | undefined;
  const plugin = {
    isGoogleBarcodeScannerModuleAvailable: vi.fn(() =>
      Promise.resolve({ available: true }),
    ),
    installGoogleBarcodeScannerModule: vi.fn(() => Promise.resolve()),
    scan: vi.fn((_options: { formats: string[] }) =>
      Promise.resolve({ barcodes: [{ rawValue: "9782070612758" }] }),
    ),
    addListener: vi.fn(
      (_event: string, callback: (event: { state: number }) => void) => {
        listener = callback;
        return Promise.resolve({ remove: () => Promise.resolve() });
      },
    ),
  };
  return { plugin, progress: (state: number) => listener?.({ state }) };
});
vi.mock("@capacitor-mlkit/barcode-scanning", () => ({
  BarcodeScanner: plugin,
  GoogleBarcodeScannerModuleInstallState: {
    CANCELED: 3,
    COMPLETED: 4,
    FAILED: 5,
  },
}));

afterEach(() => vi.clearAllMocks());

describe("scanNatively", () => {
  it("returns what Google's scanner read, in the asked format", async () => {
    await expect(scanNatively("EAN_13" as never)).resolves.toBe(
      "9782070612758",
    );
    expect(plugin.scan).toHaveBeenCalledWith({ formats: ["EAN_13"] });
    expect(plugin.installGoogleBarcodeScannerModule).not.toHaveBeenCalled();
  });

  it("treats backing out of the scanner as no code, not an error", async () => {
    plugin.scan.mockRejectedValueOnce(new Error("scan canceled."));

    await expect(scanNatively("QR_CODE" as never)).resolves.toBeNull();
  });

  it("fetches the scanner module first when the device lacks it", async () => {
    plugin.isGoogleBarcodeScannerModuleAvailable.mockResolvedValueOnce({
      available: false,
    });

    const scanned = scanNatively("EAN_13" as never);
    await vi.waitFor(() =>
      expect(plugin.installGoogleBarcodeScannerModule).toHaveBeenCalled(),
    );
    expect(plugin.scan).not.toHaveBeenCalled();
    progress(4);

    await expect(scanned).resolves.toBe("9782070612758");
  });

  it("gives up when the module can't be installed", async () => {
    plugin.isGoogleBarcodeScannerModuleAvailable.mockResolvedValueOnce({
      available: false,
    });

    const scanned = scanNatively("EAN_13" as never);
    await vi.waitFor(() =>
      expect(plugin.installGoogleBarcodeScannerModule).toHaveBeenCalled(),
    );
    progress(5);

    await expect(scanned).rejects.toThrow("couldn't be installed");
    expect(plugin.scan).not.toHaveBeenCalled();
  });
});
