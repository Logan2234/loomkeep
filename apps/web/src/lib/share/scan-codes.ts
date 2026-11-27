// Book ISBNs are EAN-13 codes under the "Bookland" 978/979 prefix — this
// rules out a stray barcode from something else (a snack wrapper in frame)
// being accepted as an ISBN.
const ISBN_BARCODE = /^97[89]\d{10}$/;

export const isIsbnBarcode = (value: string): boolean =>
  ISBN_BARCODE.test(value);

/**
 * The username a profile QR code (ShareProfileModal) points at. Only a
 * same-origin `/app/u/:username` link counts — a QR from anything else (a
 * random URL, another site's code) is rejected rather than silently opened,
 * since scanning is a fast path straight to a profile, not a
 * general-purpose QR reader.
 */
export function profileUsernameFromQr(
  data: string,
  origin: string,
): string | null {
  try {
    const url = new URL(data);
    if (url.origin !== origin) return null;
    const match = url.pathname.match(/^\/app\/u\/([^/]+)\/?$/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}
