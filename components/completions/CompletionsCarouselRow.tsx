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

  // target vs rendered (spring animation)
  const [targetPos, setTargetPos] = useState(0); // 0..(n-1)
  const [renderPos, setRenderPos] = useState(0); // published for layout

  const renderPosRef = useRef(0);
  const velRef = useRef(0);

  // dragging state
  const [dragging, setDragging] = useState(false);
  const dragStartXRef = useRef(0);
  const dragStartPosRef = useRef(0);

  // wheel momentum helper
  const wheelVelRef = useRef(0);
  const wheelRAFRef = useRef<number | null>(null);

  // constants
  const CARD_W = 92;
  const CARD_H = 132;

  // ✅ this is the key fix: we need extra "gutter" because stacks fan outward
  // If stacks push left/right by STACK_MAX_X, we must keep them inside the container.
  const STACK_MAX_X = 150;
  const STACK_K = 22;

  const GUTTER = STACK_MAX_X + 22; // keep outward stacks from getting clipped
  const EDGE_PAD = GUTTER;

  const WINDOW_COUNT = 7;

  // interaction feel
  const DRAG_SENSITIVITY_PX = 120;
  const WHEEL_SENSITIVITY_PX = 160;

  // spring tuning
  const SPRING_K = 0.18;
  const SPRING_D = 0.78;

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

  // spring toward targetPos
  useEffect(() => {
    let raf = 0;

    const tick = () => {
      const x = renderPosRef.current;
      const v = velRef.current;
      const t = targetPos;

      const dx = t - x;
      const nextV = (v + dx * SPRING_K) * SPRING_D;
      const nextX = clamp(x + nextV, 0, maxPos);

      velRef.current = nextV;
      renderPosRef.current = nextX;

      setRenderPos(nextX);

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [targetPos, maxPos]);

  const band = useMemo(() => {
    const innerW = stageW - EDGE_PAD * 2;

    const leftX = EDGE_PAD;
    const rightX = EDGE_PAD + innerW - CARD_W;

    // ✅ spread now lives safely between gutters
    const midStart = leftX + 18;
    const midEnd = rightX - 18;

    const safeMidStart = Math.min(midStart, midEnd);
    const safeMidEnd = Math.max(midStart, midEnd);

    const steps = Math.max(2, WINDOW_COUNT);
    const step = steps === 1 ? 0 : (safeMidEnd - safeMidStart) / (steps - 1);

    return { leftX, rightX, midStart: safeMidStart, midEnd: safeMidEnd, step };
  }, [stageW, EDGE_PAD, WINDOW_COUNT]);

  // ✅ continuous blending between adjacent layouts
  const baseIndex = Math.floor(renderPos);
  const frac = clamp(renderPos - baseIndex, 0, 1);

  const spreadStart0 = clamp(baseIndex, 0, Math.max(0, items.length - WINDOW_COUNT));
  const spreadStart1 = clamp(baseIndex + 1, 0, Math.max(0, items.length - WINDOW_COUNT));

  const spreadEnd0 = spreadStart0 + WINDOW_COUNT - 1;
  const spreadEnd1 = spreadStart1 + WINDOW_COUNT - 1;

  function layoutForIndex(i: number, spreadStart: number, spreadEnd: number) {
    const y = 18; // fixed (no slope)

    let x = band.leftX;
    let opacity = 1;
    let scale = 1;
    let z = 1;

    const inSpread = i >= spreadStart && i <= spreadEnd;
    const before = i < spreadStart;
    const after = i > spreadEnd;

    if (before) {
      const depth = spreadStart - i; // 1..N
      const ox = stackOffset(depth, STACK_MAX_X, STACK_K);

      // ✅ LEFT stack fans OUTWARD (to the left) but stays inside gutter
      x = band.leftX - ox;

      opacity = clamp(1 - Math.log1p(depth) * 0.12, 0.18, 1);
      scale = clamp(1 - Math.log1p(depth) * 0.02, 0.92, 1);
      z = 10_000 - depth;
    } else if (after) {
      const depth = i - spreadEnd; // 1..N
      const ox = stackOffset(depth, STACK_MAX_X, STACK_K);

      // ✅ RIGHT stack fans OUTWARD (to the right) but stays inside gutter
      x = band.rightX + ox;

      opacity = clamp(1 - Math.log1p(depth) * 0.12, 0.18, 1);
      scale = clamp(1 - Math.log1p(depth) * 0.02, 0.92, 1);
      z = 10_000 - depth;
    } else if (inSpread) {
      const slot = i - spreadStart; // 0..WINDOW_COUNT-1
      x = band.midStart + slot * band.step;

      opacity = 1;
      scale = 1;
      z = 50_000 + slot;
    }

    return { x, y, opacity, scale, z };
  }

  function beginDrag(clientX: number) {
    if (!items.length) return;
    setDragging(true);
    dragStartXRef.current = clientX;
    dragStartPosRef.current = targetPos;
  }

  function moveDrag(clientX: number) {
    if (!dragging) return;
    const dx = clientX - dragStartXRef.current;
    const next = dragStartPosRef.current - dx / DRAG_SENSITIVITY_PX;
    setTargetPos(clamp(next, 0, maxPos));
  }

  function endDrag() {
    if (!dragging) return;
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

      wheelVelRef.current += dx / WHEEL_SENSITIVITY_PX;

      if (wheelRAFRef.current == null) {
        const step = () => {
          wheelVelRef.current *= 0.84;

          if (Math.abs(wheelVelRef.current) < 0.001) {
            wheelVelRef.current = 0;
            wheelRAFRef.current = null;

            if (SNAP_ON_RELEASE) {
              setTargetPos((p) => clamp(Math.round(p), 0, maxPos));
            }
            return;
          }

          setTargetPos((p) => clamp(p + wheelVelRef.current, 0, maxPos));
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
          onMouseLeave={endDrag}
          onTouchStart={(e) => beginDrag(e.touches[0]?.clientX ?? 0)}
          onTouchMove={(e) => moveDrag(e.touches[0]?.clientX ?? 0)}
          onTouchEnd={endDrag}
          onWheel={onWheel}
        >
          {/* stack panels */}
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-[200px] bg-gradient-to-r from-slate-100/70 to-transparent z-10" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-[200px] bg-gradient-to-l from-slate-100/70 to-transparent z-10" />

          {/* fades */}
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-white to-transparent z-20" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-white to-transparent z-20" />

          {/* counters */}
          {leftCount > 0 ? (
            <div className="absolute left-3 top-3 z-30 rounded-md border border-black bg-white px-2 py-1 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-900">{leftCount} left</span>
            </div>
          ) : null}
          {rightCount > 0 ? (
            <div className="absolute right-3 top-3 z-30 rounded-md border border-black bg-white px-2 py-1 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-900">{rightCount} right</span>
            </div>
          ) : null}

          {/* cards */}
          <div className="absolute inset-0">
            {items.map((it, i) => {
              const a = layoutForIndex(i, spreadStart0, spreadEnd0);
              const b = layoutForIndex(i, spreadStart1, spreadEnd1);

              const x = lerp(a.x, b.x, frac);
              const y = a.y;
              const opacity = lerp(a.opacity, b.opacity, frac);
              const scale = lerp(a.scale, b.scale, frac);

              const z = Math.round(lerp(a.z, b.z, frac));

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
                    transform: `translate3d(${Math.round(x)}px, ${y}px, 0) scale(${scale})`,
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
