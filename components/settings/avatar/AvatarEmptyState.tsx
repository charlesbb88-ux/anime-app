"use client";

import React, { type CSSProperties } from "react";

type Props = {
  checkerboardStyle: CSSProperties;
  inputId: string;
  avatarInitial: string;
};

export default function AvatarEmptyState({
  checkerboardStyle,
  inputId,
  avatarInitial,
}: Props) {
  return (
    <div className="border-b border-slate-200">
      <label
        htmlFor={inputId}
        className="relative w-full h-96 md:h-[28rem] group overflow-hidden flex items-center justify-center cursor-pointer"
        style={checkerboardStyle}
      >
        <div className="relative flex items-center justify-center h-full z-0">
          <div className="w-40 h-40 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
            <span className="text-lg font-semibold text-slate-700">
              {avatarInitial}
            </span>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/50 transition z-10">
          <p className="text-2xl md:text-3xl font-semibold text-white opacity-0 group-hover:opacity-100 transition text-center px-4">
            Drag and drop an image
          </p>
        </div>
      </label>
    </div>
  );
}