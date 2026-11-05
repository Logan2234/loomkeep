import { MODAL_Z_INDEX } from "#lib/components/overlay-layers.js";

/**
 * The welcome tour's send-off: glitter in the domains' colours, the
 * membership card flying into the profile avatar, then the home's cards
 * landing one by one and "Tes premiers pas" glowing. Only when the tour ends,
 * never on a later visit of the home.
 */
export const welcomeCelebration = $state({ startedAt: 0 });

const COLORS = ["#d6a02a", "#1f9dae", "#d866a0", "#6e97e0", "#f5b841"];

/** When the home's cards start landing, counted from the click. */
export const LANDING_DELAY_MS = 450;

const reducedMotion = () =>
  typeof matchMedia !== "undefined" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Whether the home should play its first landing now. */
export function celebrationPending(): boolean {
  return (
    welcomeCelebration.startedAt > 0 &&
    Date.now() - welcomeCelebration.startedAt < 4000
  );
}

/** The visible avatar the card flies into: the phone's Profile tab or the desktop rail's. */
function profileTarget(): DOMRect | null {
  for (const el of document.querySelectorAll<HTMLElement>(
    "[data-profile-target]",
  )) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return rect;
  }

  return null;
}

function glitter(x: number, y: number) {
  const canvas = document.createElement("canvas");
  const ratio = window.devicePixelRatio || 1;
  canvas.width = innerWidth * ratio;
  canvas.height = innerHeight * ratio;
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = `position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:${MODAL_Z_INDEX + 1}`;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.remove();

  const bits = Array.from({ length: 110 }, (_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 7;
    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      size: 2.5 + Math.random() * 3.5,
      color: COLORS[i % COLORS.length],
      spin: Math.random() * 6,
      life: 1,
    };
  });

  const frame = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;

    for (const bit of bits) {
      bit.vy += 0.22;
      bit.vx *= 0.985;
      bit.x += bit.vx;
      bit.y += bit.vy;
      bit.spin += 0.2;
      bit.life -= 0.011;
      if (bit.life <= 0) continue;
      alive = true;
      ctx.save();
      ctx.globalAlpha = bit.life;
      ctx.translate(bit.x * ratio, bit.y * ratio);
      ctx.rotate(bit.spin);
      ctx.fillStyle = bit.color;
      ctx.fillRect(
        -bit.size * ratio,
        -bit.size * ratio * 0.4,
        bit.size * 2 * ratio,
        bit.size * 0.8 * ratio,
      );
      ctx.restore();
    }

    if (alive) requestAnimationFrame(frame);
    else canvas.remove();
  };

  requestAnimationFrame(frame);
}

/**
 * Plays the send-off from the membership card. The tour around it fades
 * away; resolves once the card has landed in the avatar.
 */
export async function celebrateWelcome(card: HTMLElement): Promise<void> {
  welcomeCelebration.startedAt = Date.now();
  const tour = card.closest<HTMLElement>("[role=dialog]");
  const from = card.getBoundingClientRect();

  if (reducedMotion()) {
    await tour?.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 200,
      fill: "forwards",
    }).finished;
    return;
  }

  glitter(from.left + from.width / 2, from.top + from.height / 2);

  // A copy flies, outside the tour, so the tour can fade under it.
  const flyer = card.cloneNode(true) as HTMLElement;
  flyer.setAttribute("aria-hidden", "true");
  Object.assign(flyer.style, {
    position: "fixed",
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
    margin: "0",
    animation: "none",
    zIndex: String(MODAL_Z_INDEX),
    pointerEvents: "none",
  });
  document.body.appendChild(flyer);
  for (const el of [flyer, ...flyer.querySelectorAll<HTMLElement>("*")])
    el.style.animation = "none";
  card.style.visibility = "hidden";

  tour?.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: 450,
    easing: "ease-out",
    fill: "forwards",
  });

  const to = profileTarget();
  const dx = to ? to.left + to.width / 2 - (from.left + from.width / 2) : 0;
  const dy = to
    ? to.top + to.height / 2 - (from.top + from.height / 2)
    : innerHeight - from.top;
  await flyer.animate(
    [
      { transform: "none", opacity: 1 },
      {
        transform: `translate(${dx * 0.25}px, -60px) rotate(-6deg) scale(.82)`,
        opacity: 1,
        offset: 0.35,
      },
      {
        transform: `translate(${dx}px, ${dy}px) rotate(8deg) scale(.05)`,
        opacity: 0.9,
      },
    ],
    { duration: 900, easing: "cubic-bezier(.5,0,.3,1)", fill: "forwards" },
  ).finished;
  flyer.remove();

  for (const el of document.querySelectorAll<HTMLElement>(
    "[data-profile-target]",
  )) {
    el.animate(
      [
        { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(245,184,65,.8)" },
        {
          transform: "scale(1.3)",
          boxShadow: "0 0 0 10px rgba(245,184,65,0)",
        },
        { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(245,184,65,0)" },
      ],
      { duration: 700, easing: "ease-out" },
    );
  }
}

/**
 * Home: every `[data-welcome-land]` block drops in with a bounce, then the
 * `[data-welcome-glow]` first-steps card shimmers. A no-op outside the
 * send-off, so a reload never replays it.
 */
export function landHome(node: HTMLElement) {
  if (!celebrationPending() || reducedMotion()) return;
  const blocks = [...node.querySelectorAll<HTMLElement>("[data-welcome-land]")];
  blocks.forEach((block, i) =>
    block.animate(
      [
        { opacity: 0, transform: "translateY(-28px)" },
        { opacity: 1, transform: "translateY(4px)", offset: 0.7 },
        { opacity: 1, transform: "none" },
      ],
      {
        duration: 520,
        delay: LANDING_DELAY_MS + i * 90,
        easing: "cubic-bezier(.2,.8,.3,1)",
        fill: "backwards",
      },
    ),
  );
  const glowAt = LANDING_DELAY_MS + blocks.length * 90 + 450;
  setTimeout(() => {
    for (const el of document.querySelectorAll<HTMLElement>(
      "[data-welcome-glow]",
    ))
      shimmer(el);
  }, glowAt);
}

/** A pulse of amber light around an element, with a sheen across it. */
export function shimmer(el: HTMLElement) {
  el.animate(
    [
      { boxShadow: "0 0 0 0 rgba(245,184,65,.65)" },
      { boxShadow: "0 0 0 12px rgba(245,184,65,0)" },
    ],
    { duration: 900, iterations: 2, easing: "ease-out" },
  );
  const sheen = document.createElement("span");
  sheen.setAttribute("aria-hidden", "true");
  sheen.style.cssText =
    "position:absolute;inset:0;pointer-events:none;border-radius:inherit;background:linear-gradient(105deg,transparent 35%,rgba(245,184,65,.28) 50%,transparent 65%);";
  const previous = { position: el.style.position, overflow: el.style.overflow };
  if (getComputedStyle(el).position === "static")
    el.style.position = "relative";
  el.style.overflow = "hidden";
  el.appendChild(sheen);
  sheen
    .animate(
      [{ transform: "translateX(-100%)" }, { transform: "translateX(100%)" }],
      { duration: 1100, easing: "ease-in-out", iterations: 2 },
    )
    .finished.finally(() => {
      sheen.remove();
      el.style.position = previous.position;
      el.style.overflow = previous.overflow;
    });
}
