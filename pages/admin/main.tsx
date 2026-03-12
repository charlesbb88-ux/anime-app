import Link from "next/link";
import React from "react";

const adminPages = [
  {
    name: "Import Anime From AniList",
    href: "/admin/pages/import-anime-from-anilist",
  },
  {
    name: "Import Manga Tags",
    href: "/admin/pages/import-manga-tags",
  },
  {
    name: "Import TMDB Episode Metadata Batch",
    href: "/admin/pages/import-tmdb-episode-metadata-batch",
  },
  {
    name: "TMDB Anime Previews",
    href: "/admin/pages/tmdb-anime-previews",
  },
];

export default function AdminMainPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f1115",
        color: "white",
        padding: "32px",
      }}
    >
      <div
        style={{
          maxWidth: "700px",
          margin: "0 auto",
        }}
      >
        <h1
          style={{
            fontSize: "32px",
            fontWeight: 700,
            marginBottom: "24px",
          }}
        >
          Admin Pages
        </h1>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          {adminPages.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              style={{
                display: "block",
                textDecoration: "none",
              }}
            >
              <div
                style={{
                  padding: "16px 18px",
                  borderRadius: "12px",
                  background: "#181c23",
                  border: "1px solid #2a2f3a",
                  cursor: "pointer",
                  transition: "0.15s ease",
                  fontSize: "16px",
                  fontWeight: 600,
                }}
              >
                {page.name}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}