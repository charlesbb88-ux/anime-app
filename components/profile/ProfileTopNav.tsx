"use client";

import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo } from "react";

type Props = {
  username: string;
  avatarUrl: string | null;
  bio?: string | null;
  activeTab?:
    | "posts"
    | "bookmarks"
    | "watchlist"
    | "activity"
    | "journal"
    | "library";
};

export default function ProfileTopNav({ username, avatarUrl, bio, activeTab }: Props) {
  const router = useRouter();

  const avatarInitial = useMemo(() => {
    const u = username?.trim();
    return u && u.length > 0 ? u.charAt(0).toUpperCase() : "?";
  }, [username]);

  const baseProfilePath = `/${username}`;

  function tabClass(isActive: boolean) {
    return `pb-2 ${
      isActive
        ? "border-b-2 border-slate-900 text-slate-900"
        : "text-slate-500 hover:text-slate-800"
    }`;
  }

  function isPathActive(path: string) {
    return router.asPath === path || router.asPath.startsWith(`${path}/`);
  }

  return (
    <div className="mb-6 border-b border-slate-200 pb-4">
      <div className="flex items-center justify-between gap-6">
        {/* Left: avatar + username */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden shrink-0">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-semibold text-slate-700">
                {avatarInitial}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <div className="text-base font-semibold text-slate-900 truncate">
              @{username}
            </div>
          </div>
        </div>

        {/* Right: tabs */}
        <nav className="flex gap-6 text-sm font-medium shrink-0">
          <Link
            href={baseProfilePath}
            className={tabClass(activeTab ? activeTab === "posts" : isPathActive(baseProfilePath))}
          >
            Posts
          </Link>

          <Link
            href={`${baseProfilePath}/bookmarks`}
            className={tabClass(
              activeTab ? activeTab === "bookmarks" : isPathActive(`${baseProfilePath}/bookmarks`)
            )}
          >
            Bookmarks
          </Link>

          <Link
            href={`${baseProfilePath}/watchlist`}
            className={tabClass(
              activeTab ? activeTab === "watchlist" : isPathActive(`${baseProfilePath}/watchlist`)
            )}
          >
            Watchlist
          </Link>

          <Link
            href={`${baseProfilePath}/activity`}
            className={tabClass(
              activeTab ? activeTab === "activity" : isPathActive(`${baseProfilePath}/activity`)
            )}
          >
            Activity
          </Link>

          <Link
            href={`${baseProfilePath}/journal`}
            className={tabClass(
              activeTab ? activeTab === "journal" : isPathActive(`${baseProfilePath}/journal`)
            )}
          >
            Journal
          </Link>

          <Link
            href={`${baseProfilePath}/library`}
            className={tabClass(
              activeTab ? activeTab === "library" : isPathActive(`${baseProfilePath}/library`)
            )}
          >
            My Library
          </Link>
        </nav>
      </div>

      {bio ? (
        <p className="mt-3 text-sm text-slate-800 whitespace-pre-line">
          {bio}
        </p>
      ) : null}
    </div>
  );
}
