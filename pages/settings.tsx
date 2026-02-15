// pages/settings.tsx
"use client";

import type { NextPage } from "next";
import Link from "next/link";
import { useState } from "react";

import SettingsProfileTab from "@/components/settings/SettingsProfileTab";
import SettingsAvatarTab from "@/components/settings/SettingsAvatarTab";
import SettingsBannerTab from "@/components/settings/SettingsBannerTab";
import ProfileAboutEditor from "@/components/profile/ProfileAboutEditor";
import { useMyProfile } from "@/lib/hooks/useMyProfile";

type TabKey = "profile" | "about" | "avatar" | "banner";

const SettingsPage: NextPage = () => {
  const { authUser, profile, loading, error, setProfileOptimistic } = useMyProfile();
  const [activeTab, setActiveTab] = useState<TabKey>("profile");

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-slate-600">Loading…</p>
      </main>
    );
  }

  if (!authUser) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="bg-white shadow-sm rounded-xl px-6 py-5 space-y-2">
          <p className="text-sm text-red-500">{error || "You must be logged in to view settings."}</p>
          <Link href="/" className="text-xs text-blue-600 hover:underline">
            Go back home
          </Link>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="bg-white shadow-sm rounded-xl px-6 py-5 space-y-2">
          <p className="text-sm text-red-500">{error || "Could not load your profile."}</p>
          <Link href="/" className="text-xs text-blue-600 hover:underline">
            Go back home
          </Link>
        </div>
      </main>
    );
  }

  const tabLiClass = (tab: TabKey) =>
    [
      "pb-1 text-md font-semibold tracking-wide uppercase border-b-2",
      activeTab === tab
        ? "border-slate-900 text-slate-900"
        : "border-transparent text-slate-400 hover:text-slate-900",
    ].join(" ");

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* HEADER */}
        <header className="mb-6 border-b border-slate-200 pb-3">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold">Account Settings</h1>
          </div>

          <div className="mt-4 flex items-start justify-between gap-4">
            <nav aria-label="Account settings tabs" className="flex-1">
              <ul className="flex flex-wrap gap-6">
                <li className={tabLiClass("profile")}>
                  <button type="button" onClick={() => setActiveTab("profile")} className="focus:outline-none">
                    Profile
                  </button>
                </li>

                <li className={tabLiClass("about")}>
                  <button type="button" onClick={() => setActiveTab("about")} className="focus:outline-none">
                    About
                  </button>
                </li>

                <li className={tabLiClass("avatar")}>
                  <button type="button" onClick={() => setActiveTab("avatar")} className="focus:outline-none">
                    Avatar
                  </button>
                </li>

                <li className={tabLiClass("banner")}>
                  <button type="button" onClick={() => setActiveTab("banner")} className="focus:outline-none">
                    Banner
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        </header>

        {/* CONTENT */}
        <section className="text-sm">
          <div className="space-y-5">
            {activeTab === "profile" ? (
              <SettingsProfileTab
                profile={profile}
                onUpdated={(next) => setProfileOptimistic(next)}
                onOpenBackdrop={() => setActiveTab("banner")}
              />
            ) : activeTab === "about" ? (
              <ProfileAboutEditor
                initialMarkdown={profile.about_markdown ?? ""}
                onSaved={({ about_markdown, about_html }) => {
                  setProfileOptimistic({
                    ...profile,
                    about_markdown,
                    about_html,
                    about_updated_at: new Date().toISOString(),
                  });
                }}
              />
            ) : activeTab === "avatar" ? (
              <SettingsAvatarTab profile={profile} onUpdated={(next) => setProfileOptimistic(next)} />
            ) : (
              <SettingsBannerTab
                userId={profile.id}
                username={profile.username}
                avatarUrl={profile.avatar_url}
                isActive={activeTab === "banner"}
              />
            )}
          </div>
        </section>
      </div>
    </main>
  );
};

export default SettingsPage;