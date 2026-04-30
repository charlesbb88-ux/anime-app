"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const slides = [
    {
        title: "Search for any anime or manga",
        text: "Use search to find a series you have watched, read, or want to track.",
        video: "/tutorial/search.mp4",
    },
    {
        title: "Log or review it",
        text: "Open a title, then log your progress and write a review from the title page. You can also log without a review. You can log an entire series from the main page or individual episodes/chapters.",
        video: "/tutorial/log-review.mp4",
    },
    {
        title: "Check your Journal and Completions",
        text: "Your Journal keeps your log history, while Completions shows the progress for all your anime and manga.",
        video: "/tutorial/journal-completions.mp4",
    },
    {
        title: "Visit your MC page",
        text: "Gain account XP for logging, writing reveiws, and rating your anime and manga. Your MC grows based on what you watch, read, log, and complete. You watch a lot of magic anime? Your MC will unlock magic abilites. You read a lot of assassin manga? Your MC will unlocks assassin clothing. (Customization coming soon.) You can also challenge other users on the site to a battle.",
        video: "/tutorial/mc-page.mp4",
    },
];

export default function OnboardingTutorialModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(0);

    useEffect(() => {
        async function checkTutorialStatus() {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) return;

            const { data, error } = await supabase
                .from("profiles")
                .select("has_seen_tutorial")
                .eq("id", user.id)
                .single();

            if (error) {
                console.error("Error checking tutorial status:", error);
                return;
            }

            if (!data?.has_seen_tutorial) {
                setIsOpen(true);
            }
        }

        checkTutorialStatus();
    }, []);

    async function closeTutorial() {
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (user) {
            const { error } = await supabase
                .from("profiles")
                .update({ has_seen_tutorial: true })
                .eq("id", user.id);

            if (error) {
                console.error("Error saving tutorial status:", error);
            }
        }

        setIsOpen(false);
    }

    function goNext() {
        if (currentSlide === slides.length - 1) {
            closeTutorial();
            return;
        }

        setCurrentSlide((prev) => prev + 1);
    }

    function goBack() {
        setCurrentSlide((prev) => Math.max(prev - 1, 0));
    }

    if (!isOpen) return null;

    const slide = slides[currentSlide];

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-[520px] sm:max-w-[600px] md:max-w-[720px] overflow-hidden rounded-[10px] border-[3px] border-black bg-white shadow-[6px_6px_0px_#000]">
                <div className="border-b-[3px] border-black bg-[#f3f4f6] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-black uppercase tracking-wide text-black">
                            Welcome to INKBASED
                        </p>

                        <button
                            onClick={closeTutorial}
                            className="text-xs font-bold text-neutral-500 hover:text-black"
                        >
                            Skip
                        </button>
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full border border-black bg-white">
                        <div
                            className="h-full bg-black transition-all"
                            style={{
                                width: `${((currentSlide + 1) / slides.length) * 100}%`,
                            }}
                        />
                    </div>
                </div>

                <div className="p-4">
                    <div className="aspect-video overflow-hidden rounded-[6px] border-[2px] border-black bg-neutral-100">
                        <video
                            key={slide.video}
                            src={slide.video}
                            autoPlay
                            muted
                            loop
                            playsInline
                            className="h-full w-full object-cover"
                        />
                    </div>

                    <div className="mt-4">
                        <h2 className="text-2xl font-black leading-tight text-black">
                            {slide.title}
                        </h2>

                        {slide.title === "Visit your MC page" ? (
                            <>
                                <p className="mt-2 text-sm font-medium leading-relaxed text-neutral-700">
                                    Gain account XP for logging, writing reviews, and rating your anime and manga. Your MC grows based on what you watch, read, log, and complete.
                                </p>

                                <p className="mt-2 text-sm font-medium leading-relaxed text-neutral-700">
                                    You watch a lot of magic anime? Your MC will unlock magic abilities. You read a lot of assassin manga? Your MC will unlock assassin clothing.{" "}
                                    <span className="italic text-neutral-500">(Customization coming soon.)</span>{" "}
                                    You can also challenge other users on the site to a battle.
                                </p>
                            </>
                        ) : (
                            <p className="mt-2 text-sm font-medium leading-relaxed text-neutral-700">
                                {slide.text}
                            </p>
                        )}

                        {slide.title === "Visit your MC page" ? (
                            <div className="mt-4 border-[2px] rounded border-black bg-white px-3 py-3">
                                <div className="mb-2 text-xs font-black uppercase tracking-wide text-black">
                                    XP per action
                                </div>

                                <div className="space-y-2 text-sm text-black">
                                    <div className="flex items-center justify-between border-b border-black pb-1">
                                        <span>Followers</span>
                                        <span className="font-black">+5 XP</span>
                                    </div>

                                    <div className="flex items-center justify-between border-b border-black pb-1">
                                        <span>Logs</span>
                                        <span className="font-black">+8 XP</span>
                                    </div>

                                    <div className="flex items-center justify-between border-b border-black pb-1">
                                        <span>Ratings</span>
                                        <span className="font-black">+2 XP</span>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <span>Reviews</span>
                                        <span className="font-black">+20 XP</span>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-3">
                        <button
                            onClick={goBack}
                            disabled={currentSlide === 0}
                            className="rounded-[5px] border-[2px] border-black bg-white px-4 py-2 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Back
                        </button>

                        <button
                            onClick={goNext}
                            className="rounded-[5px] border-[2px] border-black bg-black px-5 py-2 text-sm font-black text-white hover:bg-neutral-800"
                        >
                            {currentSlide === slides.length - 1
                                ? "Start using INKBASED"
                                : "Next"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}