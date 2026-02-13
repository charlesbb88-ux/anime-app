"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { CompletionItem } from "@/lib/completions";
type Item = CompletionItem;

type Props = {
  items: Item[];
  onSelect?: (item: Item) => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function stackOffset(depth: number, max: number, k: number) {
  return max * (1 - Math.exp(-depth / k));
}
function toneFor(kind: Item["kind"]) {
  return kind === "manga"
    ? "from-slate-950 via-slate-800 to-slate-700"
    : "from-slate-900 via-slate-950 to-slate-700";
}

export default function CompletionsCarouselRowPhone({ items, onSelect }: Props) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageW, setStageW] = useState(360);

  // per-card refs for fast DOM writes
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // perf: skip redundant style writes
  const lastXRef = useRef<number[]>([]);
  const lastYRef = useRef<number[]>([]);
  const lastScaleRef = useRef<number[]>([]);
  const lastOpacityRef = useRef<number[]>([]);
  const lastZRef = useRef<number[]>([]);
  const lastVisRef = useRef<boolean[]>([]);

  // perf: track drag state changes (optional)
  const lastDraggingRef = useRef<boolean>(false);

  // physics refs
  const targetPosRef = useRef(0);
  const renderPosRef = useRef(0);
  const velRef = useRef(0);

  // 0 = overview, 1 = deck
  const modeBlendRef = useRef(0);
  const modeTargetRef = useRef(0);

  // drag refs
  const draggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartPosRef = useRef(0);

  // pointer + gesture direction lock
  const pointerIdRef = useRef<number | null>(null);
  const gestureModeRef = useRef<"unknown" | "drag" | "scroll">("unknown");
  const gestureStartXRef = useRef(0);
  const gestureStartYRef = useRef(0);

  // click vs drag
  const pressXRef = useRef(0);
  const pressYRef = useRef(0);
  const movedRef = useRef(false);
  const CLICK_SLOP_PX = 6;

  // -------------------------
  // ✅ baseline + sizing
  // -------------------------
  const FIT_W = 900;

  // ✅ REAL phone gutter in *actual pixels*
  const SCREEN_GUTTER_PX = 14;

  const CARD_W = 92;
  const CARD_H = 132;
  const STAGE_H = 160;

  const WINDOW_COUNT = 7;

  const STACK_MAX_X = 150;
  const STACK_K = 22;

  const OVERVIEW_PAD = 18;
  const OVERVIEW_MIN_STEP = 6;
  const OVERVIEW_MAX_STEP = 26;

  const MID_GAP_BASE = 14;

  // feel
  const BASE_DRAG_SENSITIVITY_PX = 120;
  const SPRING_K = 0.18;
  const SPRING_D = 0.74;
  const MAX_VEL = 0.55;
  const SNAP_EPS = 0.002;
  const VEL_EPS = 0.002;
  const DRAG_FOLLOW = 0.42;
  const SNAP_ON_RELEASE = true;

  // ✅ perf knob: how many stacked cards per side we animate in deck mode
  const STACK_DEPTH = 8;

  const maxPos = Math.max(0, items.length - 1);

  // ✅ scale to inner width, not full width
  const innerStageW = Math.max(1, stageW - SCREEN_GUTTER_PX * 2);
  const scale = innerStageW / FIT_W;

  // keep drag feel reasonable
  const DRAG_SENSITIVITY_PX = Math.max(40, BASE_DRAG_SENSITIVITY_PX * scale);

  useEffect(() => {
    cardRefs.current = cardRefs.current.slice(0, items.length);
  }, [items.length]);

  // Keep arrays aligned when items length changes
  useEffect(() => {
    const n = items.length;
    lastXRef.current = lastXRef.current.slice(0, n);
    lastYRef.current = lastYRef.current.slice(0, n);
    lastScaleRef.current = lastScaleRef.current.slice(0, n);
    lastOpacityRef.current = lastOpacityRef.current.slice(0, n);
    lastZRef.current = lastZRef.current.slice(0, n);
    lastVisRef.current = lastVisRef.current.slice(0, n);
  }, [items.length]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? 360;
      setStageW(Math.max(320, Math.floor(w)));
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const overviewBand = useMemo(() => {
    const leftX = OVERVIEW_PAD;
    const rightX = Math.max(leftX, FIT_W - OVERVIEW_PAD - CARD_W);
    const innerW = Math.max(1, rightX - leftX);

    const n = Math.max(1, items.length);
    const rawStep = n <= 1 ? 0 : innerW / (n - 1);
    const step = clamp(rawStep, OVERVIEW_MIN_STEP, OVERVIEW_MAX_STEP);

    const stripW = (n - 1) * step + CARD_W;
    const maxStart = FIT_W - OVERVIEW_PAD - stripW;
    const startX = clamp(leftX, leftX, Math.max(leftX, leftX + Math.max(0, maxStart)));

    return { startX, step };
  }, [items.length]);

  const deckBand = useMemo(() => {
    const EDGE_PAD = STACK_MAX_X + 22;

    const requiredInner = (CARD_W + MID_GAP_BASE) * (WINDOW_COUNT - 1) + CARD_W + 36;
    const requiredDeckW = EDGE_PAD * 2 + requiredInner;

    const DECK_W = Math.max(FIT_W, requiredDeckW);
    const shift = (DECK_W - FIT_W) / 2;

    const innerW = Math.max(1, DECK_W - EDGE_PAD * 2);

    let leftX0 = EDGE_PAD - shift;
    let rightX0 = EDGE_PAD + innerW - CARD_W - shift;

    let midStart0 = leftX0 + 18;
    let midEnd0 = rightX0 - 18;

    const pcStep = (midEnd0 - midStart0) / (WINDOW_COUNT - 1);
    const windowW = pcStep * (WINDOW_COUNT - 1);

    const midStart = (midStart0 + midEnd0 - windowW) / 2;
    const step = pcStep;

    return {
      leftX: leftX0,
      rightX: rightX0,
      midStart,
      midEnd: midStart + windowW,
      step,
    };
  }, [items.length]);

  function layoutDeck(i: number, spreadStart: number, spreadEnd: number) {
    const y = 1;

    let x = deckBand.leftX;
    let opacity = 1;
    let localScale = 1;
    let z = 1;

    const inSpread = i >= spreadStart && i <= spreadEnd;
    const before = i < spreadStart;
    const after = i > spreadEnd;

    if (before) {
      const leftCount = spreadStart;
      const depth = spreadStart - i;
      const ox = stackOffset(depth, STACK_MAX_X, STACK_K);

      let extraShift = 0;
      const maxStart = Math.max(0, items.length - WINDOW_COUNT);
      if (leftCount > 1) {
        const fullW = stackOffset(maxStart, STACK_MAX_X, STACK_K);
        const curW = stackOffset(leftCount, STACK_MAX_X, STACK_K);
        const delta = curW - fullW;
        const t = (depth - 1) / (leftCount - 1);
        extraShift = delta * t;
      }

      x = deckBand.leftX - ox + extraShift;
      opacity = clamp(1 - Math.log1p(depth) * 0.12, 0.18, 1);
      localScale = clamp(1 - Math.log1p(depth) * 0.02, 0.92, 1);
      z = 10_000 - depth;
    } else if (after) {
      const rightCount = Math.max(0, items.length - (spreadEnd + 1));
      const depth = i - spreadEnd;
      const ox = stackOffset(depth, STACK_MAX_X, STACK_K);

      let extraShift = 0;
      const maxStart = Math.max(0, items.length - WINDOW_COUNT);
      if (rightCount > 1) {
        const fullW = stackOffset(maxStart, STACK_MAX_X, STACK_K);
        const curW = stackOffset(rightCount, STACK_MAX_X, STACK_K);
        const delta = fullW - curW;
        const t = (depth - 1) / (rightCount - 1);
        extraShift = delta * t;
      }

      x = deckBand.rightX + ox + extraShift;
      opacity = clamp(1 - Math.log1p(depth) * 0.12, 0.18, 1);
      localScale = clamp(1 - Math.log1p(depth) * 0.02, 0.92, 1);
      z = 10_000 - depth;
    } else if (inSpread) {
      const slot = i - spreadStart;
      x = deckBand.midStart + slot * deckBand.step;
      z = 50_000 + slot;
    }

    return { x, y, opacity, localScale, z };
  }

  function layoutOverview(i: number) {
    const y = 1;
    const x = Math.round(overviewBand.startX + i * overviewBand.step);
    return { x, y, opacity: 1, localScale: 1, z: 20_000 + i };
  }

  function notePress(x: number, y: number) {
    pressXRef.current = x;
    pressYRef.current = y;
    movedRef.current = false;
  }
  function noteMove(x: number, y: number) {
    const dx = x - pressXRef.current;
    const dy = y - pressYRef.current;
    if (Math.abs(dx) > CLICK_SLOP_PX || Math.abs(dy) > CLICK_SLOP_PX) movedRef.current = true;
  }
  function maybeClick(it: Item) {
    if (movedRef.current) return;
    onSelect?.(it);
  }

  function engageDeckMode() {
    modeTargetRef.current = 1;
  }

  function beginDrag(clientX: number) {
    if (!items.length) return;
    draggingRef.current = true;
    dragStartXRef.current = clientX;
    dragStartPosRef.current = targetPosRef.current;
    velRef.current *= 0.35;
  }

  function moveDrag(clientX: number) {
    if (!draggingRef.current) return;
    const dx = clientX - dragStartXRef.current;
    const next = dragStartPosRef.current + dx / DRAG_SENSITIVITY_PX;
    targetPosRef.current = clamp(next, 0, maxPos);
  }

  function endDrag() {
    if (!draggingRef.current) return;
    draggingRef.current = false;

    if (SNAP_ON_RELEASE) {
      targetPosRef.current = clamp(Math.round(targetPosRef.current), 0, maxPos);
    }

    gestureModeRef.current = "unknown";
  }

  useEffect(() => {
    let raf = 0;

    const tick = () => {
      const mt = modeTargetRef.current;
      const mb = modeBlendRef.current;
      modeBlendRef.current = mb + (mt - mb) * 0.18;

      const x = renderPosRef.current;
      const v = velRef.current;

      const t = targetPosRef.current;
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

      const baseIndex = Math.floor(nextX);
      const frac = clamp(nextX - baseIndex, 0, 1);

      const maxStart = Math.max(0, items.length - WINDOW_COUNT);

      const spreadStart0 = clamp(maxStart - baseIndex, 0, maxStart);
      const spreadStart1 = clamp(maxStart - (baseIndex + 1), 0, maxStart);

      const spreadEnd0 = spreadStart0 + WINDOW_COUNT - 1;
      const spreadEnd1 = spreadStart1 + WINDOW_COUNT - 1;

      const hb = modeBlendRef.current;

      const draggingNow = draggingRef.current;
      lastDraggingRef.current = draggingNow;

      // ✅ PERF: only animate “active” cards once we’re in deck mode.
      // active = window + limited stacks on each side
      let writeStart = 0;
      let writeEnd = items.length - 1;

      if (hb > 0.15 && items.length > 0) {
        const spreadStart = Math.min(spreadStart0, spreadStart1);
        const spreadEnd = Math.max(spreadEnd0, spreadEnd1);

        writeStart = clamp(spreadStart - STACK_DEPTH, 0, items.length - 1);
        writeEnd = clamp(spreadEnd + STACK_DEPTH, 0, items.length - 1);

        // hide everything outside active range
        for (let i = 0; i < items.length; i++) {
          const wantVisible = i >= writeStart && i <= writeEnd;
          const lastVis = lastVisRef.current[i];

          if (lastVis === wantVisible) continue;

          const el = cardRefs.current[i];
          if (!el) continue;

          el.style.visibility = wantVisible ? "visible" : "hidden";
          lastVisRef.current[i] = wantVisible;
        }
      } else {
        // in overview/blend-up: keep all visible
        for (let i = 0; i < items.length; i++) {
          if (lastVisRef.current[i] !== true) {
            const el = cardRefs.current[i];
            if (el) el.style.visibility = "visible";
            lastVisRef.current[i] = true;
          }
        }
      }

      for (let i = writeStart; i <= writeEnd; i++) {
        const el = cardRefs.current[i];
        if (!el) continue;

        const o = layoutOverview(i);

        const a = layoutDeck(i, spreadStart0, spreadEnd0);
        const b = layoutDeck(i, spreadStart1, spreadEnd1);

        const hx = lerp(a.x, b.x, frac);
        const hy = a.y;
        const hopacity = lerp(a.opacity, b.opacity, frac);
        const hlocalScale = lerp(a.localScale, b.localScale, frac);
        const hz = Math.round(lerp(a.z, b.z, frac));

        const x2 = lerp(o.x, hx, hb);
        const y2 = lerp(o.y, hy, hb);
        const opacity = lerp(o.opacity, hopacity, hb);
        const totalScale = lerp(o.localScale, hlocalScale, hb);
        const z = Math.round(lerp(o.z, hz, hb));

        // keep opacity stable while dragging
        const finalOpacity = draggingNow ? 1 : opacity;

        // IMPORTANT: add the gutter AFTER scaling
        const pxX = Math.round(x2 * scale) + SCREEN_GUTTER_PX;
        const pxY = Math.round(y2 * scale);
        const qScale = Math.round(totalScale * 1000) / 1000;
        const qOpacity = Math.round(finalOpacity * 1000) / 1000;

        const lastX = lastXRef.current[i];
        const lastY = lastYRef.current[i];
        const lastS = lastScaleRef.current[i];
        const lastO = lastOpacityRef.current[i];
        const lastZ = lastZRef.current[i];

        if (lastX !== pxX || lastY !== pxY || lastS !== qScale) {
          el.style.transform = `translate3d(${pxX}px, ${pxY}px, 0) scale(${qScale})`;
          lastXRef.current[i] = pxX;
          lastYRef.current[i] = pxY;
          lastScaleRef.current[i] = qScale;
        }

        if (lastZ !== z) {
          el.style.zIndex = String(z);
          lastZRef.current[i] = z;
        }

        if (lastO !== qOpacity) {
          el.style.opacity = String(qOpacity);
          lastOpacityRef.current[i] = qOpacity;
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [items.length, maxPos, deckBand, overviewBand, scale, DRAG_SENSITIVITY_PX]);

  return (
    <section className="w-full">
      <div className="mt-1">
        <div
          ref={stageRef}
          className="relative w-full overflow-visible select-none"
          style={{
            height: Math.round(STAGE_H * scale),
            touchAction: "pan-y",
          }}
          onPointerDown={(e) => {
            const el = stageRef.current;
            if (!el) return;

            pointerIdRef.current = e.pointerId;
            el.setPointerCapture(e.pointerId);

            gestureModeRef.current = "unknown";
            gestureStartXRef.current = e.clientX;
            gestureStartYRef.current = e.clientY;

            notePress(e.clientX, e.clientY);
            engageDeckMode();
            beginDrag(e.clientX);
          }}
          onPointerMove={(e) => {
            if (pointerIdRef.current !== e.pointerId) return;

            noteMove(e.clientX, e.clientY);

            if (gestureModeRef.current === "unknown") {
              const dx = e.clientX - gestureStartXRef.current;
              const dy = e.clientY - gestureStartYRef.current;

              if (Math.abs(dx) > Math.abs(dy) + 2) gestureModeRef.current = "drag";
              else if (Math.abs(dy) > Math.abs(dx) + 2) gestureModeRef.current = "scroll";
            }

            if (gestureModeRef.current === "drag") {
              e.preventDefault();
              moveDrag(e.clientX);
            } else {
              draggingRef.current = false;
            }
          }}
          onPointerUp={(e) => {
            if (pointerIdRef.current !== e.pointerId) return;
            pointerIdRef.current = null;
            endDrag();
          }}
          onPointerCancel={(e) => {
            if (pointerIdRef.current !== e.pointerId) return;
            pointerIdRef.current = null;
            endDrag();
          }}
          role="group"
          aria-label="Completions carousel"
        >
          <div className="absolute inset-0">
            {items.map((it, i) => {
              const tone = toneFor(it.kind);

              return (
                <div
                  key={it.id}
                  ref={(node) => {
                    cardRefs.current[i] = node;
                  }}
                  className="absolute"
                  style={{
                    width: Math.round(CARD_W * scale),
                    height: Math.round(CARD_H * scale),
                    willChange: "transform",
                    backfaceVisibility: "hidden",
                    transformStyle: "preserve-3d",
                  }}
                  onClick={() => maybeClick(it)}
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
