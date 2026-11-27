<script lang="ts">
  // Cloudflare Turnstile widget — bot check on the register form. Loads
  // Cloudflare's own script directly (their recommended integration, not an
  // npm package) rather than bundling it, so it always matches whatever
  // Cloudflare is currently serving.
  // Ambient Window.turnstile type declared in src/app.d.ts.
  const SCRIPT_URL =
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

  type TurnstileApi = NonNullable<Window["turnstile"]>;

  let scriptPromise: Promise<TurnstileApi> | undefined;

  function loadTurnstile(): Promise<TurnstileApi> {
    if (window.turnstile) return Promise.resolve(window.turnstile);

    scriptPromise ??= new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.turnstile!);
      script.onerror = () =>
        reject(new Error("Turnstile script failed to load"));
      document.head.appendChild(script);
    });

    return scriptPromise;
  }

  let {
    siteKey,
    onVerify,
  }: {
    siteKey: string;
    onVerify: (token: string) => void;
  } = $props();

  let container: HTMLDivElement;

  $effect(() => {
    let widgetId: string | undefined;
    let cancelled = false;

    loadTurnstile().then((turnstile) => {
      if (cancelled) return;
      widgetId = turnstile.render(container, {
        sitekey: siteKey,
        "offlabel-show-help": false,
        "offlabel-show-privacy": false,
        size: "flexible",
        callback: onVerify,
        "expired-callback": () => onVerify(""),
      });
    });

    return () => {
      cancelled = true;
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  });
</script>

<div bind:this={container}></div>
