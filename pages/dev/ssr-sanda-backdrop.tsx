// pages/dev/ssr-sanda-backdrop.tsx

import type { GetServerSideProps, NextPage } from "next";
import Image from "next/image";
import Link from "next/link";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

type AnimeRow = {
  id: string;
  title: string | null;
  slug: string | null;
  image_url: string | null;
};

type ArtworkRow = {
  url: string | null;
  source: string | null;
  width: number | null;
  height: number | null;
  vote: number | null;
  is_primary: boolean | null;
  kind: string | null;
};

function normalizeBackdropUrl(url: string) {
  // TMDB: don't use /original/ (huge)
  if (url.includes("https://image.tmdb.org/t/p/original/")) {
    return url.replace("/t/p/original/", "/t/p/w1280/");
    // If you want even faster:
    // return url.replace("/t/p/original/", "/t/p/w780/");
  }
  return url; // TVDB: leave as-is
}

type Props = {
  anime: AnimeRow;
  backdropUrl: string | null;
  backdropMeta: ArtworkRow | null;
};

const SsrSandaBackdrop: NextPage<Props> = ({ anime, backdropUrl, backdropMeta }) => {
  return (
    <>
      <div className="mx-auto max-w-5xl px-4 pt-0 pb-8">
        {/* Backdrop (same idea as your anime page) */}
        {backdropUrl && (
          <div className="w-full">
            <Image
              src={backdropUrl}
              alt=""
              width={1600}
              height={900}
              priority
              sizes="(max-width: 1024px) 100vw, 1024px"
              style={{ width: "100%", height: "auto" }}
              quality={60}
            />
          </div>
        )}

        {/* Top section (lightweight, just to match the vibe) */}
        <div className="mt-6 mb-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold text-gray-100">
              {anime.title || "Sanda"}
            </h1>
            <div className="text-xs text-gray-500">
              slug: <code>{anime.slug}</code> • id: <code>{anime.id}</code>
            </div>
            {backdropMeta ? (
              <div className="mt-1 text-[11px] text-gray-500">
                source: {backdropMeta.source || "—"} • primary:{" "}
                {backdropMeta.is_primary ? "yes" : "no"} • vote:{" "}
                {typeof backdropMeta.vote === "number" ? backdropMeta.vote : "—"} •{" "}
                {backdropMeta.width && backdropMeta.height
                  ? `${backdropMeta.width}×${backdropMeta.height}`
                  : "—"}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col items-end gap-2">
            <Link
              href="/anime/sanda"
              className="text-sm font-medium text-blue-400 hover:text-blue-300"
            >
              Open /anime/sanda →
            </Link>

            <Link href="/" className="text-sm font-medium text-blue-400 hover:text-blue-300">
              ← Back home
            </Link>
          </div>
        </div>

        {anime.image_url ? (
          <img
            src={anime.image_url}
            alt=""
            className="h-40 w-28 rounded object-cover"
          />
        ) : null}
      </div>
    </>
  );
};

export default SsrSandaBackdrop;

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  // Hard-coded to match your URL: /anime/sanda
  const slug = "sanda";

  const { data: anime, error: animeErr } = await supabaseAdmin
    .from("anime")
    .select("id, title, slug, image_url")
    .eq("slug", slug)
    .maybeSingle();

  if (animeErr || !anime) {
    // If this happens, your slug isn't in the table or the query is blocked
    return { notFound: true };
  }

  // Best backdrop rule: primary first, then highest vote, then largest width
  const { data: art, error: artErr } = await supabaseAdmin
    .from("anime_artwork")
    .select("url, source, width, height, vote, is_primary, kind")
    .eq("anime_id", anime.id)
    .eq("kind", "backdrop")
    .order("is_primary", { ascending: false })
    .order("vote", { ascending: false })
    .order("width", { ascending: false })
    .limit(1)
    .maybeSingle();

  const rawUrl = !artErr && art?.url ? art.url : null;
  const backdropUrl = rawUrl ? normalizeBackdropUrl(rawUrl) : null;

  return {
    props: {
      anime: anime as AnimeRow,
      backdropUrl,
      backdropMeta: (art as ArtworkRow) ?? null,
    },
  };
};
