"use client";

import { useEffect, useState } from "react";

type IndicatorAlign = "left" | "right";

type IndicatorSide = {
  avatarUrl: string | null;
  username: string;
  align: IndicatorAlign;
};

export type DeviceType = "desktop" | "mobile-portrait" | "mobile-landscape";

type WrapperRefSetter = (node: HTMLDivElement | null) => void;

type Props = {
  left: IndicatorSide;
  right: IndicatorSide;
  deviceType: DeviceType;
  leftWrapperRef?: WrapperRefSetter;
  rightWrapperRef?: WrapperRefSetter;
};

export function getIndicatorMetrics(deviceType: DeviceType) {
  const isPortrait = deviceType === "mobile-portrait";
  const isLandscape = deviceType === "mobile-landscape";

  const avatarSize = isPortrait ? 15 : isLandscape ? 22 : 27;
  const arrowWidth = isPortrait ? 8 : isLandscape ? 8 : 10;
  const arrowHeight = isPortrait ? 4 : isLandscape ? 4 : 5;
  const avatarArrowGap = isPortrait ? 1 : 2;
  const headOffset = isPortrait ? 50 : isLandscape ? 135 : 190;

  return {
    avatarSize,
    arrowWidth,
    arrowHeight,
    avatarArrowGap,
    headOffset,
  };
}

export function detectIndicatorDeviceType(): DeviceType {
  if (typeof window === "undefined") return "desktop";

  const w = window.innerWidth;
  const h = window.innerHeight;
  const isLandscape = w > h;

  const isTouchDevice =
    "ontouchstart" in window || navigator.maxTouchPoints > 0;

  const looksLikePhone = isTouchDevice && (w <= 950 || h <= 500);

  if (!looksLikePhone) return "desktop";
  if (isLandscape) return "mobile-landscape";
  return "mobile-portrait";
}

export function useIndicatorDeviceType() {
  const [deviceType, setDeviceType] = useState<DeviceType>(() =>
    detectIndicatorDeviceType()
  );

  useEffect(() => {
    const update = () => {
      setDeviceType(detectIndicatorDeviceType());
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return deviceType;
}

function FighterIndicatorVisual({
  avatarUrl,
  username,
  align,
  deviceType,
}: {
  avatarUrl: string | null;
  username: string;
  align: IndicatorAlign;
  deviceType: DeviceType;
}) {
  const isRight = align === "right";

  const hudGradient = isRight
    ? "linear-gradient(180deg, #ff6565 0%, #ff4747 38%, #ce2323 100%)"
    : "linear-gradient(180deg, #55bbff 0%, #31adff 38%, #1f6fc6 100%)";

  const arrowColor = isRight ? "#ff4747" : "#31adff";

  const { avatarSize, arrowWidth, arrowHeight, avatarArrowGap } =
    getIndicatorMetrics(deviceType);

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: -avatarSize / 2,
        top: -(avatarSize + arrowHeight),
        width: avatarSize,
        zIndex: 30,
      }}
      aria-hidden="true"
    >
      <div className="flex flex-col items-center">
        <div
          className="overflow-hidden rounded-full"
          style={{
            width: avatarSize,
            height: avatarSize,
            background: hudGradient,
            padding: 3,
          }}
          title={username}
        >
          <div className="h-full w-full overflow-hidden rounded-full bg-black">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={`${username} marker`}
                className="h-full w-full object-cover"
                draggable={false}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-neutral-800 text-[11px] font-bold uppercase text-white">
                {username.slice(0, 1)}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: `${arrowWidth / 2}px solid transparent`,
            borderRight: `${arrowWidth / 2}px solid transparent`,
            borderTop: `${arrowHeight}px solid ${arrowColor}`,
            filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.6))",
            marginTop: avatarArrowGap,
          }}
        />
      </div>
    </div>
  );
}

export default function McBattleFighterIndicators({
  left,
  right,
  deviceType,
  leftWrapperRef,
  rightWrapperRef,
}: Props) {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        ref={leftWrapperRef}
        className="absolute left-0 top-0 pointer-events-none"
        style={{
          width: 0,
          height: 0,
          transform: "translate3d(-9999px,-9999px,0)",
          willChange: "transform",
          zIndex: 30,
        }}
        aria-hidden="true"
      >
        <FighterIndicatorVisual
          avatarUrl={left.avatarUrl}
          username={left.username}
          align={left.align}
          deviceType={deviceType}
        />
      </div>

      <div
        ref={rightWrapperRef}
        className="absolute left-0 top-0 pointer-events-none"
        style={{
          width: 0,
          height: 0,
          transform: "translate3d(-9999px,-9999px,0)",
          willChange: "transform",
          zIndex: 30,
        }}
        aria-hidden="true"
      >
        <FighterIndicatorVisual
          avatarUrl={right.avatarUrl}
          username={right.username}
          align={right.align}
          deviceType={deviceType}
        />
      </div>
    </div>
  );
}