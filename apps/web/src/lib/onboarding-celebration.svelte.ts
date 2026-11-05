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
const LANDING_DELAY_MS = 2100;

const reducedMotion = () =>
  typeof matchMedia !== "undefined" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Whether the home should play its first landing now. */
function celebrationPending(): boolean {
  return (
    welcomeCelebration.startedAt > 0 &&
    Date.now() - welcomeCelebration.startedAt < 7000
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

/**
 * Two confetti cannons in the bottom corners, fired steeply upwards so the
 * confetti peaks around `peakY` (the card's top) then rains down across the
 * screen, over the card, and out at the bottom.
 */
function cannons(peakY: number) {
  const canvas = document.createElement("canvas");
  const ratio = window.devicePixelRatio || 1;
  canvas.width = innerWidth * ratio;
  canvas.height = innerHeight * ratio;
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = `position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:${MODAL_Z_INDEX + 1}`;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.remove();

  const GRAVITY = 0.32;
  const startY = innerHeight + 10;
  const bits = Array.from({ length: 220 }, (_, i) => {
    const fromLeft = i % 2 === 0;
    // 64° to 80° above the horizontal, mirrored on the right.
    const angle = ((64 + Math.random() * 16) * Math.PI) / 180;
    const rise = Math.max(120, startY - peakY + (Math.random() - 0.5) * 120);
    const vy = -Math.sqrt(2 * GRAVITY * rise);
    const vx = (Math.abs(vy) / Math.tan(angle)) * (fromLeft ? 1 : -1);
    return {
      x: fromLeft ? -10 : innerWidth + 10,
      y: startY,
      vx,
      vy,
      sway: Math.random() * Math.PI * 2,
      size: 2.5 + Math.random() * 3.5,
      color: COLORS[i % COLORS.length],
      spin: Math.random() * 6,
      // Fired in a few volleys rather than all at once.
      wait: Math.floor(Math.random() * 18),
    };
  });

  const frame = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;

    for (const bit of bits) {
      if (bit.y > innerHeight + 20) continue;
      alive = true;

      if (bit.wait > 0) {
        bit.wait--;
        continue;
      }

      if (bit.vy < 0) {
        bit.vy += GRAVITY;
      } else {
        // Past the peak: paper flutters down, drifting sideways.
        bit.vy = Math.min(bit.vy + GRAVITY * 0.35, 3.2);
        bit.vx *= 0.97;
        bit.sway += 0.08;
        bit.x += Math.sin(bit.sway) * 0.9;
      }

      bit.x += bit.vx;
      bit.y += bit.vy;
      bit.spin += 0.15;
      ctx.save();
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

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A ragged vertical tear at `x` down a `height`-tall card, top to bottom. */
function tearLine(x: number, height: number): string[] {
  const points: string[] = [];
  for (let y = 0, i = 0; y <= height; y += 6, i++)
    points.push(`${x + (i % 2 ? 2.5 : -2.5)}px ${Math.min(y, height)}px`);
  return points;
}

/**
 * Plays the send-off from the membership card: it leaves the tour for the
 * middle of the screen over a dimmed app, confetti rains from both bottom
 * corners, the card tears at its stub like a used ticket, and the card part
 * arcs into the avatar while the dimming lifts. Resolves once it has landed.
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

  const scrim = document.createElement("div");
  scrim.setAttribute("aria-hidden", "true");
  scrim.style.cssText = `position:fixed;inset:0;pointer-events:none;background:rgb(12 13 16 / .62);z-index:${MODAL_Z_INDEX - 1}`;
  document.body.appendChild(scrim);
  scrim.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: 450,
    fill: "forwards",
  });

  // Copies travel outside the tour, so the tour can fade under them.
  const copy = () => {
    const piece = card.cloneNode(true) as HTMLElement;
    piece.setAttribute("aria-hidden", "true");
    Object.assign(piece.style, {
      position: "fixed",
      left: `${from.left}px`,
      top: `${from.top}px`,
      width: `${from.width}px`,
      height: `${from.height}px`,
      margin: "0",
      zIndex: String(MODAL_Z_INDEX),
      pointerEvents: "none",
      visibility: "visible",
    });
    for (const el of [piece, ...piece.querySelectorAll<HTMLElement>("*")])
      el.style.animation = "none";
    document.body.appendChild(piece);
    return piece;
  };

  const flyer = copy();
  card.style.visibility = "hidden";

  tour?.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: 450,
    easing: "ease-out",
    fill: "forwards",
  });

  // A small phone shows the card a little smaller, with room around it.
  const scale = Math.min(1.04, (innerWidth * 0.8) / from.width);
  const startX = from.left + from.width / 2;
  const startY = from.top + from.height / 2;
  const centre = { x: innerWidth / 2 - startX, y: innerHeight / 2 - startY };
  const at = (x: number, y: number, rotate: number, s: number) =>
    `translate(${x}px, ${y}px) rotate(${rotate}deg) scale(${s})`;
  const resting = at(centre.x, centre.y, 0, scale);

  await flyer.animate([{ transform: "none" }, { transform: resting }], {
    duration: 650,
    easing: "cubic-bezier(.3,0,.2,1)",
    fill: "forwards",
  }).finished;

  cannons(innerHeight / 2 - (from.height * scale) / 2);
  await pause(550);

  // The tear: two copies clipped along a ragged line at the stub's edge.
  const stub = flyer.lastElementChild as HTMLElement | null;
  const tearX = stub ? stub.offsetLeft : from.width * 0.8;
  const line = tearLine(tearX, from.height);
  const ticket = copy();
  const torn = copy();
  ticket.style.clipPath = `polygon(0 0, ${line.join(", ")}, 0 ${from.height}px)`;
  torn.style.clipPath = `polygon(${line.join(", ")}, ${from.width}px ${from.height}px, ${from.width}px 0)`;
  for (const piece of [ticket, torn]) piece.style.transform = resting;
  flyer.remove();
  navigator.vibrate?.(12);

  // The stub jerks away and falls off the screen, spinning.
  torn
    .animate(
      [
        { transform: resting, opacity: 1 },
        {
          transform: `${resting} translate(14px, -6px) rotate(9deg)`,
          opacity: 1,
          offset: 0.15,
        },
        {
          transform: `${resting} translate(60px, ${innerHeight}px) rotate(70deg)`,
          opacity: 0.6,
        },
      ],
      { duration: 1300, easing: "cubic-bezier(.4,0,.8,.6)", fill: "forwards" },
    )
    .finished.then(() => torn.remove());

  await ticket.animate(
    [
      { transform: resting },
      { transform: `${resting} translate(-8px, 2px) rotate(-3deg)` },
    ],
    { duration: 220, easing: "ease-out", fill: "forwards" },
  ).finished;

  const lifted = { x: centre.x - 8, y: centre.y - 40 };
  await ticket.animate(
    [
      { transform: `${resting} translate(-8px, 2px) rotate(-3deg)` },
      { transform: at(lifted.x, lifted.y, -4, scale * 1.04) },
    ],
    { duration: 350, easing: "cubic-bezier(.2,.8,.3,1)", fill: "forwards" },
  ).finished;

  // An arc up and over into the avatar, while the dimming lifts.
  scrim.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: 950,
    easing: "ease-in",
    fill: "forwards",
  });
  const to = profileTarget();
  const end = to
    ? {
        x: to.left + to.width / 2 - startX,
        y: to.top + to.height / 2 - startY,
      }
    : { x: centre.x, y: innerHeight - startY };
  const control = {
    x: lifted.x + (end.x - lifted.x) * 0.3,
    y: Math.min(lifted.y, end.y) - 160,
  };
  const STEPS = 16;
  const path = Array.from({ length: STEPS + 1 }, (_, i) => {
    const t = i / STEPS;
    const x =
      (1 - t) ** 2 * lifted.x + 2 * (1 - t) * t * control.x + t ** 2 * end.x;
    const y =
      (1 - t) ** 2 * lifted.y + 2 * (1 - t) * t * control.y + t ** 2 * end.y;
    return {
      transform: at(x, y, -4 + 14 * t, scale * 1.04 * (1 - 0.96 * t ** 1.4)),
      opacity: t < 0.9 ? 1 : 0.9,
    };
  });
  await ticket.animate(path, {
    duration: 950,
    easing: "cubic-bezier(.45,0,.35,1)",
    fill: "forwards",
  }).finished;
  ticket.remove();
  scrim.remove();

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
function shimmer(el: HTMLElement) {
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
