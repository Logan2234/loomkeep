// The Shape Detection API's BarcodeDetector isn't in TypeScript's bundled DOM
// lib yet (Chrome/Edge ship it; Firefox/Safari don't — always feature-detect
// with `"BarcodeDetector" in window` before constructing one). Minimal shape,
// just the bits ScanIsbnModal.svelte uses.
interface BarcodeDetectorOptions {
  formats: string[];
}

interface DetectedBarcode {
  rawValue: string;
}

declare class BarcodeDetector {
  constructor(options: BarcodeDetectorOptions);
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
