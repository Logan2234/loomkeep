import {
  type BarcodeFormat,
  BarcodeScanner,
  GoogleBarcodeScannerModuleInstallState,
} from "@capacitor-mlkit/barcode-scanning";
import { Capacitor } from "@capacitor/core";

/** Whether the Android app can scan through Google's own scanner (MOB-07). */
export const isNativeScanAvailable = (): boolean =>
  Capacitor.isPluginAvailable("BarcodeScanner");

/**
 * Google's ready-made scanner screen (Play services' code scanner): faster
 * than the web's camera loop, and no camera permission to ask for since
 * Google's screen holds the camera. Null when the person backs out.
 */
export async function scanNatively(
  format: BarcodeFormat,
): Promise<string | null> {
  await ensureScannerModule();

  try {
    const { barcodes } = await BarcodeScanner.scan({ formats: [format] });
    return barcodes[0]?.rawValue ?? null;
  } catch (error) {
    if (error instanceof Error && error.message === "scan canceled.") {
      return null;
    }

    throw error;
  }
}

/**
 * The scanner is a Play services module: a store install fetches it along
 * with the app (AndroidManifest's mlkit DEPENDENCIES), a sideloaded APK
 * downloads it on its first scan.
 */
async function ensureScannerModule(): Promise<void> {
  const { available } =
    await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
  if (available) return;

  await new Promise<void>((resolve, reject) => {
    const listener = BarcodeScanner.addListener(
      "googleBarcodeScannerModuleInstallProgress",
      ({ state }) => {
        if (state === GoogleBarcodeScannerModuleInstallState.COMPLETED) {
          stop();
          resolve();
        } else if (
          state === GoogleBarcodeScannerModuleInstallState.FAILED ||
          state === GoogleBarcodeScannerModuleInstallState.CANCELED
        ) {
          stop();
          reject(new Error("Google's barcode scanner couldn't be installed"));
        }
      },
    );
    const stop = () => void listener.then((l) => l.remove());
    void BarcodeScanner.installGoogleBarcodeScannerModule();
  });
}
