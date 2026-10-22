import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share, type ShareOptions } from "@capacitor/share";

/** Whether the installed Android app has the share sheet (an older APK may not). */
export const isNativeShareAvailable = (): boolean =>
  Capacitor.isPluginAvailable("Share");

/** Whether it can also write the file to hand over: exports. */
export const isNativeFileShareAvailable = (): boolean =>
  isNativeShareAvailable() && Capacitor.isPluginAvailable("Filesystem");

/**
 * The system share sheet, for the Android app: its WebView has no
 * `navigator.share`. Closing the sheet without picking anything isn't a
 * failure.
 */
export async function shareNatively(options: ShareOptions): Promise<void> {
  try {
    await Share.share(options);
  } catch (error) {
    if (!(error instanceof Error && error.message === "Share canceled")) {
      throw error;
    }
  }
}

let pendingShare: Promise<void> = Promise.resolve();

/**
 * Hands an export to the share sheet ("Save to Files", Drive, a messaging
 * app…), the Android app's stand-in for a download: its WebView ignores
 * `<a download>`. Several files queue up one sheet after another, since
 * Android shows a single sheet at a time.
 */
export function shareFile(content: string, filename: string): Promise<void> {
  const share = pendingShare.then(async () => {
    const { uri } = await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await shareNatively({ files: [uri] });
  });
  pendingShare = share.catch(() => {});
  return share;
}
