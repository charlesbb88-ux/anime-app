// pages/[username].tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";

import ProfileUserLeftSidebarRecentActivity from "@/components/profile/ProfileUserLeftSidebarRecentActivity";
import RightSidebar from "../components/RightSidebar";
import FeedShell from "../components/FeedShell";

import ProfileAboutSection from "@/components/profile/ProfileAboutSection";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ProfilePostsFeed from "@/components/profile/ProfilePostsFeed";

import { useProfileByUsername } from "@/lib/hooks/useProfileByUsername";

import ProfileFollowsModal from "@/components/profile/ProfileFollowsModal";
import ProfileTabsRow from "@/components/profile/ProfileTabsRow";

const LAYOUT = {
  pageMaxWidth: "72rem",
  pagePaddingY: "2rem",
  pagePaddingX: "1rem",
  columnGap: "1rem",
  mainWidth: "36rem",
  sidebarWidth: "16rem",
};

// phone-only breakpoint (iPads/tablets keep sidebars)
const PHONE_MAX_WIDTH_PX = 767;

function useIsPhone() {
  const [isPhone, setIsPhone] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${PHONE_MAX_WIDTH_PX}px)`);
    const update = () => setIsPhone(mq.matches);
    update();

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    } else {
      mq.addListener(update);
      return () => mq.removeListener(update);
    }
  }, []);

  return isPhone;
}

function getFirstQueryParam(param: string | string[] | undefined) {
  if (typeof param === "string") return param;
  if (Array.isArray(param)) return param[0] ?? "";
  return "";
}

export default function UserProfilePage() {
  const router = useRouter();
  const rawUsername = getFirstQueryParam(router.query.username as any);

  const isPhone = useIsPhone();

  const [currentUser, setCurrentUser] = useState<any | null>(null);

  const [followsOpen, setFollowsOpen] = useState(false);
  const [followsTab, setFollowsTab] = useState<"followers" | "following">("followers");

  const normalizedUsername = useMemo(() => {
    return (rawUsername?.trim?.() ?? "").trim();
  }, [rawUsername]);

  const unameLower = useMemo(() => {
    const u = normalizedUsername.trim();
    return u ? u.toLowerCase() : "";
  }, [normalizedUsername]);

  const { profile, loadingProfile, notFound } = useProfileByUsername(unameLower);

  const canonicalHandle = useMemo(() => {
    return profile?.username?.trim()?.toLowerCase() || undefined;
  }, [profile?.username]);

  const displayName = useMemo(() => {
    return profile?.username ? `@${profile.username}` : "@user";
  }, [profile?.username]);

  const avatarInitial = useMemo(() => {
    const u = profile?.username?.trim();
    return u && u.length > 0 ? u.charAt(0).toUpperCase() : "?";
  }, [profile?.username]);

  const isOwner = useMemo(() => {
    if (!currentUser?.id) return false;
    if (!profile?.id) return false;
    return currentUser.id === profile.id;
  }, [currentUser?.id, profile?.id]);

  const openFollowers = () => {
    setFollowsTab("followers");
    setFollowsOpen(true);
  };

  const openFollowing = () => {
    setFollowsTab("following");
    setFollowsOpen(true);
  };

  // -------------------------------
  // Auth
  // -------------------------------
  useEffect(() => {
    let cancelled = false;

    supabase.auth.getUser().then(({ data, error }) => {
      if (cancelled) return;
      if (error) setCurrentUser(null);
      else setCurrentUser(data.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (cancelled) return;
      setCurrentUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  if (loadingProfile) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-slate-600">Loading…</p>
      </main>
    );
  }

  if (notFound || !profile) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="bg-white shadow-sm rounded-xl px-6 py-5">
          <p className="text-lg font-semibold text-slate-800 mb-2">User not found</p>
          <p className="text-sm text-slate-500">
            We couldn’t find a profile for <span className="font-mono">@{normalizedUsername}</span>.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <ProfileHeader
        isOwner={isOwner}
        viewerUserId={currentUser?.id ?? null}
        profileId={profile.id}
        username={profile.username}
        avatarUrl={profile.avatar_url}
        backdropUrl={profile.backdrop_url}
        backdropPosX={profile.backdrop_pos_x}
        backdropPosY={profile.backdrop_pos_y}
        backdropZoom={profile.backdrop_zoom}
        followersCount={profile.followers_count ?? 0}
        followingCount={profile.following_count ?? 0}
        onFollowersClick={openFollowers}
        onFollowingClick={openFollowing}
        activeTab="posts"
      />

      {/* ✅ Same 3-column layout as index */}
      <div
        style={{
          minHeight: "100vh",
          fontFamily: "system-ui, sans-serif",
          overflowX: isPhone ? "hidden" : undefined,

          // ✅ Create a stacking context for the page body below the header
          position: "relative",
          zIndex: 0,
        }}
      >
        <div
          style={{
            maxWidth: LAYOUT.pageMaxWidth,
            margin: "0 auto",
            padding: isPhone ? `0 0` : `${LAYOUT.pagePaddingY} ${LAYOUT.pagePaddingX}`,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: LAYOUT.columnGap,
              minWidth: 0,
            }}
          >
            {!isPhone && (
              <aside
                style={{
                  flex: `0 0 ${LAYOUT.sidebarWidth}`,
                  maxWidth: LAYOUT.sidebarWidth,
                  position: "sticky",
                  top: "1.5rem",
                  alignSelf: "flex-start",
                  height: "fit-content",
                }}
              >
                <ProfileUserLeftSidebarRecentActivity profileId={profile.id} />
              </aside>
            )}

            <main
              style={
                isPhone
                  ? {
                    flex: "1 1 auto",
                    width: "100%",
                    maxWidth: "100%",
                    minWidth: 0,

                    // ✅ Keep center column above any header overlay/gradient
                    position: "relative",
                    zIndex: 10,
                  }
                  : {
                    flex: `0 0 ${LAYOUT.mainWidth}`,
                    maxWidth: LAYOUT.mainWidth,

                    // ✅ Keep center column above any header overlay/gradient
                    position: "relative",
                    zIndex: 10,
                  }
              }
            >
              {isPhone ? (
                <>
                  <ProfileTabsRow
                    username={profile.username}
                    activeTab="posts"
                    className="mb-4"
                    variant="card"
                    center
                  />

                  <ProfileAboutSection html={profile.about_html ?? ""} />
                  <div className="mb-4"></div>

                  <section>
                    <ProfilePostsFeed
                      profileId={profile.id}
                      viewerUserId={currentUser?.id ?? null}
                      displayName={displayName}
                      avatarInitial={avatarInitial}
                      canonicalHandle={canonicalHandle}
                      avatarUrl={profile.avatar_url}
                    />
                  </section>
                </>
              ) : (
                <>
                  <ProfileTabsRow
                    username={profile.username}
                    activeTab="posts"
                    className="mb-4"
                    variant="card"
                    center
                  />

                  <ProfileAboutSection html={profile.about_html ?? ""} />
                  <div className="mb-4"></div>

                  <FeedShell>
                    <section>
                      <ProfilePostsFeed
                        profileId={profile.id}
                        viewerUserId={currentUser?.id ?? null}
                        displayName={displayName}
                        avatarInitial={avatarInitial}
                        canonicalHandle={canonicalHandle}
                        avatarUrl={profile.avatar_url}
                      />
                    </section>
                  </FeedShell>
                </>
              )}

              <ProfileFollowsModal
                open={followsOpen}
                onClose={() => setFollowsOpen(false)}
                profileId={profile.id}
                initialTab={followsTab}
              />
            </main>

            {!isPhone && (
              <aside
                style={{
                  flex: `0 0 ${LAYOUT.sidebarWidth}`,
                  maxWidth: LAYOUT.sidebarWidth,
                  position: "sticky",
                  top: "1.5rem",
                  alignSelf: "flex-start",
                  height: "fit-content",
                }}
              >
                <RightSidebar />
              </aside>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

(UserProfilePage as any).headerTransparent = true;