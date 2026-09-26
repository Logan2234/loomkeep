export type BannerVariant = "error" | "warning" | "info" | "neutral";
export type BannerLiveMode = "auto" | "off" | "polite" | "assertive";

export function bannerRole(
  variant: BannerVariant,
  live: BannerLiveMode,
): "alert" | "status" | undefined {
  if (live === "off") return undefined;
  if (live === "polite") return "status";
  if (live === "assertive" || variant === "error") return "alert";
  return undefined;
}
