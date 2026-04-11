// pages/manga/[slug].tsx

import { useEffect, useState } from "react";
import type { NextPage, GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";

type Manga = {
  id: string;
  title: string;
  slug: string;
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

  console.log("MINIMAL MANGA PAGE RENDER", {
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
      console.log("MINIMAL manga fetch start", { slug: slugValue, time: t });

      setLoading(true);
      setErrorMessage(null);

      const { data, error } = await supabase
        .from("manga")
        .select("id, title, slug")
        .eq("slug", slugValue)
        .maybeSingle();

      console.log("MINIMAL manga fetch done", {
        slug: slugValue,
        ms: Date.now() - t,
      });

      if (!isMounted) return;

      if (error || !data) {
        console.error("MINIMAL manga fetch error", error);
        setManga(null);
        setErrorMessage("Manga not found.");
      } else {
        setManga(data as Manga);
      }

      setLoading(false);
    }

    console.log("MINIMAL fetch effect triggered", {
      slug: slugValue,
      time: Date.now(),
    });

    fetchManga();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  return (
    <div
      style={{
        padding: 40,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 20 }}>
        Minimal manga page test
      </h1>

      <div style={{ fontSize: 18, marginBottom: 12 }}>
        <strong>Slug:</strong> {slug ?? "none"}
      </div>

      <div style={{ fontSize: 18, marginBottom: 12 }}>
        <strong>Loading:</strong> {loading ? "yes" : "no"}
      </div>

      <div style={{ fontSize: 18, marginBottom: 12 }}>
        <strong>Found manga:</strong> {manga ? "yes" : "no"}
      </div>

      {loading && (
        <div style={{ fontSize: 20, marginTop: 24 }}>Loading manga...</div>
      )}

      {!loading && errorMessage && (
        <div style={{ fontSize: 20, marginTop: 24 }}>{errorMessage}</div>
      )}

      {!loading && manga && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>
            {manga.title}
          </div>
          <div style={{ fontSize: 18 }}>id: {manga.id}</div>
          <div style={{ fontSize: 18 }}>slug: {manga.slug}</div>
        </div>
      )}
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