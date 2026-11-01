import { Capacitor, registerPlugin } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

/** apps/mobile's own plugin (ShellDiagnosticsPlugin.java). */
const ShellDiagnostics = registerPlugin<{
  info(): Promise<Record<string, unknown>>;
  vibrate(options: { usage: "none" | "touch" | "alarm" }): Promise<void>;
}>("ShellDiagnostics");

const ShellHaptics = registerPlugin<{
  tap(): Promise<void>;
  success(): Promise<void>;
}>("ShellHaptics");

export type ProbeResult = "ok" | "unavailable" | `error: ${string}`;

export interface VibrationProbe {
  id: string;
  plugin?: string;
  run(): Promise<unknown>;
}

// Every way of vibrating, one by one: which of them the phone answers tells
// where the vibration gets lost.
export const VIBRATION_PROBES: VibrationProbe[] = [
  {
    id: "ShellHaptics.tap",
    plugin: "ShellHaptics",
    run: () => ShellHaptics.tap(),
  },
  {
    id: "ShellHaptics.success",
    plugin: "ShellHaptics",
    run: () => ShellHaptics.success(),
  },
  {
    id: "vibrate (no usage)",
    plugin: "ShellDiagnostics",
    run: () => ShellDiagnostics.vibrate({ usage: "none" }),
  },
  {
    id: "vibrate (touch usage)",
    plugin: "ShellDiagnostics",
    run: () => ShellDiagnostics.vibrate({ usage: "touch" }),
  },
  {
    id: "vibrate (alarm usage)",
    plugin: "ShellDiagnostics",
    run: () => ShellDiagnostics.vibrate({ usage: "alarm" }),
  },
  {
    id: "Haptics.impact",
    plugin: "Haptics",
    run: () => Haptics.impact({ style: ImpactStyle.Heavy }),
  },
  {
    id: "navigator.vibrate",
    run: async () => {
      if (!navigator.vibrate?.(200)) throw new Error("refused");
    },
  },
];

export async function runProbe(
  { plugin, run }: VibrationProbe,
  isAvailable: (name: string) => boolean = Capacitor.isPluginAvailable,
): Promise<ProbeResult> {
  if (plugin && !isAvailable(plugin)) return "unavailable";

  try {
    await run();
    return "ok";
  } catch (error) {
    return `error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/** Null on an APK from before the plugin, or in a browser. */
export const nativeDiagnostics = (): Promise<Record<string, unknown>> | null =>
  Capacitor.isPluginAvailable("ShellDiagnostics")
    ? ShellDiagnostics.info()
    : null;
