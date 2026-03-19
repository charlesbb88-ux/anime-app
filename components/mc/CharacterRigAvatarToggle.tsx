"use client";

import { useState } from "react";
import CharacterRigAvatar from "@/components/mc/CharacterRigAvatar";
import { ZoomIn, ZoomOut } from "lucide-react";

export default function CharacterRigAvatarToggle() {
    const [isZoomed, setIsZoomed] = useState(true);

    return (
        <div className="relative w-full max-w-[420px]">
            <CharacterRigAvatar isZoomed={isZoomed} />

            <div className="absolute right-3 top-3 z-20">
                <button
                    type="button"
                    onClick={() => setIsZoomed((prev) => !prev)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/80 backdrop-blur-sm transition hover:bg-black/55"
                >
                    {isZoomed ? <ZoomOut size={16} /> : <ZoomIn size={16} />}
                </button>
            </div>
        </div>
    );
}