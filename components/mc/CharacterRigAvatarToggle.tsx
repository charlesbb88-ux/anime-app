"use client";

import Link from "next/link";
import { useState } from "react";
import CharacterRigAvatar from "@/components/mc/CharacterRigAvatar";
import { ZoomIn, ZoomOut, Pencil } from "lucide-react";

type Props = {
    bodyId?: string | null;
    hairId?: string | null;
    torsoId?: string | null;
    bottomsId?: string | null;
    feetId?: string | null;
    handsId?: string | null;
    showEditButton?: boolean;
};

export default function CharacterRigAvatarToggle({
    bodyId,
    hairId,
    torsoId,
    bottomsId,
    feetId,
    handsId,
    showEditButton = false,
}: Props) {
    const [isZoomed, setIsZoomed] = useState(true);

    return (
        <div className="relative w-full max-w-[420px]">
            <CharacterRigAvatar
                isZoomed={isZoomed}
                bodyId={bodyId}
                hairId={hairId}
                torsoId={torsoId}
                bottomsId={bottomsId}
                feetId={feetId}
                handsId={handsId}
            />

            <div className="absolute right-3 top-3 z-20">
                <button
                    type="button"
                    onClick={() => setIsZoomed((prev) => !prev)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/80 backdrop-blur-sm transition hover:bg-black/55"
                    aria-label={isZoomed ? "Zoom out" : "Zoom in"}
                >
                    {isZoomed ? <ZoomOut size={16} /> : <ZoomIn size={16} />}
                </button>
            </div>

            {showEditButton ? (
                <div className="absolute bottom-3 right-3 z-20">
                    <Link
                        href="/edit-mc"
                        className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-black/55"
                    >
                        <Pencil size={14} />
                        Edit
                    </Link>
                </div>
            ) : null}
        </div>
    );
}