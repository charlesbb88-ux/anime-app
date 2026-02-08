// components/profile/ProfileTopNav.tsx
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo } from "react";

type Props = {
  username: string;
  avatarUrl: string | null;
  bio?: string | null;
  activeTab?:
  | "posts"
  | "watchlist"
  | "activity"
  | "journal"
  | "library"
  | "completions";
};

export default function ProfileTopNav({ username, avatarUrl, bio, activeTab }: Props) {
  const router = useRouter();

  const avatarInitial = useMemo(() => {
    const u = username?.trim();
    return u && u.length > 0 ? u.charAt(0).toUpperCase() : "?";
  }, [username]);

  const baseProfilePath = `/${username}`;

  function tabClass(isActive: boolean) {
    return `pb-.5 ${isActive ? "border-b-2 border-black text-black" : "text-slate-500 hover:text-black"
      }`;
  }

  const currentTab = useMemo(() => {
    if (activeTab) return activeTab;

    const path = router.asPath.split("?")[0].split("#")[0];

    if (path === baseProfilePath) return "posts";

    if (path.startsWith(baseProfilePath + "/")) {
      const seg = path.slice((baseProfilePath + "/").length).split("/")[0];

      if (
        seg === "watchlist" ||
        seg === "activity" ||
        seg === "journal" ||
        seg === "library" ||
        seg === "completions"
      ) {
        return seg;
      }
    }

    return "posts";
  }, [activeTab, router.asPath, baseProfilePath]);

  return (
    <div className="mb-6 border-b border-black pb-4">
      <div className="flex items-start justify-between gap-6">
        {/* Left: avatar + username */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-black ring-1 ring-black flex items-center justify-center overflow-hidden shrink-0">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-semibold text-slate-200">{avatarInitial}</span>
            )}
          </div>

          <div className="min-w-0">
            <div className="text-base font-semibold text-slate-900 truncate mt-4">
              @{username}
            </div>
          </div>
        </div>

        {/* Right: tabs
            ✅ mobile: horizontal scroll (prevents page widening)
            ✅ desktop: behaves like before (tight width, sits on the right)
        */}
        <nav className="mt-4 min-w-0 flex-1 overflow-x-auto whitespace-nowrap [-webkit-overflow-scrolling:touch] md:flex-none md:overflow-visible">
          <div className="flex gap-6 text-sm font-medium w-max md:w-auto">
            <Link href={baseProfilePath} className={tabClass(currentTab === "posts")}>
              Posts
            </Link>

            <Link
              href={`${baseProfilePath}/completions`}
              className={tabClass(currentTab === "completions")}
            >
              Completions
            </Link>

            <Link
              href={`${baseProfilePath}/watchlist`}
              className={tabClass(currentTab === "watchlist")}
            >
              Watchlist
            </Link>

            <Link
              href={`${baseProfilePath}/activity`}
              className={tabClass(currentTab === "activity")}
            >
              Activity
            </Link>

            <Link
              href={`${baseProfilePath}/journal`}
              className={tabClass(currentTab === "journal")}
            >
              Journal
            </Link>

            <Link
              href={`${baseProfilePath}/library`}
              className={tabClass(currentTab === "library")}
            >
              My Library
            </Link>
          </div>
        </nav>
      </div>
    </div>
  );
}
