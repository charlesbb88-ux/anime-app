// pages/manga/[slug].tsx

import { useEffect, useState } from "react";
import type { NextPage, GetServerSideProps } from "next";
import { useRouter } from "next/router";

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

type MangaPageProps = {
  initialBackdropUrl: string | null;
};

const MangaPage: NextPage<MangaPageProps> = () => {
  const router = useRouter();

  const [slug, setSlug] = useState<string | null>(null);
  const [manga, setManga] = useState<Manga | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  console.log("STEP 2 PAGE RENDER", {
    slug,
    loading,
    hasManga: !!manga,
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
      console.log("STEP 2 manga fetch start", {
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

      console.log("STEP 2 manga fetch done", {
        slug: slugValue,
        ms: Date.now() - t,
      });

      if (!isMounted) return;

      if (error || !data) {
        console.error("STEP 2 manga fetch error", error);
        setManga(null);
        setErrorMessage("Manga not found.");
      } else {
        setManga(data as Manga);
      }

      setLoading(false);
    }

    console.log("STEP 2 fetch effect triggered", {
      slug: slugValue,
      time: Date.now(),
    });

    fetchManga();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div style={{ padding: 40, fontFamily: "Arial, sans-serif" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 16 }}>
          Step 2 test
        </h1>
        <div style={{ fontSize: 20 }}>Loading manga...</div>
      </div>
    );
  }

  if (!manga) {
    return (
      <div style={{ padding: 40, fontFamily: "Arial, sans-serif" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 16 }}>
          Step 2 test
        </h1>
        <div style={{ fontSize: 20, marginBottom: 12 }}>Manga not found.</div>
        {errorMessage && <div style={{ fontSize: 16 }}>{errorMessage}</div>}
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 40,
        fontFamily: "Arial, sans-serif",
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, marginBottom: 8 }}>
          <strong>Slug:</strong> {slug ?? "none"}
        </div>

        <div style={{ fontSize: 14, marginBottom: 8 }}>
          <strong>Manga id:</strong> {manga.id}
        </div>
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

      <div style={{ maxWidth: 340 }}>
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