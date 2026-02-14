"use client";

import React, { type CSSProperties } from "react";
import Cropper, { type Area } from "react-easy-crop";

type Props = {
  checkerboardStyle: CSSProperties;

  image: string;
  crop: { x: number; y: number };
  zoom: number;

  onCropChange: (next: { x: number; y: number }) => void;
  onZoomChange: (next: number) => void;
  onCropComplete: (croppedArea: Area, croppedAreaPixels: Area) => void;

  croppedPreview: string | null;
  avatarInitial: string;
  username: string;
};

export default function AvatarCropWorkspace({
  checkerboardStyle,
  image,
  crop,
  zoom,
  onCropChange,
  onZoomChange,
  onCropComplete,
  croppedPreview,
  avatarInitial,
  username,
}: Props) {
  return (
    <div className="flex flex-col md:flex-row">
      {/* LEFT: crop workspace */}
      <div className="md:w-2/3 border-b md:border-b-0 md:border-r border-slate-200">
        <div
          className="relative w-full h-96 md:h-[28rem] overflow-hidden"
          style={checkerboardStyle}
        >
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={1}
            showGrid={false}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropComplete}
            cropShape="round"
          />
        </div>
      </div>

      {/* RIGHT: live preview */}
      <div className="md:w-1/3 flex items-center justify-center px-6 py-6">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden mx-auto">
            {croppedPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={croppedPreview}
                alt="Avatar preview"
                className="w-full h-full object-cover"
              />
            ) : image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image}
                alt="Avatar preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-lg font-semibold text-slate-700">
                {avatarInitial}
              </span>
            )}
          </div>

          <p className="text-xs font-semibold text-slate-900">{username}</p>
          <p className="text-[11px] text-slate-500">
            This is how your avatar will appear.
          </p>
        </div>
      </div>
    </div>
  );
}