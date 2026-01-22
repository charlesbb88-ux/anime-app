import React, { useEffect, useMemo, useRef, useState } from "react";
import type { CompletionItem } from "@/lib/completions";

type Item = CompletionItem;

type Props = {
  items: Item[];
  onSelect?: (item: Item) => void; // ✅ new
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// Infinite-stack compression curve (no hard cap)
function stackOffset(depth: number, max: number, k: number) {
  return max * (1 - Math.exp(-depth / k));
}

export default function CompletionsCarouselRowLarge({ items, onSelect }: Props) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageW, setStageW] = useState(900);

  // interaction + spring
  const [targetPos, setTargetPos] = useState(0);
  const [renderPos, setRenderPos] = useState(0);

  const renderPosRef = useRef(0);
  const velRef = useRef(0);

  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartPosRef = useRef(0);

  const wheelVelRef = useRef(0);
  const wheelRAFRef = useRef<number | null>(null);

  // hover morph
  const [hovering, setHovering] = useState(false);
  const hoverRef = useRef(false);
  const [hoverBlend, setHoverBlend] = useState(0); // 0=overview, 1=hover-decks
  const hoverBlendRef = useRef(0);

  // lock hover ONLY after user interacts (ONE-WAY; only refresh unlocks)
  const [hoverLocked, setHoverLocked] = useState(false);
  const hoverLockedRef = useRef(false);

  function lockHover() {
    if (hoverLockedRef.current) return;
    hoverLockedRef.current = true;
    setHoverLocked(true);

    hoverRef.current = true;
    setHovering(true);
  }

  // ✅ click vs drag detection (minimal)
  const pressXRef = useRef(0);
  const pressYRef = useRef(0);
  const movedRef = useRef(false);
  const CLICK_SLOP_PX = 6;

  function notePress(clientX: number, clientY: number) {
    pressXRef.current = clientX;
    pressYRef.current = clientY;
    movedRef.current = false;
  }

  function noteMove(clientX: number, clientY: number) {
    const dx = clientX - pressXRef.current;
    const dy = clientY - pressYRef.current;
    if (Math.abs(dx) > CLICK_SLOP_PX || Math.abs(dy) > CLICK_SLOP_PX) {
      movedRef.current = true;
    }
  }

  function maybeClick(it: Item) {
    if (movedRef.current) return;
    onSelect?.(it);
  }

  // =========
  // LARGE CONSTANTS
  // =========
  const CARD_W = 132;
  const CARD_H = 190;
  const STAGE_H = 230;

  const STACK_MAX_X = 150;
  const STACK_K = 22;

  const GUTTER = STACK_MAX_X + 22;
  const EDGE_PAD = GUTTER;

  const WINDOW_TARGET = 7;

  const DECK_INSET = 18;

  const SPREAD_GAP = 14;

  const OVERVIEW_PAD = 18;
  const OVERVIEW_MIN_STEP = 8;
  const OVERVIEW_MAX_STEP = 26;

  const DRAG_SENSITIVITY_PX = 120;

  const WHEEL_SENSITIVITY_PX = 520;
  const WHEEL_TICK_MAX = 0.55;

  const SPRING_K = 0.18;
  const SPRING_D = 0.74;
  const MAX_VEL = 0.55;
  const SNAP_EPS = 0.002;
  const VEL_EPS = 0.002;

  const DRAG_FOLLOW = 0.42;
  const SNAP_ON_RELEASE = true;

  const maxPos = Math.max(0, items.length - 1);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? 900;
      setStageW(Math.max(320, Math.floor(w)));
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // hoverBlend animator
  useEffect(() => {
    let raf = 0;

    const tick = () => {
      const t = hoverRef.current ? 1 : 0;
      const x = hoverBlendRef.current;
      const next = x + (t - x) * 0.18;

      hoverBlendRef.current = next;
      setHoverBlend(next);

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // spring toward targetPos
  useEffect(() => {
    let raf = 0;

    const tick = () => {
      const x = renderPosRef.current;
      const v = velRef.current;

      const t = targetPos;
      const effectiveTarget = draggingRef.current ? lerp(x, t, DRAG_FOLLOW) : t;

      const dx = effectiveTarget - x;

      let nextV = (v + dx * SPRING_K) * SPRING_D;
      nextV = clamp(nextV, -MAX_VEL, MAX_VEL);

      let nextX = x + nextV;
      nextX = clamp(nextX, 0, maxPos);

      if (Math.abs(effectiveTarget - nextX) < SNAP_EPS && Math.abs(nextV) < VEL_EPS) {
        nextX = effectiveTarget;
        nextV = 0;
      }

      velRef.current = nextV;
      renderPosRef.current = nextX;
      setRenderPos(nextX);

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [targetPos, maxPos]);

  const deckBand = useMemo(() => {
    const innerW = stageW - EDGE_PAD * 2;

    const leftX = EDGE_PAD;
    const rightX = EDGE_PAD + innerW - CARD_W;

    const midStart = leftX + DECK_INSET;
    const midEnd = rightX - DECK_INSET;

    const safeMidStart = Math.min(midStart, midEnd);
    const safeMidEnd = Math.max(midStart, midEnd);

    const span = Math.max(0, safeMidEnd - safeMidStart);

    const minStep = CARD_W + SPREAD_GAP;

    const maxStepsThatFit = Math.max(2, Math.floor(span / minStep) + 1);

    const steps = clamp(WINDOW_TARGET, 2, maxStepsThatFit);
    const rawStep = steps === 1 ? 0 : span / (steps - 1);

    const step = Math.max(rawStep, minStep);

    return {
      leftX,
      rightX,
      midStart: safeMidStart,
      midEnd: safeMidEnd,
      step,
      steps,
    };
  }, [stageW, EDGE_PAD, CARD_W, DECK_INSET, SPREAD_GAP]);

  const overviewBand = useMemo(() => {
    const leftX = OVERVIEW_PAD;
    const rightX = Math.max(leftX, stageW - OVERVIEW_PAD - CARD_W);
    const innerW = Math.max(1, rightX - leftX);

    const n = Math.max(1, items.length);
    const rawStep = n <= 1 ? 0 : innerW / (n - 1);

    const step = clamp(rawStep, OVERVIEW_MIN_STEP, OVERVIEW_MAX_STEP);

    const stripW = (n - 1) * step + CARD_W;
    const maxStart = stageW - OVERVIEW_PAD - stripW;
    const startX = clamp(leftX, leftX, Math.max(leftX, leftX + Math.max(0, maxStart)));

    return { startX, step };
  }, [stageW, items.length, CARD_W, OVERVIEW_MIN_STEP, OVERVIEW_MAX_STEP]);

  // deck mode indices (REVERSED WINDOW — same as small)
  const baseIndex = Math.floor(renderPos);
  const frac = clamp(renderPos - baseIndex, 0, 1);

  const WINDOW_COUNT = deckBand.steps;
  const maxStart = Math.max(0, items.length - WINDOW_COUNT);

  const spreadStart0 = clamp(maxStart - baseIndex, 0, maxStart);
  const spreadStart1 = clamp(maxStart - (baseIndex + 1), 0, maxStart);

  const spreadEnd0 = spreadStart0 + WINDOW_COUNT - 1;
  const spreadEnd1 = spreadStart1 + WINDOW_COUNT - 1;

  function layoutDeck(i: number, spreadStart: number, spreadEnd: number) {
    const y = 1;

    let x = deckBand.leftX;
    let opacity = 1;
    let scale = 1;
    let z = 1;

    const inSpread = i >= spreadStart && i <= spreadEnd;
    const before = i < spreadStart;
    const after = i > spreadEnd;

    if (before) {
      const leftCount = spreadStart;
      const depth = spreadStart - i;
      const ox = stackOffset(depth, STACK_MAX_X, STACK_K);

      let extraShift = 0;
      if (leftCount > 1) {
        const fullW = stackOffset(maxStart, STACK_MAX_X, STACK_K);
        const curW = stackOffset(leftCount, STACK_MAX_X, STACK_K);
        const delta = curW - fullW;
        const t = (depth - 1) / (leftCount - 1);
        extraShift = delta * t;
      }

      x = deckBand.leftX - ox + extraShift;

      opacity = clamp(1 - Math.log1p(depth) * 0.12, 0.18, 1);
      scale = clamp(1 - Math.log1p(depth) * 0.02, 0.92, 1);
      z = 10_000 - depth;
    } else if (after) {
      const rightCount = Math.max(0, items.length - (spreadEnd + 1));
      const depth = i - spreadEnd;
      const ox = stackOffset(depth, STACK_MAX_X, STACK_K);

      let extraShift = 0;
      if (rightCount > 1) {
        const fullW = stackOffset(maxStart, STACK_MAX_X, STACK_K);
        const curW = stackOffset(rightCount, STACK_MAX_X, STACK_K);
        const delta = fullW - curW;
        const t = (depth - 1) / (rightCount - 1);
        extraShift = delta * t;
      }

      x = deckBand.rightX + ox + extraShift;

      opacity = clamp(1 - Math.log1p(depth) * 0.12, 0.18, 1);
      scale = clamp(1 - Math.log1p(depth) * 0.02, 0.92, 1);
      z = 10_000 - depth;
    } else if (inSpread) {
      const slot = i - spreadStart;

      x = deckBand.midStart + slot * deckBand.step;

      opacity = 1;
      scale = 1;
      z = 50_000 + slot;
    }

    return { x, y, opacity, scale, z };
  }

  function layoutOverview(i: number) {
    const y = 1;
    const x = Math.round(overviewBand.startX + i * overviewBand.step);
    return { x, y, opacity: 1, scale: 1, z: 20_000 + i };
  }

  function beginDrag(clientX: number) {
    if (!items.length) return;

    lockHover();

    draggingRef.current = true;
    setDragging(true);

    dragStartXRef.current = clientX;
    dragStartPosRef.current = targetPos;

    velRef.current *= 0.35;
  }

  function moveDrag(clientX: number) {
    if (!draggingRef.current) return;

    const dx = clientX - dragStartXRef.current;
    const next = dragStartPosRef.current + dx / DRAG_SENSITIVITY_PX;

    setTargetPos(clamp(next, 0, maxPos));
  }

  function endDrag() {
    if (!draggingRef.current) return;

    draggingRef.current = false;
    setDragging(false);

    if (SNAP_ON_RELEASE) {
      setTargetPos((p) => clamp(Math.round(p), 0, maxPos));
    }
  }

  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (!items.length) return;

    let dx = e.deltaX;
    if (dx === 0 && e.shiftKey) dx = e.deltaY;

    if (Math.abs(dx) > Math.abs(e.deltaY) || e.shiftKey) {
      e.preventDefault();

      lockHover();

      const impulse = clamp(dx / WHEEL_SENSITIVITY_PX, -WHEEL_TICK_MAX, WHEEL_TICK_MAX);
      wheelVelRef.current += impulse;

      if (wheelRAFRef.current == null) {
        const step = () => {
          wheelVelRef.current *= 0.86;

          if (Math.abs(wheelVelRef.current) < 0.001) {
            wheelVelRef.current = 0;
            wheelRAFRef.current = null;

            if (!draggingRef.current && SNAP_ON_RELEASE) {
              setTargetPos((p) => clamp(Math.round(p), 0, maxPos));
            }
            return;
          }

          if (!draggingRef.current) {
            setTargetPos((p) => clamp(p + wheelVelRef.current, 0, maxPos));
          }

          wheelRAFRef.current = requestAnimationFrame(step);
        };

        wheelRAFRef.current = requestAnimationFrame(step);
      }
    }
  }

  function toneFor(kind: Item["kind"]) {
    return kind === "manga"
      ? "from-slate-950 via-slate-800 to-slate-700"
      : "from-slate-900 via-slate-950 to-slate-700";
  }

  return (
    <section className="w-full">
      <div className="mt-1">
        <div
          ref={stageRef}
          className={[
            "relative w-full",
            "overflow-visible",
            "select-none",
            "cursor-grab active:cursor-grabbing",
          ].join(" ")}
          style={{ height: STAGE_H }}
          onMouseDown={(e) => {
            notePress(e.clientX, e.clientY); // ✅ new
            beginDrag(e.clientX);
          }}
          onMouseMove={(e) => {
            noteMove(e.clientX, e.clientY); // ✅ new
            moveDrag(e.clientX);
          }}
          onMouseUp={endDrag}
          onMouseLeave={() => {
            endDrag();
            if (!hoverLockedRef.current) {
              hoverRef.current = false;
              setHovering(false);
            }
          }}
          onMouseEnter={() => {
            hoverRef.current = true;
            setHovering(true);
          }}
          onFocus={() => {
            hoverRef.current = true;
            setHovering(true);
          }}
          onBlur={() => {
            if (!hoverLockedRef.current) {
              hoverRef.current = false;
              setHovering(false);
            }
          }}
          onTouchStart={(e) => {
            lockHover();
            const t = e.touches[0];
            notePress(t?.clientX ?? 0, t?.clientY ?? 0); // ✅ new
            beginDrag(t?.clientX ?? 0);
          }}
          onTouchMove={(e) => {
            const t = e.touches[0];
            noteMove(t?.clientX ?? 0, t?.clientY ?? 0); // ✅ new
            moveDrag(t?.clientX ?? 0);
          }}
          onTouchEnd={endDrag}
          onWheel={onWheel}
          tabIndex={0}
          role="group"
          aria-label="Completions carousel (large)"
        >
          <div className="absolute inset-0">
            {items.map((it, i) => {
              const o = layoutOverview(i);

              const a = layoutDeck(i, spreadStart0, spreadEnd0);
              const b = layoutDeck(i, spreadStart1, spreadEnd1);

              const hx = lerp(a.x, b.x, frac);
              const hy = a.y;
              const hopacity = lerp(a.opacity, b.opacity, frac);
              const hscale = lerp(a.scale, b.scale, frac);
              const hz = Math.round(lerp(a.z, b.z, frac));

              const x = lerp(o.x, hx, hoverBlend);
              const y = lerp(o.y, hy, hoverBlend);
              const opacity = lerp(o.opacity, hopacity, hoverBlend);
              const scale = lerp(o.scale, hscale, hoverBlend);
              const z = Math.round(lerp(o.z, hz, hoverBlend));

              const tone = toneFor(it.kind);

              return (
                <div
                  key={it.id}
                  className="absolute"
                  style={{
                    width: CARD_W,
                    height: CARD_H,
                    zIndex: z,
                    opacity,
                    transform: `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) scale(${scale})`,
                    willChange: "transform, opacity",
                  }}
                  onClick={() => maybeClick(it)} // ✅ new
                >
                  <div
                    className={[
                      "relative w-full h-full",
                      "rounded-lg border border-black",
                      "overflow-hidden",
                      "shadow-[0_1px_0_rgba(0,0,0,0.20),0_10px_22px_rgba(0,0,0,0.10)]",
                      "bg-gradient-to-br",
                      tone,
                    ].join(" ")}
                  >
                    {it.image_url ? (
                      <img
                        src={it.image_url}
                        alt={it.title}
                        className="absolute inset-0 h-full w-full object-cover"
                        draggable={false}
                        loading="lazy"
                      />
                    ) : null}

                    <div className="absolute inset-0 opacity-[0.10] bg-[linear-gradient(135deg,transparent_0%,white_18%,transparent_40%,white_68%,transparent_100%)]" />
                    <div className="absolute inset-0 opacity-[0.08] bg-[radial-gradient(circle_at_25%_18%,white,transparent_45%),radial-gradient(circle_at_80%_35%,white,transparent_35%)]" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
