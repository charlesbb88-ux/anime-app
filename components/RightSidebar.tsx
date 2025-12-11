"use client";

import React from "react";

const TYPO = {
  base: "1rem",
  subheading: "1.05rem",
};

export default function RightSidebar() {
  return (
    <aside
      style={{
        width: "100%",                // ⬅️ fills the wrapper width from Home
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
      }}
    >
      {/* Card 1: Trending this week */}
      <div
        style={{
          padding: "1rem 1.1rem",
          background: "#ffffff",
          borderRadius: 10,
          border: "1px solid #11111111",
        }}
      >
        <h3
          style={{
            fontSize: TYPO.subheading,
            fontWeight: 600,
            marginBottom: "0.5rem",
          }}
        >
          Trending this week (placeholder)
        </h3>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            fontSize: TYPO.base,
          }}
        >
          <li style={{ padding: "0.2rem 0" }}>• Juju</li>
          <li style={{ padding: "0.2rem 0" }}>• Solo Leveling S2</li>
          <li style={{ padding: "0.2rem 0" }}>• Frieren rewatch wave</li>
          <li style={{ padding: "0.2rem 0" }}>• New seasonal isekai</li>
        </ul>
      </div>

      {/* Card 2: Recently reviewed */}
      <div
        style={{
          padding: "1rem 1.1rem",
          background: "#ffffff",
          borderRadius: 10,
          border: "1px solid #11111111",
        }}
      >
        <h3
          style={{
            fontSize: TYPO.subheading,
            fontWeight: 600,
            marginBottom: "0.5rem",
          }}
        >
          Recently reviewed (placeholder)
        </h3>
        <p
          style={{
            fontSize: TYPO.base,
            color: "#555",
            marginBottom: "0.35rem",
          }}
        >
          • &quot;Episode 7 had peak animation.&quot;
        </p>
        <p
          style={{
            fontSize: TYPO.base,
            color: "#555",
            marginBottom: "0.35rem",
          }}
        >
          • &quot;Felt like classic shounen with modern pacing.&quot;
        </p>
        <p
          style={{
            fontSize: TYPO.base,
            color: "#555",
          }}
        >
          • &quot;Underrated slice-of-life, perfect background show.&quot;
        </p>
      </div>
    </aside>
  );
}
