// components/completions/CompletionsCarouselRow.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";

type Item = {
  id: string;
  title: string;
  kind: "anime" | "manga";
};

type Props = {
  title: string;
  items: Item[];
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

export default function CompletionsCarouselRow({ title, items }: Props) {
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

  // ✅ hover morph
  const [hovering, setHovering] = useState(false);
  const hoverRef = useRef(false);
  const [hoverBlend, setHoverBlend] = useState(0); // 0=overview, 1=hover-decks
  const hoverBlendRef = useRef(0);

  // ✅ NEW: lock hover ONLY after user interacts (ONE-WAY; only refresh unlocks)
  const [hoverLocked, setHoverLocked] = useState(false);
  const hoverLockedRef = useRef(false);

  function lockHover() {
    if (hoverLockedRef.current) return;
    hoverLockedRef.current = true;
    setHoverLocked(true);

    // force hover mode on immediately
    hoverRef.current = true;
    setHovering(true);
  }

  // constants
  const CARD_W = 92;
  const CARD_H = 132;

  // hover deck layout
  const STACK_MAX_X = 150;
  const STACK_K = 22;

  const GUTTER = STACK_MAX_X + 22;
  const EDGE_PAD = GUTTER;

  const WINDOW_COUNT = 7;

  // overview layout (non-hover)
  const OVERVIEW_PAD = 18;
  const OVERVIEW_MIN_STEP = 6;
  const OVERVIEW_MAX_STEP = 26;

  // interaction feel
  const DRAG_SENSITIVITY_PX = 120;

  // wheel tuning
  const WHEEL_SENSITIVITY_PX = 520;
  const WHEEL_TICK_MAX = 0.55;

  // spring
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

    const midStart = leftX + 18;
    const midEnd = rightX - 18;

    const safeMidStart = Math.min(midStart, midEnd);
    const safeMidEnd = Math.max(midStart, midEnd);

    const steps = Math.max(2, WINDOW_COUNT);
    const step = steps === 1 ? 0 : (safeMidEnd - safeMidStart) / (steps - 1);

    return { leftX, rightX, midStart: safeMidStart, midEnd: safeMidEnd, step };
  }, [stageW, EDGE_PAD]);

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
  }, [stageW, items.length]);

  // deck mode indices (reversed window so the big stack starts on the LEFT)
  const baseIndex = Math.floor(renderPos);
  const frac = clamp(renderPos - baseIndex, 0, 1);

  const maxStart = Math.max(0, items.length - WINDOW_COUNT);

  const spreadStart0 = clamp(maxStart - baseIndex, 0, maxStart);
  const spreadStart1 = clamp(maxStart - (baseIndex + 1), 0, maxStart);

  const spreadEnd0 = spreadStart0 + WINDOW_COUNT - 1;
  const spreadEnd1 = spreadStart1 + WINDOW_COUNT - 1;

  function layoutDeck(i: number, spreadStart: number, spreadEnd: number) {
    const y = 18;

    let x = deckBand.leftX;
    let opacity = 1;
    let scale = 1;
    let z = 1;

    const inSpread = i >= spreadStart && i <= spreadEnd;
    const before = i < spreadStart;
    const after = i > spreadEnd;

    if (before) {
      const leftCount = spreadStart; // how many cards are in the left stack
      const depth = spreadStart - i; // 1..leftCount
      const ox = stackOffset(depth, STACK_MAX_X, STACK_K);

      // ✅ keep the *back* of the left stack anchored
      let extraShift = 0;
      if (leftCount > 1) {
        const fullW = stackOffset(maxStart, STACK_MAX_X, STACK_K); // reference (~STACK_MAX_X)
        const curW = stackOffset(leftCount, STACK_MAX_X, STACK_K);
        const delta = curW - fullW; // <= 0 (negative = shift left)
        const t = (depth - 1) / (leftCount - 1); // 0..1
        extraShift = delta * t;
      }

      x = deckBand.leftX - ox + extraShift;

      opacity = clamp(1 - Math.log1p(depth) * 0.12, 0.18, 1);
      scale = clamp(1 - Math.log1p(depth) * 0.02, 0.92, 1);
      z = 10_000 - depth;
    } else if (after) {
      const rightCount = Math.max(0, items.length - (spreadEnd + 1)); // how many cards are in the right stack
      const depth = i - spreadEnd; // 1..rightCount
      const ox = stackOffset(depth, STACK_MAX_X, STACK_K);

      // ✅ NEW: keep the *back* of the right stack anchored (mirror of left)
      // We do this WITHOUT moving the "front" (depth=1) card:
      // - When rightCount is smaller, the stack width is smaller.
      // - We add an extra right-shift that ramps from 0 at depth=1 to full shift at depth=rightCount.
      let extraShift = 0;
      if (rightCount > 1) {
        const fullW = stackOffset(maxStart, STACK_MAX_X, STACK_K); // same reference as left
        const curW = stackOffset(rightCount, STACK_MAX_X, STACK_K);
        const delta = fullW - curW; // >= 0 (positive = shift right)
        const t = (depth - 1) / (rightCount - 1); // 0..1
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
    const y = 18;
    const x = Math.round(overviewBand.startX + i * overviewBand.step);

    const opacity = 1;
    const scale = 1;

    const z = 20_000 + i;

    return { x, y, opacity, scale, z };
  }

  function beginDrag(clientX: number) {
    if (!items.length) return;

    // ✅ any interaction locks hover (only refresh unlocks)
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

      // ✅ wheel interaction also locks hover
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

  const leftCount = spreadStart0;
  const rightCount = Math.max(0, items.length - (spreadEnd0 + 1));

  function toneFor(kind: Item["kind"]) {
    return kind === "manga"
      ? "from-slate-950 via-slate-800 to-slate-700"
      : "from-slate-900 via-slate-950 to-slate-700";
  }

  return (
    <section className="bg-white rounded-xl border border-black px-5 py-5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-600 mt-1">Drag or horizontal scroll</p>
        </div>

        <div className="text-xs text-slate-700 shrink-0">{items.length} items</div>
      </div>

      <div className="mt-4">
        <div
          ref={stageRef}
          className={[
            "relative",
            "rounded-xl border border-black bg-white overflow-hidden",
            "h-[172px]",
            "select-none",
            "cursor-grab active:cursor-grabbing",
          ].join(" ")}
          onMouseDown={(e) => beginDrag(e.clientX)}
          onMouseMove={(e) => moveDrag(e.clientX)}
          onMouseUp={endDrag}
          onMouseLeave={() => {
            endDrag();

            // ✅ only drop hover if NOT locked
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
            // ✅ only drop hover if NOT locked
            if (!hoverLockedRef.current) {
              hoverRef.current = false;
              setHovering(false);
            }
          }}
          onTouchStart={(e) => {
            lockHover();
            beginDrag(e.touches[0]?.clientX ?? 0);
          }}
          onTouchMove={(e) => moveDrag(e.touches[0]?.clientX ?? 0)}
          onTouchEnd={endDrag}
          onWheel={onWheel}
        >
          {/* ✅ Only show the “deck mood” overlays when hovered (or morphing) */}
          {hoverBlend > 0.02 ? (
            <>
              <div
                className="pointer-events-none absolute left-0 top-0 bottom-0 w-[200px] bg-gradient-to-r from-slate-100/70 to-transparent z-10"
                style={{ opacity: hoverBlend }}
              />
              <div
                className="pointer-events-none absolute right-0 top-0 bottom-0 w-[200px] bg-gradient-to-l from-slate-100/70 to-transparent z-10"
                style={{ opacity: hoverBlend }}
              />

              <div
                className="pointer-events-none absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-white to-transparent z-20"
                style={{ opacity: hoverBlend }}
              />
              <div
                className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-white to-transparent z-20"
                style={{ opacity: hoverBlend }}
              />

              {leftCount > 0 ? (
                <div
                  className="absolute left-3 top-3 z-30 rounded-md border border-black bg-white px-2 py-1 shadow-sm"
                  style={{ opacity: hoverBlend }}
                >
                  <span className="text-[11px] font-semibold text-slate-900">{leftCount} left</span>
                </div>
              ) : null}
              {rightCount > 0 ? (
                <div
                  className="absolute right-3 top-3 z-30 rounded-md border border-black bg-white px-2 py-1 shadow-sm"
                  style={{ opacity: hoverBlend }}
                >
                  <span className="text-[11px] font-semibold text-slate-900">{rightCount} right</span>
                </div>
              ) : null}
            </>
          ) : null}

          {/* cards */}
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
                    <div className="absolute inset-0 opacity-[0.10] bg-[linear-gradient(135deg,transparent_0%,white_18%,transparent_40%,white_68%,transparent_100%)]" />
                    <div className="absolute inset-0 opacity-[0.08] bg-[radial-gradient(circle_at_25%_18%,white,transparent_45%),radial-gradient(circle_at_80%_35%,white,transparent_35%)]" />

                    <div className="absolute top-2 right-2 rounded-md border border-black bg-white px-2 py-0.5">
                      <span className="text-[10px] font-semibold text-slate-900">
                        {it.kind === "anime" ? "ANIME" : "MANGA"}
                      </span>
                    </div>

                    <div className="absolute left-0 right-0 bottom-0 p-2 bg-white/92 border-t border-black">
                      <div className="text-[10px] font-semibold text-slate-900 truncate">
                        {it.title}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pointer-events-none absolute left-0 right-0 bottom-6 h-px bg-black/10" />
        </div>
      </div>
    </section>
  );
}
