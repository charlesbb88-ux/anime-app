"use client";

import React, { type CSSProperties, useState } from "react";

type Props = {
  checkerboardStyle: CSSProperties;
  inputId: string;
  avatarInitial: string;

  // ✅ NEW
  onFileSelected: (file: File | null) => void;
};

export default function AvatarEmptyState({
  checkerboardStyle,
  inputId,
  avatarInitial,
  onFileSelected,
}: Props) {
  const [isDragging, setIsDragging] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0] || null;
    if (!file) return;

    // only accept images
    if (!file.type.startsWith("image/")) return;

    onFileSelected(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Needed or the drop won't fire in most browsers
    e.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  return (
    <div className="border-b border-slate-200">
      <label
        htmlFor={inputId}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
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

        <div
          className={`pointer-events-none absolute inset-0 flex items-center justify-center transition z-10 ${
            isDragging ? "bg-black/60" : "bg-black/0 group-hover:bg-black/50"
          }`}
        >
          <p
            className={`text-2xl md:text-3xl font-semibold text-white transition text-center px-4 ${
              isDragging ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
          >
            Drag and drop an image
          </p>
        </div>
      </label>
    </div>
  );
}