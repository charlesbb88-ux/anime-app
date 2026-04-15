// pages/manga/[slug].tsx

import { useEffect, useMemo, useState } from "react";
import type { NextPage, GetServerSideProps } from "next";
import { useRouter } from "next/router";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";

import EnglishTitle from "@/components/EnglishTitle";

import { supabase } from "@/lib/supabaseClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { pickEnglishTitle } from "@/lib/pickEnglishTitle";

const MangaMetaBox = dynamic(() => import("@/components/manga/MangaMetaBox"), {
  ssr: false,
});

const MangaQuickLogBox = dynamic(
  () => import("@/components/manga/MangaQuickLogBox"),
  { ssr: false }
);

const ChapterNavigator = dynamic(() => import("@/components/ChapterNavigator"), {
  ssr: false,
});

const PostFeed = dynamic(() => import("../../components/PostFeed"), {
  ssr: false,
});

const MangaActionBox = dynamic(
  () => import("@/components/actions/MangaActionBox"),
  { ssr: false }
);

const FeedShell = dynamic(() => import("@/components/FeedShell"), {
  ssr: false,
});

const ResponsiveSwitch = dynamic(() => import("@/components/ResponsiveSwitch"), {
  ssr: false,
});

const MangaPhoneLayout = dynamic(
  () => import("@/components/manga/MangaPhoneLayout"),
  { ssr: false }
);

const GlobalLogModal = dynamic(
  () => import("@/components/reviews/GlobalLogModal"),
  { ssr: false }
);

type Manga = {
  id: string;
  title: string;
  slug: string;
  total_chapters: number | null;
  total_volumes: number | null;
  image_url: string | null;
  banner_image_url: string | null;
  title_english: string | null;
  title_native: string | null;
  title_preferred: string | null;
  description: string | null;
  format: string | null;
  status: string | null;
  season: string | null;
  season_year: number | null;
  start_date: string | null;
  end_date: string | null;
  average_score: number | null;
  source: string | null;
  genres: string[] | null;
  content_rating: string | null;
  content_warnings: string[] | null;
  created_at: string;
};

type MangaTag = {
  id: number;
  manga_id: string;
  name: string;
  description: string | null;
  rank: number | null;
  is_adult: boolean | null;
  is_general_spoiler: boolean | null;
  is_media_spoiler: boolean | null;
  category: string | null;
};

type MangaPageProps = {
  initialBackdropUrl: string | null;
  initialManga: Manga | null;
};

function normalizeBackdropUrl(url: string) {
  if (url.includes("https://image.tmdb.org/t/p/original/")) {
    return url.replace("/t/p/original/", "/t/p/w1280/");
  }
  return url;
}

function cleanSynopsis(raw: string) {
  let s = raw
    .replace(/\r\n/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\(Source:.*?\)/gi, "")
    .replace(/<\/?i>/gi, "")
    .replace(/<[^>]+>/g, "");

  s = s
    .replace(/\n---[\s\S]*$/m, "")
    .replace(/\n\*\*Awards:\*\*[\s\S]*$/m, "")
    .replace(/\n\*\*Additional Links:\*\*[\s\S]*$/m, "");

  s = s.replace(/^\s*[-*_]{3,}\s*$/gm, "");

  return s
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n[ \t]+\n/g, "\n\n")
    .trim();
}

function formatSafetyPill(text: string) {
  return text
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

const MangaPage: NextPage<MangaPageProps> = ({ initialBackdropUrl, initialManga }) => {
  const router = useRouter();

  const [manga] = useState<Manga | null>(initialManga);
  const [tags, setTags] = useState<MangaTag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [showSpoilers, setShowSpoilers] = useState(false);

  const [feedNonce, setFeedNonce] = useState(0);
  const [actionBoxNonce, setActionBoxNonce] = useState(0);

  const [logOpen, setLogOpen] = useState(false);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedChapterNumber, setSelectedChapterNumber] = useState<number | null>(null);
  const [chapterLogsNonce, setChapterLogsNonce] = useState(0);
  const [quickLogRefreshNonce, setQuickLogRefreshNonce] = useState(0);
  const [myMangaSeriesLogCount, setMyMangaSeriesLogCount] = useState<number | null>(
    null
  );

  const quickLogRefreshToken = chapterLogsNonce * 100000 + quickLogRefreshNonce;

  useEffect(() => {
    const mangaId = manga?.id;

    if (!mangaId) {
      setTags([]);
      return;
    }

    let isMounted = true;

    async function fetchTags() {
      setTagsLoading(true);

      const { data, error } = await supabase
        .from("manga_tags")
        .select(
          "id, manga_id, name, description, rank, is_adult, is_general_spoiler, is_media_spoiler, category"
        )
        .eq("manga_id", mangaId)
        .order("rank", { ascending: false });

      if (!isMounted) return;

      if (error || !data) {
        console.error("Error fetching manga_tags", error);
        setTags([]);
      } else {
        setTags(data as MangaTag[]);
      }

      setTagsLoading(false);
    }

    fetchTags();

    return () => {
      isMounted = false;
    };
  }, [manga?.id]);

  useEffect(() => {
    const mangaId = manga?.id;

    if (!mangaId) {
      setMyMangaSeriesLogCount(null);
      return;
    }

    let cancelled = false;

    async function run() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (userError || !user) {
        setMyMangaSeriesLogCount(null);
        return;
      }

      const { count, error } = await supabase
        .from("manga_series_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("manga_id", mangaId);

      if (cancelled) return;

      if (error) {
        console.error("Error fetching manga series log count:", error);
        setMyMangaSeriesLogCount(null);
        return;
      }

      setMyMangaSeriesLogCount(count ?? 0);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [manga?.id]);

  const slug = useMemo(() => {
    const raw = router.query.slug as string | string[] | undefined;
    if (typeof raw === "string") return raw;
    if (Array.isArray(raw) && raw[0]) return raw[0];
    return initialManga?.slug ?? null;
  }, [router.query.slug, initialManga?.slug]);

  if (!manga) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="mb-4 text-2xl font-bold">Manga not found</h1>
        <p className="mb-4 text-gray-400">
          We couldn&apos;t find a manga with that URL.
        </p>
        <Link
          href="/"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          Go back home
        </Link>
      </div>
    );
  }

  const picked = pickEnglishTitle(
    {
      title_english: manga.title_english,
      title_preferred: manga.title_preferred,
      title: manga.title,
      title_native: manga.title_native,
    },
    {
      preferredKeys: ["title_english", "title_preferred", "title"],
      fallbackKeys: ["title_preferred", "title", "title_native", "title_english"],
      minScore: 0.55,
    }
  );

  const displayPrimaryTitle = picked?.value ?? manga.title ?? "Untitled";

  const secondaryTitle =
    typeof manga.title_preferred === "string" &&
    manga.title_preferred.trim() &&
    manga.title_preferred.trim() !== displayPrimaryTitle
      ? manga.title_preferred.trim()
      : null;

  const genres: string[] = Array.isArray(manga.genres) ? manga.genres : [];

  const safetyPills: string[] = [
    ...(typeof manga.content_rating === "string" && manga.content_rating.trim()
      ? [manga.content_rating.trim()]
      : []),
    ...(Array.isArray(manga.content_warnings)
      ? manga.content_warnings.filter(
          (x: unknown): x is string => typeof x === "string" && x.trim().length > 0
        )
      : []),
  ];

  const uniqueSafetyPills = Array.from(new Set(safetyPills));
  const hasAnyTopPills = genres.length > 0 || uniqueSafetyPills.length > 0;

  const spoilerTags = tags.filter(
    (t) => t.is_general_spoiler === true || t.is_media_spoiler === true
  );
  const spoilerCount = spoilerTags.length;

  const desktopView = (
    <div className="mx-auto max-w-6xl px-4 pt-0 pb-8">
      {initialBackdropUrl && (
        <div className="relative h-[620px] w-full overflow-hidden">
          <Image
            src={initialBackdropUrl}
            alt=""
            width={1920}
            height={1080}
            priority
            unoptimized
            sizes="100vw"
            className="h-full w-full object-cover object-[50%_25%]"
          />

          <img
            src="/overlays/my-overlay.png"
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />
        </div>
      )}

      <div className="-mt-5 relative z-10 px-3">
        <div className="mb-8 flex flex-row gap-7">
          <div className="flex-shrink-0 w-56">
            {manga.image_url ? (
              <img
                src={manga.image_url}
                alt={manga.title}
                className="h-84 w-56 rounded-md object-cover border-3 border-black/100"
              />
            ) : (
              <div className="flex h-64 w-56 items-center justify-center rounded-lg bg-gray-800 text-4xl font-bold text-gray-200">
                {manga.title?.[0] ?? "?"}
              </div>
            )}

            {hasAnyTopPills && (
              <div className="mt-4">
                <h2 className="mb-1 text-sm font-semibold text-black-300">Genres</h2>

                <div className="flex flex-wrap gap-2">
                  {genres.map((g) => (
                    <span
                      key={`genre-${g}`}
                      className="rounded-full bg-black px-3 py-1 text-xs text-gray-100"
                    >
                      {g}
                    </span>
                  ))}

                  {uniqueSafetyPills.map((pill) => (
                    <span
                      key={`safety-${pill}`}
                      className="rounded-full bg-red-700 px-3 py-1 text-xs text-white"
                    >
                      {formatSafetyPill(pill)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {tags.length > 0 && (
              <div className="mt-5">
                <div className="mb-1 flex items-center gap-2">
                  <h2 className="text-base font-semibold text-black-300">Tags</h2>
                  {tagsLoading && (
                    <span className="text-[10px] uppercase tracking-wide text-gray-500">
                      Loading…
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex w-full flex-col gap-1">
                    {tags.map((tag) => {
                      const isSpoiler =
                        tag.is_general_spoiler === true ||
                        tag.is_media_spoiler === true;

                      if (isSpoiler && !showSpoilers) return null;

                      const percent =
                        typeof tag.rank === "number"
                          ? Math.max(0, Math.min(100, Math.round(tag.rank)))
                          : null;

                      return (
                        <div key={tag.id} className="group relative inline-flex">
                          <span
                            className="
                              relative inline-flex w-full items-center justify-between
                              rounded-full border border-gray-700 bg-gray-900/80
                              px-3 py-[3px] text-[13px] font-medium
                              whitespace-nowrap overflow-hidden
                            "
                          >
                            {percent !== null && (
                              <span
                                className="pointer-events-none absolute inset-y-0 left-0 bg-black"
                                style={{ width: `${percent}%` }}
                              />
                            )}

                            <span
                              className={`relative ${
                                isSpoiler ? "text-red-400" : "text-gray-100"
                              }`}
                            >
                              {tag.name}
                            </span>

                            {percent !== null && (
                              <span className="relative text-[11px] font-semibold text-gray-200">
                                {percent}%
                              </span>
                            )}
                          </span>

                          {tag.description && (
                            <div
                              className="
                                pointer-events-none absolute left-0 top-full z-20 mt-1 w-64
                                rounded-md bg-black px-3 py-2 text-xs text-gray-100 shadow-lg
                                opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0
                                transition duration-200 delay-150
                              "
                            >
                              {tag.description}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {spoilerCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowSpoilers((prev) => !prev)}
                    className="mt-2 text-sm font-medium text-blue-400 hover:text-blue-300"
                  >
                    {showSpoilers
                      ? `Hide ${spoilerCount} spoiler tag${spoilerCount === 1 ? "" : "s"}`
                      : `Show ${spoilerCount} spoiler tag${spoilerCount === 1 ? "" : "s"}`}
                  </button>
                )}
              </div>
            )}

            <div className="mt-8">
              <MangaMetaBox
                titleEnglish={manga.title_english}
                titlePreferred={manga.title_preferred}
                titleNative={manga.title_native}
                totalVolumes={manga.total_volumes}
                totalChapters={manga.total_chapters}
                format={manga.format}
                status={manga.status}
                startDate={manga.start_date}
                endDate={manga.end_date}
                season={manga.season}
                seasonYear={manga.season_year}
                averageScore={manga.average_score}
              />
            </div>
          </div>

          <div className="min-w-100 flex-1">
            <div className="mb-0 pl-1">
              <EnglishTitle
                as="h1"
                className="text-4xl font-bold leading-tight"
                titles={{
                  title_english: manga.title_english,
                  title_preferred: manga.title_preferred,
                  title: manga.title,
                  title_native: manga.title_native,
                }}
                fallback={manga.title ?? manga.title_native ?? "Untitled"}
              />
            </div>

            <div className="relative w-full">
              <div className="absolute right-0 top-6 flex flex-col items-end gap-2">
                <MangaActionBox
                  key={actionBoxNonce}
                  mangaId={manga.id}
                  onOpenLog={() => {
                    setSelectedChapterId(null);
                    setSelectedChapterNumber(null);
                    setLogOpen(true);
                  }}
                  onShowActivity={() => router.push(`/manga/${manga.slug}/activity`)}
                />

                <MangaQuickLogBox
                  mangaId={manga.id}
                  totalChapters={manga.total_chapters}
                  refreshToken={quickLogRefreshToken}
                  onOpenLog={(chapterId, chapterNumber) => {
                    setSelectedChapterId(chapterId ?? null);
                    setSelectedChapterNumber(
                      typeof chapterNumber === "number" && Number.isFinite(chapterNumber)
                        ? chapterNumber
                        : null
                    );
                    setLogOpen(true);
                  }}
                />
              </div>

              <div className="min-w-0 pr-[270px] pl-1">
                {secondaryTitle && (
                  <h2 className="mt-0 text-xl font-semibold leading-snug text-gray-500">
                    {secondaryTitle}
                  </h2>
                )}

                {typeof manga.description === "string" && manga.description.trim() && (
                  <div className="mt-6 mb-3">
                    <p className="whitespace-pre-line text-base text-black">
                      {cleanSynopsis(manga.description)}
                    </p>
                  </div>
                )}

                {slug && (
                  <div className="mt-10 min-w-0 overflow-hidden">
                    <ChapterNavigator
                      slug={slug}
                      totalChapters={manga.total_chapters}
                      currentChapterNumber={null}
                    />
                  </div>
                )}

                <div className="mt-6">
                  <FeedShell>
                    <PostFeed key={feedNonce} mangaId={manga.id} />
                  </FeedShell>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const phoneView = (
    <MangaPhoneLayout
      slug={slug}
      manga={manga}
      backdropUrl={initialBackdropUrl}
      tags={tags}
      tagsLoading={tagsLoading}
      showSpoilers={showSpoilers}
      setShowSpoilers={setShowSpoilers}
      cleanSynopsis={cleanSynopsis}
      actionBoxNonce={actionBoxNonce}
      chapterLogsNonce={quickLogRefreshToken}
      onOpenLog={() => {
        setSelectedChapterId(null);
        setSelectedChapterNumber(null);
        setLogOpen(true);
      }}
      onShowActivity={() => router.push(`/manga/${manga.slug}/activity`)}
      onOpenLogForChapter={(chapterId, chapterNumber) => {
        setSelectedChapterId(chapterId ?? null);
        setSelectedChapterNumber(
          typeof chapterNumber === "number" && Number.isFinite(chapterNumber)
            ? chapterNumber
            : null
        );
        setLogOpen(true);
      }}
      feedNonce={feedNonce}
      reviewSaveMsg={null}
    />
  );

  return (
    <>
      <ResponsiveSwitch desktop={desktopView} phone={phoneView} />

      {logOpen && (
        <GlobalLogModal
          open={logOpen}
          onClose={() => {
            setLogOpen(false);
            setSelectedChapterId(null);
            setSelectedChapterNumber(null);
          }}
          title={displayPrimaryTitle}
          posterUrl={manga.image_url}
          mangaId={manga.id}
          mangaChapterId={selectedChapterId}
          mangaChapterNumber={selectedChapterNumber}
          onSuccess={async () => {
            const mangaId = manga.id;

            setQuickLogRefreshNonce((n) => n + 1);

            if (selectedChapterId) {
              setChapterLogsNonce((n) => n + 1);
            }

            const {
              data: { user },
              error: userError,
            } = await supabase.auth.getUser();

            if (userError || !user) return;

            const { count: myCount, error: myErr } = await supabase
              .from("manga_series_logs")
              .select("id", { count: "exact", head: true })
              .eq("manga_id", mangaId)
              .eq("user_id", user.id);

            if (!myErr) setMyMangaSeriesLogCount(myCount ?? 0);

            setActionBoxNonce((n) => n + 1);
            setFeedNonce((n) => n + 1);
          }}
        />
      )}
    </>
  );
};

(MangaPage as any).headerTransparent = true;

export default MangaPage;

export const getServerSideProps: GetServerSideProps<MangaPageProps> = async (ctx) => {
  const raw = ctx.params?.slug;
  const slug =
    typeof raw === "string" ? raw : Array.isArray(raw) && raw[0] ? raw[0] : null;

  if (!slug) {
    return {
      props: {
        initialBackdropUrl: null,
        initialManga: null,
      },
    };
  }

  const { data: mangaRow, error: mangaErr } = await supabaseAdmin
    .from("manga")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (mangaErr || !mangaRow) {
    return {
      props: {
        initialBackdropUrl: null,
        initialManga: null,
      },
    };
  }

  const { data: covers, error: coverErr } = await supabaseAdmin
    .from("manga_covers")
    .select("cached_url")
    .eq("manga_id", mangaRow.id)
    .not("cached_url", "is", null)
    .limit(200);

  let initialBackdropUrl: string | null = null;

  if (!coverErr && covers && covers.length > 0) {
    const urls = covers
      .map((c: any) => (typeof c.cached_url === "string" ? c.cached_url.trim() : ""))
      .filter(Boolean);

    if (urls.length > 0) {
      const pick = urls[Math.floor(Math.random() * urls.length)];
      initialBackdropUrl = normalizeBackdropUrl(pick);
    }
  }

  return {
    props: {
      initialBackdropUrl,
      initialManga: mangaRow as Manga,
    },
  };
};