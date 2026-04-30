"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import {
  Eye,
  Heart,
  List,
  Star,
  CalendarDays,
  Grid3X3,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

export default function LoggedOutHomeIntro() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setIsLoggedIn(!!user);
    }

    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isLoggedIn === null || isLoggedIn) return null;

  return (
    <section className="mb-4 overflow-hidden border border-black bg-white sm:rounded-[5px] sm:border-[3px]">
      <div className="w-full">
        <Image
          src="/overlays/intro-overlay.png"
          alt="INKBASED Intro"
          width={1600}
          height={900}
          priority
          className="block h-auto w-full"
        />
      </div>

      <div className="relative z-10 -mt-10 border-b border-gray-200 px-4 py-5 text-center sm:-mt-20 sm:px-5">
        <h1 className="m-0 text-[1.25rem] font-extrabold leading-tight sm:text-[2.3rem]">
          Track anime and manga you love.
          <br />
          Save the ones you want to start.
          <br />
          Share your thoughts with friends.
        </h1>

        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(
              new CustomEvent("open-auth-modal", { detail: { mode: "signup" } })
            );
          }}
          className="mt-4 inline-flex items-center justify-center rounded-md bg-green-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-green-700 sm:px-8 sm:text-xl"
        >
          Get started — it&apos;s free!
        </button>

        <p className="mx-auto mt-4 max-w-[30rem] text-sm text-gray-600 sm:text-[1.05rem]">
          A social network for anime and manga lovers.
        </p>
      </div>

      <div className="bg-[#14191e] p-1 sm:p-4">
        <div className="mb-3 text-[0.7rem] font-medium uppercase tracking-[0.22em] text-[#b8cbe0]">
          INKBASED lets you...
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          <IntroCard
            icon={<Eye size={34} />}
            text="Keep track of every anime you’ve ever watched and manga you've ever read"
          />

          <IntroCard
            icon={<Heart size={34} />}
            text="Show some love for your favorite anime, manga, and reviews with a “like”"
          />

          <IntroCard
            icon={<List size={34} />}
            text="Write and share reviews, and follow friends and other members to read theirs"
          />

          <IntroCard
            icon={<Star size={38} fill="currentColor" />}
            text="Rate each anime and manga on a five-star scale to record and share your reaction"
          />

          <IntroCard
            icon={<CalendarDays size={34} />}
            text="Keep a journal of your anime watching and manga reading"
          />

          <IntroCard
            icon={
              <Image
                src="/icons/mc-icon-v9.png"
                alt=""
                width={38}
                height={38}
                className="h-[38px] w-[38px] object-contain"
              />
            }
            text="Build your own MC character that evolves based on the anime and manga you track, shaped by the genres and tags you love"
          />
        </div>
      </div>
    </section>
  );
}

function IntroCard({
  icon,
  text,
  active = false,
}: {
  icon: React.ReactNode;
  text: string;
  active?: boolean;
}) {
  return (
    <div
      className={[
        "flex min-h-[6.3rem] items-center gap-3 rounded-[3px] p-3 text-white sm:gap-5 sm:p-5",
        active ? "bg-[#00c833]" : "bg-[#44576a]",
      ].join(" ")}
    >
      <div className="shrink-0 text-[#b8c6d4]">{icon}</div>

      <div className="text-[0.78rem] font-semibold leading-[1.4] sm:text-[0.95rem]">
        {text}
      </div>
    </div>
  );
}