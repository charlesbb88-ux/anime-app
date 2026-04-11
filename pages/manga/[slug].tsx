// pages/manga/[slug].tsx

import { useEffect, useState } from "react";
import type { NextPage, GetServerSideProps } from "next";
import { useRouter } from "next/router";
import Image from "next/image";

import EnglishTitle from "@/components/EnglishTitle";
import MangaMetaBox from "@/components/manga/MangaMetaBox";
import { supabase } from "@/lib/supabaseClient";

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
};

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

const MangaPage: NextPage<MangaPageProps> = ({ initialBackdropUrl }) => {
  const router = useRouter();

  const [slug, setSlug] = useState<string | null>(null);
  const [manga, setManga] = useState<Manga | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [tags, setTags] = useState<MangaTag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [showSpoilers, setShowSpoilers] = useState(false);

  const [backdropUrl] = useState<string | null>(initialBackdropUrl);

  console.log("STEP 3 PAGE RENDER", {
    slug,
    loading,
    hasManga: !!manga,
    tagsCount: tags.length,
    time: Date.now(),
  });

  useEffect(() => {
    if (!router.isReady) return;

    const raw = router.query.slug as string | string[] | undefined;

    if (typeof raw === "string") setSlug(raw);
    else if (Array.isArray(raw) && raw.length > 0) setSlug(raw[0]);
    else setSlug(null);
  }, [router.isReady, router.query.slug]);

  useEffect(() => {
    if (!slug) {
      setManga(null);
      setLoading(false);
      return;
    }

    const slugValue = slug;
    let isMounted = true;

    async function fetchManga() {
      const t = Date.now();
      console.log("STEP 3 manga fetch start", {
        slug: slugValue,
        time: t,
      });

      setLoading(true);
      setErrorMessage(null);

      const { data, error } = await supabase
        .from("manga")
        .select("*")
        .eq("slug", slugValue)
        .maybeSingle();

      console.log("STEP 3 manga fetch done", {
        slug: slugValue,
        ms: Date.now() - t,
      });

      if (!isMounted) return;

      if (error || !data) {
        console.error("STEP 3 manga fetch error", error);
        setManga(null);
        setErrorMessage("Manga not found.");
      } else {
        setManga(data as Manga);
      }

      setLoading(false);
    }

    console.log("STEP 3 fetch effect triggered", {
      slug: slugValue,
      time: Date.now(),
    });

    fetchManga();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!manga?.id) {
      setTags([]);
      return;
    }

    const mangaId = manga.id;
    let isMounted = true;

    async function fetchTags() {
      const t = Date.now();
      console.log("STEP 3 tags fetch start", {
        mangaId,
        time: t,
      });

      setTagsLoading(true);

      const { data, error } = await supabase
        .from("manga_tags")
        .select(
          "id, manga_id, name, description, rank, is_adult, is_general_spoiler, is_media_spoiler, category"
        )
        .eq("manga_id", mangaId)
        .order("rank", { ascending: false });

      console.log("STEP 3 tags fetch done", {
        mangaId,
        ms: Date.now() - t,
      });

      if (!isMounted) return;

      if (error || !data) {
        console.error("STEP 3 tags fetch error", error);
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

  if (loading) {
    return (
      <div style={{ padding: 40, fontFamily: "Arial, sans-serif" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 16 }}>
          Step 3 test
        </h1>
        <div style={{ fontSize: 20 }}>Loading manga...</div>
      </div>
    );
  }

  if (!manga) {
    return (
      <div style={{ padding: 40, fontFamily: "Arial, sans-serif" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 16 }}>
          Step 3 test
        </h1>
        <div style={{ fontSize: 20, marginBottom: 12 }}>Manga not found.</div>
        {errorMessage && <div style={{ fontSize: 16 }}>{errorMessage}</div>}
      </div>
    );
  }

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

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        maxWidth: 1200,
        margin: "0 auto",
        paddingBottom: 40,
      }}
    >
      {backdropUrl && (
        <div
          style={{
            position: "relative",
            height: 420,
            width: "100%",
            overflow: "hidden",
            marginBottom: 24,
          }}
        >
          <Image
            src={backdropUrl}
            alt=""
            fill
            priority
            unoptimized
            sizes="100vw"
            style={{ objectFit: "cover", objectPosition: "50% 25%" }}
          />
        </div>
      )}

      <div style={{ padding: "0 24px" }}>
        <div style={{ marginBottom: 12, fontSize: 14 }}>
          <strong>Slug:</strong> {slug ?? "none"}
        </div>

        <div style={{ marginBottom: 24 }}>
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

        {typeof manga.description === "string" && manga.description.trim() && (
          <div style={{ marginBottom: 24, maxWidth: 900 }}>
            <p style={{ fontSize: 16, lineHeight: 1.5, whiteSpace: "pre-line" }}>
              {cleanSynopsis(manga.description)}
            </p>
          </div>
        )}

        {hasAnyTopPills && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
              Genres / Safety
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {genres.map((g) => (
                <span
                  key={`genre-${g}`}
                  style={{
                    borderRadius: 999,
                    background: "#111",
                    color: "#fff",
                    padding: "6px 12px",
                    fontSize: 12,
                  }}
                >
                  {g}
                </span>
              ))}

              {uniqueSafetyPills.map((pill) => (
                <span
                  key={`safety-${pill}`}
                  style={{
                    borderRadius: 999,
                    background: "#b91c1c",
                    color: "#fff",
                    padding: "6px 12px",
                    fontSize: 12,
                  }}
                >
                  {formatSafetyPill(pill)}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 24, maxWidth: 340 }}>
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

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
            Tags
          </div>

          {tagsLoading && (
            <div style={{ fontSize: 14, marginBottom: 10 }}>Loading tags...</div>
          )}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              maxWidth: 420,
            }}
          >
            {tags.map((tag) => {
              const isSpoiler =
                tag.is_general_spoiler === true || tag.is_media_spoiler === true;

              if (isSpoiler && !showSpoilers) return null;

              const percent =
                typeof tag.rank === "number"
                  ? Math.max(0, Math.min(100, Math.round(tag.rank)))
                  : null;

              return (
                <div
                  key={tag.id}
                  style={{
                    position: "relative",
                    border: "1px solid #444",
                    borderRadius: 999,
                    overflow: "hidden",
                    background: "#1f1f1f",
                    color: "#fff",
                    padding: "8px 12px",
                    fontSize: 13,
                  }}
                  title={tag.description ?? undefined}
                >
                  {percent !== null && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: `${percent}%`,
                        background: "#000",
                      }}
                    />
                  )}

                  <div
                    style={{
                      position: "relative",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <span style={{ color: isSpoiler ? "#f87171" : "#fff" }}>
                      {tag.name}
                    </span>

                    {percent !== null && <span>{percent}%</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {spoilerCount > 0 && (
            <button
              type="button"
              onClick={() => setShowSpoilers((prev) => !prev)}
              style={{
                marginTop: 12,
                background: "transparent",
                border: "none",
                color: "#2563eb",
                cursor: "pointer",
                padding: 0,
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              {showSpoilers
                ? `Hide ${spoilerCount} spoiler tag${spoilerCount === 1 ? "" : "s"}`
                : `Show ${spoilerCount} spoiler tag${spoilerCount === 1 ? "" : "s"}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

(MangaPage as any).headerTransparent = true;

export default MangaPage;

export const getServerSideProps: GetServerSideProps<MangaPageProps> = async () => {
  return {
    props: {
      initialBackdropUrl: null,
    },
  };
};